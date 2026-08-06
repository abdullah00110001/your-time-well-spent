import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Heart, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAppMode, stoicQuotes } from '@/contexts/AppModeContext';

const moods = [
  { value: 'anxious', label: 'Anxious 😰', color: 'bg-amber-100 text-amber-800' },
  { value: 'angry', label: 'Angry 😠', color: 'bg-rose-100 text-rose-800' },
  { value: 'lazy', label: 'Lazy 😴', color: 'bg-blue-100 text-blue-800' },
  { value: 'sad', label: 'Sad 😢', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'hopeless', label: 'Hopeless 💔', color: 'bg-purple-100 text-purple-800' },
  { value: 'grateful', label: 'Grateful 🤲', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'fearful', label: 'Fearful 😨', color: 'bg-slate-100 text-slate-800' },
  { value: 'distracted', label: 'Distracted 🌀', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'proud', label: 'Proud 👑', color: 'bg-orange-100 text-orange-800' },
  { value: 'overwhelmed', label: 'Overwhelmed 😵', color: 'bg-pink-100 text-pink-800' },
];

// Stoic readings for regular mode
const stoicReadings: Record<string, { text: string; source: string; author: string }> = {
  anxious: { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", source: "Meditations", author: "Marcus Aurelius" },
  angry: { text: "How much more grievous are the consequences of anger than the causes of it.", source: "Meditations", author: "Marcus Aurelius" },
  lazy: { text: "At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work — as a human being.", source: "Meditations", author: "Marcus Aurelius" },
  sad: { text: "It is not things that disturb us, but our judgments about things.", source: "Enchiridion", author: "Epictetus" },
  hopeless: { text: "Sometimes even to live is an act of courage.", source: "Letters", author: "Seneca" },
  grateful: { text: "True happiness is to enjoy the present, without anxious dependence upon the future.", source: "Letters", author: "Seneca" },
  fearful: { text: "We suffer more often in imagination than in reality.", source: "Letters", author: "Seneca" },
  distracted: { text: "Concentrate every minute on doing what's in front of you with precise and genuine seriousness.", source: "Meditations", author: "Marcus Aurelius" },
  proud: { text: "Humility is the solid foundation of all virtues.", source: "Analects", author: "Confucius" },
  overwhelmed: { text: "The whole future lies in uncertainty: live immediately.", source: "Letters", author: "Seneca" },
};

interface QuranicAnchor {
  id: string;
  mood: string;
  surah_name: string;
  surah_number: number;
  ayah_start: number;
  ayah_end: number;
  english_translation: string;
  benefit: string;
}

interface QuranicAnchorProps {
  onFeedback?: (moodShifted: boolean) => void;
}

export default function QuranicAnchorSystem({ onFeedback }: QuranicAnchorProps) {
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [anchor, setAnchor] = useState<QuranicAnchor | null>(null);
  const [stoicReading, setStoicReading] = useState<typeof stoicReadings.anxious | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const { mode, labels } = useAppMode();

  const primaryColor = mode === 'islamic' ? 'emerald' : 'blue';

  const fetchAnchor = async (mood: string) => {
    setLoading(true);
    setFeedbackGiven(false);
    
    if (mode === 'regular') {
      // Use stoic readings for regular mode
      setStoicReading(stoicReadings[mood] || stoicReadings.anxious);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quranic_anchors')
        .select('*')
        .eq('mood', mood)
        .limit(1)
        .single();

      if (error) throw error;
      setAnchor(data);
    } catch (error) {
      console.error('Error fetching Quranic anchor:', error);
      setAnchor(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    fetchAnchor(mood);
  };

  const handleFeedback = (shifted: boolean) => {
    setFeedbackGiven(true);
    onFeedback?.(shifted);
  };

  const handleReset = () => {
    setSelectedMood('');
    setAnchor(null);
    setStoicReading(null);
    setFeedbackGiven(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className={cn("h-4 w-4", mode === 'islamic' ? "text-emerald-500" : "text-blue-500")} />
            {labels.emotionalAnchor.title}
          </CardTitle>
          {selectedMood && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>{labels.emotionalAnchor.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedMood ? (
          <>
            <p className="text-sm text-center text-muted-foreground">
              {labels.emotionalAnchor.moodPrompt}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {moods.map(mood => (
                <Button
                  key={mood.value}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-xs h-9",
                    selectedMood === mood.value && mood.color
                  )}
                  onClick={() => handleMoodSelect(mood.value)}
                >
                  {mood.label}
                </Button>
              ))}
            </div>
          </>
        ) : loading ? (
          <div className="py-8 text-center">
            <RefreshCw className={cn(
              "h-6 w-6 mx-auto animate-spin",
              mode === 'islamic' ? "text-emerald-500" : "text-blue-500"
            )} />
            <p className="text-sm text-muted-foreground mt-2">Finding healing words...</p>
          </div>
        ) : (mode === 'islamic' && anchor) || (mode === 'regular' && stoicReading) ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Badge className={cn("text-xs", moods.find(m => m.value === selectedMood)?.color)}>
                {moods.find(m => m.value === selectedMood)?.label}
              </Badge>
            </div>

            {mode === 'islamic' && anchor && (
              <>
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {anchor.surah_name} ({anchor.surah_number}:{anchor.ayah_start}
                    {anchor.ayah_end !== anchor.ayah_start && `-${anchor.ayah_end}`})
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm italic leading-relaxed text-emerald-900 dark:text-emerald-100">
                    "{anchor.english_translation}"
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    <Heart className="h-3 w-3 inline mr-1 text-rose-500" />
                    {anchor.benefit}
                  </p>
                </div>
              </>
            )}

            {mode === 'regular' && stoicReading && (
              <>
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {stoicReading.source} — {stoicReading.author}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm italic leading-relaxed text-blue-900 dark:text-blue-100">
                    "{stoicReading.text}"
                  </p>
                </div>
              </>
            )}

            {!feedbackGiven ? (
              <div className="space-y-2">
                <p className="text-sm text-center font-medium">
                  {labels.emotionalAnchor.feedbackQuestion}
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      mode === 'islamic'
                        ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                        : "border-blue-300 text-blue-600 hover:bg-blue-50"
                    )}
                    onClick={() => handleFeedback(true)}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-300 text-rose-600 hover:bg-rose-50"
                    onClick={() => handleFeedback(false)}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  {mode === 'islamic' 
                    ? "Thank you for your feedback! May Allah grant you peace. 🤲"
                    : "Thank you for your feedback! May you find tranquility. ✨"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">No anchor found for this mood.</p>
            <Button variant="link" onClick={handleReset}>Try another mood</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

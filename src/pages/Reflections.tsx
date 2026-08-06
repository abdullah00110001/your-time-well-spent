import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useReflections } from '@/hooks/useReflections';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppMode } from '@/contexts/AppModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, RefreshCw, Send, Sparkles, History, Loader2, Smile, Meh, Frown } from 'lucide-react';
import { format } from 'date-fns';

const moodOptions = [
  { value: 1, icon: Frown, label: 'Low', color: 'text-red-500' },
  { value: 2, icon: Frown, label: 'Below Avg', color: 'text-orange-500' },
  { value: 3, icon: Meh, label: 'Neutral', color: 'text-yellow-500' },
  { value: 4, icon: Smile, label: 'Good', color: 'text-lime-500' },
  { value: 5, icon: Smile, label: 'Great', color: 'text-emerald-500' },
];

export default function Reflections() {
  const { language } = useLanguage();
  const { mode } = useAppMode();
  const { 
    todayPrompt, 
    todayReflection, 
    reflections, 
    loading, 
    saveReflection,
    getRandomPrompt 
  } = useReflections();

  const [response, setResponse] = useState(todayReflection?.response || '');
  const [moodBefore, setMoodBefore] = useState<number | null>(todayReflection?.mood_before || null);
  const [moodAfter, setMoodAfter] = useState<number | null>(todayReflection?.mood_after || null);
  const [currentPrompt, setCurrentPrompt] = useState(todayPrompt);
  const [saving, setSaving] = useState(false);

  const handleRefreshPrompt = () => {
    const mood = moodBefore === null ? undefined : moodBefore <= 2 ? 'low' : moodBefore >= 4 ? 'high' : 'medium';
    const newPrompt = getRandomPrompt(mood);
    if (newPrompt) setCurrentPrompt(newPrompt);
  };

  const handleSave = async () => {
    if (!response.trim()) return;
    setSaving(true);
    await saveReflection(
      response,
      currentPrompt?.id,
      undefined,
      moodBefore || undefined,
      moodAfter || undefined
    );
    setSaving(false);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'gratitude': return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
      case 'growth': return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30';
      case 'spiritual': return 'bg-purple-500/20 text-purple-600 border-purple-500/30';
      case 'productivity': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
      case 'relationships': return 'bg-pink-500/20 text-pink-600 border-pink-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const displayPrompt = currentPrompt || todayPrompt;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-headline font-bold flex items-center gap-2">
            <BookOpen className={`h-7 w-7 ${mode === 'islamic' ? 'text-emerald-500' : 'text-primary'}`} />
            {mode === 'islamic' ? 'Muhasaba' : 'Daily Reflection'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {mode === 'islamic' 
              ? 'Self-accounting and spiritual reflection' 
              : 'Take a moment to reflect on your day'}
          </p>
        </div>

        <Tabs defaultValue="today" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="today">Today's Reflection</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Today's Reflection */}
          <TabsContent value="today" className="space-y-4">
            {/* Mood Before */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">How are you feeling right now?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between gap-2">
                  {moodOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setMoodBefore(option.value)}
                      className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                        moodBefore === option.value 
                          ? 'border-primary bg-primary/10' 
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <option.icon className={`h-6 w-6 mx-auto ${option.color}`} />
                      <span className="text-xs mt-1 block">{option.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Prompt Card */}
            <Card className={`border-2 ${mode === 'islamic' ? 'border-emerald-500/30' : 'border-primary/30'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-5 w-5 ${mode === 'islamic' ? 'text-emerald-500' : 'text-primary'}`} />
                    <CardTitle className="text-base">Today's Prompt</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {displayPrompt && (
                      <Badge variant="outline" className={getCategoryColor(displayPrompt.category)}>
                        {displayPrompt.category}
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" onClick={handleRefreshPrompt}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {displayPrompt
                    ? (language === 'bn' && displayPrompt.prompt_text_bn 
                        ? displayPrompt.prompt_text_bn 
                        : displayPrompt.prompt_text)
                    : 'What is on your mind today?'}
                </p>
              </CardContent>
            </Card>

            {/* Response Area */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Thoughts</CardTitle>
                <CardDescription>
                  {todayReflection ? 'Update your reflection' : 'Write your reflection'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Take your time to reflect..."
                  className="min-h-[150px] resize-none"
                />

                {/* Mood After */}
                <div>
                  <p className="text-sm font-medium mb-2">How do you feel after reflecting?</p>
                  <div className="flex justify-between gap-2">
                    {moodOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setMoodAfter(option.value)}
                        className={`flex-1 p-2 rounded-lg border-2 transition-all ${
                          moodAfter === option.value 
                            ? 'border-primary bg-primary/10' 
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <option.icon className={`h-5 w-5 mx-auto ${option.color}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={!response.trim() || saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {todayReflection ? 'Update Reflection' : 'Save Reflection'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-4">
            {reflections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No reflections yet</p>
                  <p className="text-sm text-muted-foreground">Start writing today!</p>
                </CardContent>
              </Card>
            ) : (
              reflections.map((reflection) => (
                <Card key={reflection.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {format(new Date(reflection.reflection_date), 'EEEE, MMMM d, yyyy')}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {reflection.mood_before && (
                          <Badge variant="outline" className="text-xs">
                            Before: {reflection.mood_before}/5
                          </Badge>
                        )}
                        {reflection.mood_after && (
                          <Badge variant="outline" className="text-xs">
                            After: {reflection.mood_after}/5
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {reflection.response}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

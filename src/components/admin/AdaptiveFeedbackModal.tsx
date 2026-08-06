import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Moon, Sun, Send, Sparkles } from 'lucide-react';
import { modeLabels } from '@/contexts/AppModeContext';

interface AdaptiveFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userMode: string;
}

const feedbackTemplates = {
  islamic: {
    encouragement: [
      "MashaAllah! Your dedication to Salah this week has been inspiring. Keep it up, and may Allah bless your efforts. 🤲",
      "Subhanallah, your Quran consistency is growing! Remember, even a few ayahs daily bring immense barakah. 📖",
      "Your tahajjud this week shows true mujahadah. The angels witness your effort. Keep striving! 🌙",
    ],
    concern: [
      "Brother/Sister, I noticed your Salah consistency dropped this week. Remember, Allah is Ar-Rahman. Return to Him gently. 💚",
      "Your device time has increased. Consider replacing some scrolling with dhikr or Quran. Your heart will thank you. 🕌",
      "I see you're struggling with nafs lately. Remember the hadith: 'The strong person is not the one who can wrestle someone down.' You've got this! 💪",
    ],
    celebration: [
      "Takbir! You've maintained 100% Salah for a week! May Allah accept it and grant you Jannah. 🎉",
      "Your barakah index is at an all-time high! Your niyyah is clearly pure. Continue seeking Allah's pleasure. ✨",
      "30-day Quran streak! SubhanAllah, you're among the special ones. May it be a witness for you on Yawm al-Qiyamah. 📿",
    ],
  },
  regular: {
    encouragement: [
      "Great job maintaining your morning routine! Consistency is the key to long-term success. Keep building momentum! 🌅",
      "Your focus sessions are improving week over week. That's real progress. Stay on track! 💪",
      "I've noticed your dedication to early rising. Science backs this up - 5 AM club members achieve more! ⏰",
    ],
    concern: [
      "Your productivity metrics dipped this week. Remember, temporary setbacks are part of the journey. Tomorrow is a new day! 🌱",
      "Screen time is creeping up. Consider the 'Stoic pause' - before scrolling, ask: 'Is this serving my higher purpose?' 🧘",
      "I see some urge resistance struggles. That's normal. The fact that you're tracking means you're aware. Awareness is step one! 🎯",
    ],
    celebration: [
      "Incredible! 7-day streak of deep work sessions. You're in the top 10% of focused individuals! 🏆",
      "Your legacy ratio is outstanding. You're investing in what truly matters. Future you will be grateful! ✨",
      "100% morning routine completion! You've proven that discipline beats motivation every time. Proud of you! 🔥",
    ],
  },
};

export default function AdaptiveFeedbackModal({
  isOpen,
  onClose,
  userId,
  userName,
  userMode,
}: AdaptiveFeedbackModalProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<string>('encouragement');
  const [isPrivate, setIsPrivate] = useState(false);
  const [sending, setSending] = useState(false);

  const isIslamic = userMode === 'islamic' || !userMode;
  const templates = isIslamic ? feedbackTemplates.islamic : feedbackTemplates.regular;
  const labels = isIslamic ? modeLabels.islamic : modeLabels.regular;

  const applyTemplate = (template: string) => {
    setMessage(template);
  };

  const handleSend = async () => {
    if (!message.trim() || !user) return;

    setSending(true);
    try {
      // Insert feedback with required date field
      const { error } = await supabase.from('admin_feedback').insert({
        user_id: userId,
        admin_id: user.id,
        message: message.trim(),
        feedback_type: feedbackType,
        is_private: isPrivate,
        date: format(new Date(), 'yyyy-MM-dd'),
      });

      if (error) throw error;

      // Send notification to user (only if not private)
      if (!isPrivate) {
        const feedbackTypeLabels: Record<string, string> = {
          encouragement: '💚 Encouragement',
          concern: '💭 Concern', 
          celebration: '🎉 Celebration'
        };
        
        await supabase.from('notifications').insert({
          user_id: userId,
          title: feedbackTypeLabels[feedbackType] || 'Admin Feedback',
          message: message.trim(),
          type: 'admin_feedback',
          metadata: { feedback_type: feedbackType }
        });
      }

      toast.success(`Feedback sent to ${userName}!`);
      setMessage('');
      onClose();
    } catch (error: any) {
      console.error('Error sending feedback:', error);
      toast.error('Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Adaptive Feedback
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Sending to <span className="font-medium">{userName}</span>
            <Badge 
              variant="outline" 
              className={isIslamic 
                ? 'border-emerald-500 text-emerald-600' 
                : 'border-blue-500 text-blue-600'
              }
            >
              {isIslamic ? <Moon className="h-3 w-3 mr-1" /> : <Sun className="h-3 w-3 mr-1" />}
              {isIslamic ? 'Islamic' : 'Regular'} Mode
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Feedback Type */}
          <div className="space-y-2">
            <Label>Feedback Type</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encouragement">💚 Encouragement</SelectItem>
                <SelectItem value="concern">💭 Concern</SelectItem>
                <SelectItem value="celebration">🎉 Celebration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Templates */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Quick Templates ({isIslamic ? 'Islamic' : 'Regular'} Mode)
            </Label>
            <div className="grid gap-2">
              {templates[feedbackType as keyof typeof templates]?.map((template, i) => (
                <button
                  key={i}
                  onClick={() => applyTemplate(template)}
                  className="text-left p-2 text-xs rounded-lg border border-dashed hover:bg-muted transition-colors line-clamp-2"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isIslamic 
                ? "Write your message... Use Islamic terminology that resonates with the user's mode."
                : "Write your message... Use secular, motivational language that matches the user's mode."
              }
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              {isIslamic 
                ? `Tip: Use terms like "${labels.intention}", "${labels.reset}", "${labels.goal}" for resonance.`
                : `Tip: Use terms like "${labels.intention}", "${labels.reset}", "${labels.goal}" for resonance.`
              }
            </p>
          </div>

          {/* Private Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Private Feedback</Label>
              <p className="text-xs text-muted-foreground">
                Only visible to admins (user won't see it)
              </p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sending}
            className={isIslamic ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {sending ? 'Sending...' : 'Send Feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

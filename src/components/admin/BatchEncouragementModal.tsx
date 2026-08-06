import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Heart, 
  AlertCircle, 
  Lightbulb, 
  Bell,
  Send,
  Loader2,
  Users
} from 'lucide-react';

interface AtRiskUser {
  user_id: string;
  full_name: string | null;
  days_inactive: number;
}

interface BatchEncouragementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AtRiskUser[];
  onSuccess: () => void;
}

const messageTemplates = {
  encouragement: [
    "Hey! Just checking in. Remember, every small step counts. Take it one day at a time! 💪",
    "We noticed you've been away. Hope everything is okay! We're here when you're ready to continue your journey.",
    "Missing your daily logs! Your consistency was inspiring. Ready to get back on track?"
  ],
  concern: [
    "Hi there, we noticed you haven't logged in a while. Is everything alright? We're here to support you.",
    "Taking a break is okay! When you're ready, we'd love to see you back on your journey.",
    "Just wanted to reach out and let you know we're thinking of you. No pressure - return when you're ready."
  ],
  suggestion: [
    "Pro tip: Start small! Even logging just one habit can help rebuild momentum.",
    "Try setting a reminder for a specific time each day - it makes logging much easier!",
    "Consider starting fresh with just your most important habit. Quality over quantity!"
  ],
  reminder: [
    "This is a gentle reminder to check in with your daily habits when you get a chance.",
    "Don't forget: Your journey matters. A few minutes of reflection can make all the difference.",
    "Quick reminder: Your progress is waiting for you! Pop in when you can."
  ]
};

export default function BatchEncouragementModal({ 
  isOpen, 
  onClose, 
  users, 
  onSuccess 
}: BatchEncouragementModalProps) {
  const { user: adminUser } = useAuth();
  const [feedbackType, setFeedbackType] = useState('encouragement');
  const [message, setMessage] = useState(messageTemplates.encouragement[0]);
  const [sending, setSending] = useState(false);

  const handleTypeChange = (type: string) => {
    setFeedbackType(type);
    setMessage(messageTemplates[type as keyof typeof messageTemplates][0]);
  };

  const handleSend = async () => {
    if (!adminUser || !message.trim()) return;

    setSending(true);
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const feedbackRecords = users.map(u => ({
        admin_id: adminUser.id,
        user_id: u.user_id,
        message: message.trim(),
        feedback_type: feedbackType,
        date: today,
        is_private: false
      }));

      const { error } = await supabase
        .from('admin_feedback')
        .insert(feedbackRecords);

      if (error) throw error;

      toast.success(`Sent encouragement to ${users.length} users!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error sending batch feedback:', error);
      toast.error(`Failed to send messages: ${error?.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Send Batch Encouragement
          </DialogTitle>
          <DialogDescription>
            Send the same message to all {users.length} at-risk users
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipients Preview */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Recipients</Label>
            <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/50 max-h-24 overflow-y-auto">
              {users.slice(0, 10).map((u) => (
                <Badge key={u.user_id} variant="secondary" className="text-xs">
                  {u.full_name || `User ${u.user_id.slice(0, 6)}`} ({u.days_inactive}d)
                </Badge>
              ))}
              {users.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{users.length - 10} more
                </Badge>
              )}
            </div>
          </div>

          {/* Feedback Type */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Message Type</Label>
            <RadioGroup 
              value={feedbackType} 
              onValueChange={handleTypeChange}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="encouragement" id="batch-encouragement" />
                <Label htmlFor="batch-encouragement" className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <Heart className="h-4 w-4 text-pink-500" />
                  Encouragement
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="concern" id="batch-concern" />
                <Label htmlFor="batch-concern" className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Check-in
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="suggestion" id="batch-suggestion" />
                <Label htmlFor="batch-suggestion" className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Suggestion
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="reminder" id="batch-reminder" />
                <Label htmlFor="batch-reminder" className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <Bell className="h-4 w-4 text-blue-500" />
                  Reminder
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quick Templates */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Templates</Label>
            <div className="space-y-1.5">
              {messageTemplates[feedbackType as keyof typeof messageTemplates].map((template, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(template)}
                  className={`w-full text-left p-2 rounded-lg text-xs border transition-colors ${
                    message === template 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {users.length} Users
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

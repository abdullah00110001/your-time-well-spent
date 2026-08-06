import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  X, Send, Lock, Unlock, Eye, EyeOff, 
  CheckCircle2, AlertTriangle, Clock, BookOpen, Smartphone
} from 'lucide-react';

interface DailyEntry {
  id: string;
  date: string;
  user_id: string;
  focused_study_minutes: number;
  revision_minutes: number;
  fajr_completed: boolean;
  dhuhr_completed: boolean;
  asr_completed: boolean;
  maghrib_completed: boolean;
  isha_completed: boolean;
  khushu_level: number;
  quran_read: boolean;
  quran_minutes: number;
  device_time_minutes: number;
  social_media_minutes: number;
  exercise_done: boolean;
  sleep_duration_minutes: number;
  sleep_quality: number;
  energy_level: number;
  focus_level: number;
  discipline_level: number;
  overall_day_rating: number;
  mental_state: string;
  most_important_task: string;
  biggest_time_leak: string;
  regret_of_day: string;
  free_reflection: string;
  is_locked: boolean;
}

interface Muhasaba {
  what_went_right: string;
  what_went_wrong: string;
  helpful_habit: string;
  harmful_habit: string;
  fix_tomorrow: string;
}

interface UserDayInspectorProps {
  entry: DailyEntry;
  muhasaba: Muhasaba | null;
  userName: string;
  adminId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function UserDayInspector({ 
  entry, muhasaba, userName, adminId, onClose, onRefresh 
}: UserDayInspectorProps) {
  const [mentorNote, setMentorNote] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [sending, setSending] = useState(false);

  const salahCount = [
    entry.fajr_completed, entry.dhuhr_completed, entry.asr_completed,
    entry.maghrib_completed, entry.isha_completed
  ].filter(Boolean).length;

  const totalStudy = (entry.focused_study_minutes || 0) + (entry.revision_minutes || 0);

  const handleSendFeedback = async (type: 'public' | 'private') => {
    const message = type === 'public' ? mentorNote : privateNote;
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from('admin_feedback').insert({
        user_id: entry.user_id,
        admin_id: adminId,
        daily_entry_id: entry.id,
        date: entry.date,
        feedback_type: type === 'public' ? 'motivation' : 'advice',
        message: message.trim(),
        is_private: type === 'private',
      });

      if (error) throw error;
      toast.success(type === 'public' ? 'Mentor note sent!' : 'Private note saved!');
      if (type === 'public') setMentorNote('');
      else setPrivateNote('');
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  const handleToggleLock = async () => {
    try {
      const { error } = await supabase
        .from('daily_entries')
        .update({ 
          is_locked: !entry.is_locked,
          locked_at: !entry.is_locked ? new Date().toISOString() : null
        })
        .eq('id', entry.id);

      if (error) throw error;
      toast.success(entry.is_locked ? 'Entry unlocked' : 'Entry locked');
      onRefresh();
    } catch (error) {
      toast.error('Failed to toggle lock');
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{userName}</CardTitle>
            <CardDescription>{format(new Date(entry.date), 'EEEE, MMMM d, yyyy')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleLock}
              className={entry.is_locked ? 'text-amber-600' : ''}
            >
              {entry.is_locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <p className="text-xl font-bold text-primary">{Math.round(totalStudy / 60)}h</p>
            <p className="text-xs text-muted-foreground">Study</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <p className="text-xl font-bold text-emerald-600">{salahCount}/5</p>
            <p className="text-xs text-muted-foreground">Salah</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <p className="text-xl font-bold text-destructive">{Math.round((entry.device_time_minutes || 0) / 60)}h</p>
            <p className="text-xs text-muted-foreground">Device</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <p className="text-xl font-bold">{entry.overall_day_rating || '-'}/10</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          {salahCount < 5 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
              <AlertTriangle className="h-4 w-4" />
              Missed {5 - salahCount} prayer(s)
            </div>
          )}
          {(entry.device_time_minutes || 0) > totalStudy && (
            <div className="flex items-center gap-2 text-destructive text-sm p-2 bg-destructive/10 rounded">
              <Smartphone className="h-4 w-4" />
              Device time exceeds study time
            </div>
          )}
          {!entry.quran_read && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm p-2 bg-muted/30 rounded">
              <BookOpen className="h-4 w-4" />
              No Qur'an engagement
            </div>
          )}
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Mental State</p>
            <Badge variant="outline">{entry.mental_state || 'Not set'}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Sleep</p>
            <p>{Math.round((entry.sleep_duration_minutes || 0) / 60)}h (Quality: {entry.sleep_quality || '-'}/5)</p>
          </div>
          <div>
            <p className="text-muted-foreground">Focus Level</p>
            <p>{entry.focus_level || '-'}/5</p>
          </div>
          <div>
            <p className="text-muted-foreground">Discipline</p>
            <p>{entry.discipline_level || '-'}/5</p>
          </div>
        </div>

        {/* Reflections */}
        {(entry.most_important_task || entry.biggest_time_leak || entry.regret_of_day) && (
          <div className="space-y-2 text-sm">
            <Separator />
            {entry.most_important_task && (
              <div>
                <p className="text-muted-foreground">Most Important Task</p>
                <p>{entry.most_important_task}</p>
              </div>
            )}
            {entry.biggest_time_leak && (
              <div>
                <p className="text-muted-foreground">Biggest Time Leak</p>
                <p className="text-destructive">{entry.biggest_time_leak}</p>
              </div>
            )}
            {entry.regret_of_day && (
              <div>
                <p className="text-muted-foreground">Regret</p>
                <p className="text-amber-600">{entry.regret_of_day}</p>
              </div>
            )}
          </div>
        )}

        {/* Night Muhasaba */}
        {muhasaba && (
          <div className="space-y-2 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg text-sm">
            <p className="font-medium text-indigo-700 dark:text-indigo-300">Night Muhasaba</p>
            <div className="space-y-1">
              <p><span className="text-muted-foreground">Right:</span> {muhasaba.what_went_right}</p>
              <p><span className="text-muted-foreground">Wrong:</span> {muhasaba.what_went_wrong}</p>
              <p><span className="text-muted-foreground">Fix Tomorrow:</span> {muhasaba.fix_tomorrow}</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Mentor Feedback */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Mentor Note (Visible to User)
            </Label>
            <Textarea
              value={mentorNote}
              onChange={(e) => setMentorNote(e.target.value)}
              placeholder="Write encouraging feedback or advice..."
              rows={2}
            />
            <Button 
              size="sm" 
              onClick={() => handleSendFeedback('public')}
              disabled={sending || !mentorNote.trim()}
            >
              <Send className="h-3 w-3 mr-1" />
              Send to User
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              Private Note (Admin Only)
            </Label>
            <Textarea
              value={privateNote}
              onChange={(e) => setPrivateNote(e.target.value)}
              placeholder="Private observations for your records..."
              rows={2}
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleSendFeedback('private')}
              disabled={sending || !privateNote.trim()}
            >
              <Send className="h-3 w-3 mr-1" />
              Save Private Note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

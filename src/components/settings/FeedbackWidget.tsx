import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

interface Feedback {
  id: string;
  feedback_type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
}

export default function FeedbackWidget() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [type, setType] = useState('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<Feedback[]>([]);
  const [_loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setFeedbackHistory((data || []) as Feedback[]);
    setLoadingHistory(false);
  };

  const handleSubmit = async () => {
    if (!user || !subject.trim() || !message.trim()) {
      toast.error(language === 'bn' ? 'সব ফিল্ড পূরণ করুন' : 'Please fill all fields');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('user_feedback').insert({
      user_id: user.id,
      feedback_type: type,
      subject: subject.trim(),
      message: message.trim(),
    });
    if (error) {
      toast.error(language === 'bn' ? 'ফিডব্যাক পাঠাতে ব্যর্থ' : 'Failed to send feedback');
    } else {
      toast.success(language === 'bn' ? 'ফিডব্যাক পাঠানো হয়েছে!' : 'Feedback sent!');
      setSubject('');
      setMessage('');
      fetchHistory();
    }
    setSending(false);
  };

  const typeLabels: Record<string, { en: string; bn: string }> = {
    bug: { en: 'Bug Report', bn: 'বাগ রিপোর্ট' },
    suggestion: { en: 'Suggestion', bn: 'পরামর্শ' },
    complaint: { en: 'Complaint', bn: 'অভিযোগ' },
    praise: { en: 'Praise', bn: 'প্রশংসা' },
  };

  const statusColors: Record<string, string> = {
    pending: 'secondary',
    reviewed: 'outline',
    resolved: 'default',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-subtitle flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {language === 'bn' ? 'ফিডব্যাক ও পরামর্শ' : 'Feedback & Suggestions'}
        </CardTitle>
        <CardDescription className="text-caption">
          {language === 'bn' ? 'আপনার মতামত আমাদের উন্নতিতে সাহায্য করে' : 'Your feedback helps us improve'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>{language === 'bn' ? 'ধরন' : 'Type'}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(typeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {language === 'bn' ? label.bn : label.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{language === 'bn' ? 'বিষয়' : 'Subject'}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={language === 'bn' ? 'সংক্ষেপে লিখুন' : 'Brief subject'}
            />
          </div>
          <div className="grid gap-2">
            <Label>{language === 'bn' ? 'বিস্তারিত' : 'Details'}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={language === 'bn' ? 'আপনার মতামত বিস্তারিত লিখুন...' : 'Describe your feedback in detail...'}
              rows={4}
            />
          </div>
          <Button onClick={handleSubmit} disabled={sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {language === 'bn' ? 'পাঠান' : 'Send Feedback'}
          </Button>
        </div>

        {/* History */}
        {feedbackHistory.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">{language === 'bn' ? 'আপনার ফিডব্যাক' : 'Your Feedback'}</p>
            {feedbackHistory.map((fb) => (
              <div key={fb.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fb.subject}</span>
                  <Badge variant={statusColors[fb.status] as any || 'secondary'} className="text-xs">
                    {fb.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{fb.message}</p>
                {fb.admin_reply && (
                  <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20">
                    <p className="text-xs font-medium text-primary flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {language === 'bn' ? 'এডমিন উত্তর' : 'Admin Response'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{fb.admin_reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

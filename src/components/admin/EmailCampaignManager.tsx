import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, Calendar, Users, Clock, CheckCircle, AlertCircle, FileText, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'inactive' | 'digest' | 'milestone' | 'custom';
}

interface ScheduledEmail {
  id: string;
  templateId: string;
  recipientCount: number;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'failed';
  segment: string;
}

export function EmailCampaignManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([
    {
      id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to Life OS! 🎯',
      body: `Assalamu Alaikum {{name}}!\n\nWelcome to Life OS - your personal Life Operating System.\n\nHere's how to get started:\n1. Set your daily intentions\n2. Track your Salah and Quran reading\n3. Monitor your progress\n\nMay Allah bless your journey towards becoming the best version of yourself.\n\nBest regards,\nThe Life OS Team`,
      type: 'welcome'
    },
    {
      id: 'inactive-7',
      name: '7-Day Inactive Reminder',
      subject: 'We miss you! Come back and continue your journey 🌟',
      body: `Assalamu Alaikum {{name}},\n\nIt's been 7 days since we last saw you on Life OS.\n\nYour streak was going strong - don't let it slip away!\n\nRemember, consistency is the key to transformation. Even small steps count.\n\nClick here to log today's progress: {{app_link}}\n\nMay Allah make it easy for you.\n\nBest regards,\nThe Life OS Team`,
      type: 'inactive'
    },
    {
      id: 'weekly-digest',
      name: 'Weekly Digest',
      subject: 'Your Weekly Progress Report 📊',
      body: `Assalamu Alaikum {{name}},\n\nHere's your weekly summary:\n\n📈 Days Logged: {{days_logged}}/7\n🔥 Current Streak: {{streak}} days\n⭐ Average Score: {{avg_score}}/5\n📖 Quran Days: {{quran_days}}\n🕌 Complete Salah Days: {{salah_days}}\n\nKeep up the great work!\n\nBest regards,\nThe Life OS Team`,
      type: 'digest'
    },
    {
      id: 'milestone',
      name: 'Milestone Achievement',
      subject: 'Congratulations on reaching {{milestone}}! 🏆',
      body: `Assalamu Alaikum {{name}},\n\nMashaAllah! You've reached a major milestone:\n\n🏆 {{milestone}}\n\nThis is a testament to your dedication and consistency.\n\nKeep going - the best is yet to come!\n\nBest regards,\nThe Life OS Team`,
      type: 'milestone'
    }
  ]);

  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body: '', type: 'custom' as const });
  const [targetSegment, setTargetSegment] = useState('all');
  const [scheduleDate, setScheduleDate] = useState('');
  const [isSending, setIsSending] = useState(false);

  const segments = [
    { id: 'all', name: 'All Users', count: 0 },
    { id: 'inactive-7', name: 'Inactive 7+ Days', count: 0 },
    { id: 'inactive-14', name: 'Inactive 14+ Days', count: 0 },
    { id: 'high-performers', name: 'High Performers', count: 0 },
    { id: 'struggling', name: 'Struggling Users', count: 0 },
    { id: 'new-users', name: 'New Users (< 7 days)', count: 0 }
  ];

  const saveTemplate = () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body) {
      toast.error('Please fill all fields');
      return;
    }

    const template: EmailTemplate = {
      id: `custom-${Date.now()}`,
      ...newTemplate
    };

    setTemplates(prev => [...prev, template]);
    setNewTemplate({ name: '', subject: '', body: '', type: 'custom' });
    setIsCreatingNew(false);
    toast.success('Template saved!');
  };

  const scheduleEmail = async () => {
    if (!selectedTemplate || !targetSegment) {
      toast.error('Please select a template and target segment');
      return;
    }

    setIsSending(true);
    try {
      // In production, this would call an edge function to schedule the email
      const scheduled: ScheduledEmail = {
        id: `sch-${Date.now()}`,
        templateId: selectedTemplate.id,
        recipientCount: Math.floor(Math.random() * 100) + 10,
        scheduledFor: scheduleDate || new Date().toISOString(),
        status: 'pending',
        segment: targetSegment
      };

      setScheduledEmails(prev => [...prev, scheduled]);
      toast.success('Email campaign scheduled!');
    } catch (error) {
      console.error('Error scheduling email:', error);
      toast.error('Failed to schedule email');
    } finally {
      setIsSending(false);
    }
  };

  const sendNow = async () => {
    if (!selectedTemplate || !targetSegment) {
      toast.error('Please select a template and target segment');
      return;
    }

    setIsSending(true);
    try {
      // In production, this would call an edge function to send immediately
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const sent: ScheduledEmail = {
        id: `sent-${Date.now()}`,
        templateId: selectedTemplate.id,
        recipientCount: Math.floor(Math.random() * 100) + 10,
        scheduledFor: new Date().toISOString(),
        status: 'sent',
        segment: targetSegment
      };

      setScheduledEmails(prev => [...prev, sent]);
      toast.success('Email campaign sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-500" />
          Email Campaign Manager
        </CardTitle>
        <CardDescription>
          Create and schedule email campaigns for user engagement
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="compose">
          <TabsList className="mb-4">
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label>Email Template</Label>
              <Select 
                value={selectedTemplate?.id || ''} 
                onValueChange={(v) => setSelectedTemplate(templates.find(t => t.id === v) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Segment */}
            <div className="space-y-2">
              <Label>Target Segment</Label>
              <Select value={targetSegment} onValueChange={setTargetSegment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {segments.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {selectedTemplate && (
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Preview
                </div>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Subject: </span>
                    <span className="font-medium">{selectedTemplate.subject}</span>
                  </p>
                  <div className="p-3 rounded bg-card border text-sm whitespace-pre-wrap">
                    {selectedTemplate.body}
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Options */}
            <div className="space-y-2">
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                onClick={sendNow} 
                disabled={!selectedTemplate || isSending}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Now
              </Button>
              <Button 
                variant="outline"
                onClick={scheduleEmail} 
                disabled={!selectedTemplate || !scheduleDate || isSending}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            {!isCreatingNew ? (
              <>
                <Button onClick={() => setIsCreatingNew(true)} className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Create New Template
                </Button>

                <div className="space-y-2">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-xs text-muted-foreground">{template.subject}</p>
                        </div>
                        <Badge variant="outline">{template.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <Input
                  placeholder="Template Name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="Email Subject"
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
                />
                <Textarea
                  placeholder="Email Body (use {{name}}, {{streak}}, etc. for personalization)"
                  rows={8}
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, body: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button onClick={saveTemplate} className="flex-1">
                    Save Template
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreatingNew(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-4">
            {scheduledEmails.length > 0 ? (
              <div className="space-y-2">
                {scheduledEmails.map(email => (
                  <div
                    key={email.id}
                    className="p-3 rounded-lg border bg-card flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">
                          {templates.find(t => t.id === email.templateId)?.name || 'Unknown'}
                        </h4>
                        <Badge variant={email.status === 'sent' ? 'default' : email.status === 'pending' ? 'secondary' : 'destructive'}>
                          {email.status === 'sent' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {email.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {email.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {email.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {email.recipientCount} recipients • {segments.find(s => s.id === email.segment)?.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(email.scheduledFor), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No scheduled emails yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Shield, Users, AlertTriangle, MessageSquare, BarChart3, 
  TrendingUp, BookOpen, Smartphone, Lock, Unlock, Send
} from 'lucide-react';

interface UserProfile {
  user_id: string;
  full_name: string;
  avatar_url: string;
}

interface UserScore {
  user_id: string;
  deen_score: number;
  discipline_score: number;
  focus_score: number;
  productivity_score: number;
  study_streak: number;
  salah_streak: number;
  quran_streak: number;
}

interface AdminAlert {
  id: string;
  user_id: string;
  alert_type: string;
  message: string;
  severity: string;
  is_resolved: boolean;
  created_at: string;
}

export default function AdminCommand() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userScores, setUserScores] = useState<Map<string, UserScore>>(new Map());
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState('daily');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, [user]);

  const checkAdminAndLoad = async () => {
    if (!user) return;
    try {
      const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id });
      const admin = roleData === 'admin';
      setIsAdmin(admin);
      
      if (admin) {
        await Promise.all([fetchUsers(), fetchAlerts()]);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url');

      if (error) throw error;
      setUsers((profiles || []) as UserProfile[]);

      // Fetch scores for all users
      const { data: scores } = await supabase
        .from('user_scores')
        .select('*')
        .eq('date', format(new Date(), 'yyyy-MM-dd'));

      if (scores) {
        const scoresMap = new Map<string, UserScore>();
        scores.forEach((s: UserScore) => scoresMap.set(s.user_id, s));
        setUserScores(scoresMap);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_alerts')
        .select('*')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts((data || []) as AdminAlert[]);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const sendFeedback = async () => {
    if (!selectedUser || !feedbackMessage.trim()) {
      toast.error('Please select a user and enter a message');
      return;
    }

    setSending(true);
    try {
      // Insert feedback with required date field
      const { error } = await supabase
        .from('admin_feedback')
        .insert({
          user_id: selectedUser,
          admin_id: user?.id,
          feedback_type: feedbackType,
          message: feedbackMessage,
          is_private: feedbackType !== 'motivation',
          date: format(new Date(), 'yyyy-MM-dd'),
        });

      if (error) throw error;
      
      // Send notification to user
      const feedbackTypeLabels: Record<string, string> = {
        daily: '📋 Daily Feedback',
        weekly: '📊 Weekly Advice',
        motivation: '💪 Motivation',
        advice: '💡 Advice'
      };
      
      await supabase.from('notifications').insert({
        user_id: selectedUser,
        title: feedbackTypeLabels[feedbackType] || 'Admin Feedback',
        message: feedbackMessage,
        type: 'admin_feedback',
        metadata: { feedback_type: feedbackType },
      });
      
      toast.success('Feedback sent successfully!');
      setFeedbackMessage('');
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  const sendNotificationToAll = async () => {
    if (!feedbackMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const feedbackTypeLabels: Record<string, string> = {
        daily: '📋 ঘোষণা',
        weekly: '📊 সাপ্তাহিক আপডেট',
        motivation: '💪 অনুপ্রেরণা',
        advice: '💡 পরামর্শ'
      };

      // Insert notification for all users
      const notifications = users.map(u => ({
        user_id: u.user_id,
        title: feedbackTypeLabels[feedbackType] || 'Notification',
        message: feedbackMessage,
        type: 'admin_broadcast',
        metadata: { feedback_type: feedbackType },
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;

      toast.success(`সব ${users.length} জন ইউজারকে নোটিফিকেশন পাঠানো হয়েছে!`);
      setFeedbackMessage('');
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await supabase
        .from('admin_alerts')
        .update({ is_resolved: true, resolved_by: user?.id, resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert resolved');
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const unlockDay = async (userId: string, date: string) => {
    try {
      await supabase
        .from('daily_entries')
        .update({ is_locked: false, locked_at: null })
        .eq('user_id', userId)
        .eq('date', date);

      toast.success('Day unlocked for user');
    } catch (error) {
      console.error('Error unlocking day:', error);
      toast.error('Failed to unlock day');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-muted-foreground">You don't have permission to access this area.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Command Center</h1>
            <p className="text-muted-foreground">God Mode - Full Access</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="alerts">Alerts ({alerts.length})</TabsTrigger>
            <TabsTrigger value="mentor">Mentoring</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{users.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Active Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-destructive">{alerts.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Avg Deen Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    {userScores.size > 0
                      ? Math.round(Array.from(userScores.values()).reduce((sum, s) => sum + (s.deen_score || 0), 0) / userScores.size)
                      : 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Avg Discipline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-secondary">
                    {userScores.size > 0
                      ? Math.round(Array.from(userScores.values()).reduce((sum, s) => sum + (s.discipline_score || 0), 0) / userScores.size)
                      : 0}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="grid gap-4">
              {users.map((profile) => {
                const scores = userScores.get(profile.user_id);
                return (
                  <Card key={profile.user_id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            {profile.full_name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{profile.full_name || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground">{profile.user_id.slice(0, 8)}...</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {scores && (
                            <div className="grid grid-cols-4 gap-2 text-center text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Deen</p>
                                <p className="font-bold text-primary">{scores.deen_score}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Discipline</p>
                                <p className="font-bold">{scores.discipline_score}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Focus</p>
                                <p className="font-bold">{scores.focus_score}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Streaks</p>
                                <p className="font-bold text-secondary">{scores.salah_streak || 0}🕌</p>
                              </div>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(profile.user_id)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            {alerts.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active alerts</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Card key={alert.id} className={`border-l-4 ${
                    alert.severity === 'critical' ? 'border-l-destructive' :
                    alert.severity === 'high' ? 'border-l-orange-500' :
                    alert.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'secondary'}>
                            {alert.alert_type}
                          </Badge>
                          <p className="mt-2">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => resolveAlert(alert.id)}>
                          Resolve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Mentoring Tab */}
          <TabsContent value="mentor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Send Feedback to User
                </CardTitle>
                <CardDescription>Send daily feedback, weekly advice, or motivation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select User</label>
                    <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name || u.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Feedback Type</label>
                    <Select value={feedbackType} onValueChange={setFeedbackType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily Feedback</SelectItem>
                        <SelectItem value="weekly">Weekly Advice</SelectItem>
                        <SelectItem value="motivation">Motivation Message</SelectItem>
                        <SelectItem value="advice">Private Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Write your message here..."
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button onClick={sendFeedback} disabled={sending || !selectedUser}>
                    {sending ? 'Sending...' : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send to User
                      </>
                    )}
                  </Button>
                  <Button onClick={sendNotificationToAll} disabled={sending} variant="secondary">
                    {sending ? 'Sending...' : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send to All ({users.length})
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Bell, 
  Send, 
  Users, 
  User, 
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Loader2,
  Search,
  RefreshCw,
  Zap,
  Calendar,
  Clock
} from 'lucide-react';
import AutoNotificationSystem from '@/components/admin/AutoNotificationSystem';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  notifications_enabled: boolean | null;
}

interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean | null;
  created_at: string;
}

export default function AdminNotifications() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState('info');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, notifications_enabled')
        .order('full_name', { ascending: true });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch recent notifications (last 50)
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsError) throw notificationsError;
      setRecentNotifications(notificationsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please fill in title and message');
      return;
    }

    if (targetType === 'specific' && !selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setSending(true);
    try {
      if (targetType === 'all') {
        // Send to all users with notifications enabled
        const enabledUsers = users.filter(u => u.notifications_enabled !== false);
        
        if (enabledUsers.length === 0) {
          toast.error('No users have notifications enabled');
          setSending(false);
          return;
        }

        const notifications = enabledUsers.map(u => ({
          user_id: u.user_id,
          title: title.trim(),
          message: message.trim(),
          type: notificationType,
          is_read: false,
        }));

        const { error } = await supabase
          .from('notifications')
          .insert(notifications);

        if (error) throw error;
        
        if (isScheduled && scheduledDate && scheduledTime) {
          toast.success(`Notification scheduled for ${scheduledDate} at ${scheduledTime}`);
        } else {
          toast.success(`Notification sent to ${enabledUsers.length} users`);
        }
      } else {
        // Send to specific user
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: selectedUserId,
            title: title.trim(),
            message: message.trim(),
            type: notificationType,
            is_read: false,
          });

        if (error) throw error;
        const targetUser = users.find(u => u.user_id === selectedUserId);
        toast.success(`Notification sent to ${targetUser?.full_name || 'user'}`);
      }

      // Reset form
      setTitle('');
      setMessage('');
      setNotificationType('info');
      setSelectedUserId('');
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
      
      // Refresh notifications list
      fetchData();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification', {
        description: error?.message || 'Unknown error',
      });
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-500/20 text-green-500';
      case 'warning': return 'bg-yellow-500/20 text-yellow-500';
      case 'error': return 'bg-red-500/20 text-red-500';
      case 'encouragement': return 'bg-purple-500/20 text-purple-500';
      case 'reminder': return 'bg-blue-500/20 text-blue-500';
      case 'achievement': return 'bg-amber-500/20 text-amber-500';
      default: return 'bg-primary/20 text-primary';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Notification Center</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Send notifications to users via browser push and in-app alerts
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Tabs for Manual vs Auto */}
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:max-w-md">
            <TabsTrigger value="manual" className="flex items-center gap-2 text-xs sm:text-sm">
              <Send className="h-4 w-4" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="auto" className="flex items-center gap-2 text-xs sm:text-sm">
              <Zap className="h-4 w-4" />
              Automated
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4 sm:mt-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Send Notification Form */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4 text-primary" />
                    Send Notification
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Compose and send notifications to users
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-4">
                  {/* Target Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Send To</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={targetType === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTargetType('all')}
                        className="text-xs h-9"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        All Users
                      </Button>
                      <Button
                        type="button"
                        variant={targetType === 'specific' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTargetType('specific')}
                        className="text-xs h-9"
                      >
                        <User className="h-3 w-3 mr-1" />
                        Specific User
                      </Button>
                    </div>
                  </div>

                  {/* User Selection (if specific) */}
                  {targetType === 'specific' && (
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Select User</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 h-9 text-sm"
                        />
                      </div>
                      <ScrollArea className="h-32 rounded-xl border">
                        <div className="p-2 space-y-1">
                          {filteredUsers.map((u) => (
                            <button
                              key={u.user_id}
                              onClick={() => setSelectedUserId(u.user_id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                                selectedUserId === u.user_id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <div className="font-medium truncate">{u.full_name || `User ${u.user_id.slice(0, 6)}`}</div>
                            </button>
                          ))}
                          {filteredUsers.length === 0 && (
                            <p className="text-center text-muted-foreground text-xs py-4">
                              No users found
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Notification Type */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Notification Type</Label>
                    <Select value={notificationType} onValueChange={setNotificationType}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">ℹ️ Info</SelectItem>
                        <SelectItem value="success">✅ Success</SelectItem>
                        <SelectItem value="warning">⚠️ Warning</SelectItem>
                        <SelectItem value="error">❌ Error</SelectItem>
                        <SelectItem value="encouragement">💪 Encouragement</SelectItem>
                        <SelectItem value="reminder">🔔 Reminder</SelectItem>
                        <SelectItem value="achievement">🏆 Achievement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Title</Label>
                    <Input
                      placeholder="Enter notification title..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Message</Label>
                    <Textarea
                      placeholder="Enter notification message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      maxLength={500}
                      className="text-sm resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">
                      {message.length}/500
                    </p>
                  </div>

                  {/* Schedule Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm font-medium">Schedule for later</span>
                    </div>
                    <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
                  </div>

                  {/* Schedule Date/Time */}
                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="h-9 text-sm"
                          min={format(new Date(), 'yyyy-MM-dd')}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Time</Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Send Button */}
                  <Button 
                    onClick={sendNotification} 
                    disabled={sending || !title.trim() || !message.trim()}
                    className="w-full h-10"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : isScheduled ? (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Schedule Notification
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Now
                      </>
                    )}
                  </Button>

                  {/* Info */}
                  <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        {targetType === 'all' 
                          ? `Will send to ${users.filter(u => u.notifications_enabled !== false).length} users with notifications enabled`
                          : selectedUserId 
                            ? `Will send to: ${users.find(u => u.user_id === selectedUserId)?.full_name || 'Selected user'}`
                            : 'Select a user to send notification'}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Notifications */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Recent Notifications
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Last 50 notifications sent
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <ScrollArea className="h-[400px] sm:h-[500px]">
                    <div className="space-y-2">
                      {recentNotifications.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">
                          No notifications sent yet
                        </p>
                      ) : (
                        recentNotifications.map((n) => {
                          const targetUser = users.find(u => u.user_id === n.user_id);
                          return (
                            <div key={n.id} className="p-3 rounded-xl bg-muted/30 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-xs sm:text-sm truncate">{n.title}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                    To: {targetUser?.full_name || n.user_id.slice(0, 8)}
                                  </p>
                                </div>
                                <Badge className={`${getNotificationTypeColor(n.type)} text-[10px] shrink-0`}>
                                  {n.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{new Date(n.created_at).toLocaleString()}</span>
                                <span className="flex items-center gap-1">
                                  {n.is_read ? (
                                    <><CheckCircle2 className="h-3 w-3 text-green-500" /> Read</>
                                  ) : (
                                    <><AlertCircle className="h-3 w-3 text-yellow-500" /> Unread</>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* User Stats */}
            <Card className="mt-4">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  User Notification Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div className="text-center p-3 rounded-xl bg-muted/30">
                    <p className="text-xl sm:text-2xl font-bold">{users.length}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Total Users</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-green-500/10">
                    <p className="text-xl sm:text-2xl font-bold text-green-500">
                      {users.filter(u => u.notifications_enabled === true).length}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Enabled</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-yellow-500/10">
                    <p className="text-xl sm:text-2xl font-bold text-yellow-500">
                      {users.filter(u => u.notifications_enabled === null).length}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-red-500/10">
                    <p className="text-xl sm:text-2xl font-bold text-red-500">
                      {users.filter(u => u.notifications_enabled === false).length}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Disabled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auto" className="mt-4 sm:mt-6">
            <AutoNotificationSystem />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

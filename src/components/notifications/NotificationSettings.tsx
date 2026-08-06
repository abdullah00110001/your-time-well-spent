import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, BellRing, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationSettings() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { permissionStatus, requestPermission, disableNotifications } = useNotifications();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('notifications_enabled')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setNotificationsEnabled(data.notifications_enabled || false);
    }
    setLoading(false);
  };

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestPermission();
      if (granted) {
        setNotificationsEnabled(true);
      }
    } else {
      await disableNotifications();
      setNotificationsEnabled(false);
    }
  };

  const testNotification = () => {
    if (permissionStatus !== 'granted') {
      toast.error(language === 'bn' ? 'প্রথমে নোটিফিকেশন চালু করুন' : 'Enable notifications first');
      return;
    }

    // Show a test browser notification
    new Notification(language === 'bn' ? 'টেস্ট নোটিফিকেশন' : 'Test Notification', {
      body: language === 'bn' ? 'নোটিফিকেশন সঠিকভাবে কাজ করছে!' : 'Notifications are working correctly!',
      icon: '/favicon.svg',
    });

    toast.success(language === 'bn' ? 'টেস্ট নোটিফিকেশন পাঠানো হয়েছে' : 'Test notification sent');
  };

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {language === 'bn' ? 'অনুমোদিত' : 'Granted'}
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {language === 'bn' ? 'প্রত্যাখ্যাত' : 'Denied'}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {language === 'bn' ? 'জিজ্ঞাসা করা হয়নি' : 'Not Asked'}
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-subtitle flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {language === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
        </CardTitle>
        <CardDescription className="text-caption">
          {language === 'bn' 
            ? 'ব্রাউজার নোটিফিকেশন সেটিংস পরিচালনা করুন' 
            : 'Manage browser notification settings'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Browser Permission Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {permissionStatus === 'granted' ? (
              <BellRing className="h-5 w-5 text-green-500" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {language === 'bn' ? 'ব্রাউজার অনুমতি' : 'Browser Permission'}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'bn' 
                  ? 'ব্রাউজার নোটিফিকেশন পাঠানোর অনুমতি' 
                  : 'Permission to send browser notifications'}
              </p>
            </div>
          </div>
          {getPermissionBadge()}
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-toggle" className="text-sm font-medium">
              {language === 'bn' ? 'নোটিফিকেশন চালু' : 'Enable Notifications'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {language === 'bn' 
                ? 'মেন্টর ফিডব্যাক এবং রিমাইন্ডার পান' 
                : 'Receive mentor feedback and reminders'}
            </p>
          </div>
          <Switch
            id="notifications-toggle"
            checked={notificationsEnabled && permissionStatus === 'granted'}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        </div>

        {/* Permission Denied Warning */}
        {permissionStatus === 'denied' && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              {language === 'bn' 
                ? 'নোটিফিকেশন ব্লক করা আছে। ব্রাউজার সেটিংস থেকে অনুমতি দিন।' 
                : 'Notifications are blocked. Please enable them in your browser settings.'}
            </p>
          </div>
        )}

        {/* Test Notification Button */}
        {permissionStatus === 'granted' && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={testNotification}
            className="w-full sm:w-auto"
          >
            <BellRing className="h-4 w-4 mr-2" />
            {language === 'bn' ? 'টেস্ট নোটিফিকেশন' : 'Test Notification'}
          </Button>
        )}

        {/* Request Permission Button */}
        {permissionStatus === 'default' && (
          <Button 
            onClick={() => requestPermission()}
            className="w-full sm:w-auto"
          >
            <Bell className="h-4 w-4 mr-2" />
            {language === 'bn' ? 'অনুমতি দিন' : 'Grant Permission'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellRing, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PushNotificationPromptProps {
  className?: string;
  variant?: 'banner' | 'card' | 'minimal';
}

export default function PushNotificationPrompt({ 
  className, 
  variant = 'card' 
}: PushNotificationPromptProps) {
  const { language } = useLanguage();
  const { permissionStatus, registerPush } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('notification_prompt_dismissed');
    if (wasDismissed) setDismissed(true);
  }, []);

  // Don't show if already granted or dismissed
  if (permissionStatus === 'granted' || dismissed || enabled) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem('notification_prompt_dismissed', 'true');
    setDismissed(true);
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      await registerPush();
      setEnabled(true);
    } finally {
      setLoading(false);
    }
  };

  const content = {
    title: language === 'bn' ? 'নোটিফিকেশন চালু করুন' : 'Enable Notifications',
    description: language === 'bn' 
      ? 'প্রার্থনার সময়, অভ্যাস রিমাইন্ডার এবং মেন্টর বার্তার জন্য রিয়েল-টাইম আপডেট পান'
      : 'Get real-time reminders for prayers, habits, and mentor messages',
    enable: language === 'bn' ? 'চালু করুন' : 'Enable',
    notNow: language === 'bn' ? 'পরে' : 'Not now',
  };

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEnable}
          disabled={loading}
          className="gap-2"
        >
          <BellRing className="h-4 w-4" />
          {content.enable}
        </Button>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={cn(
        'bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3',
        className
      )}>
        <div className="p-2 bg-primary/20 rounded-full shrink-0">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{content.title}</p>
          <p className="text-xs text-muted-foreground truncate">{content.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={loading}
            className="h-8"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              content.enable
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-primary/20 rounded-full shrink-0">
            <BellRing className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">{content.title}</h4>
            <p className="text-xs text-muted-foreground mb-3">{content.description}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleEnable}
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {content.enable}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
              >
                {content.notNow}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

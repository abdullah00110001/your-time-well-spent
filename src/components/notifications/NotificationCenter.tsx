import { useState } from 'react';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck, 
  Trash2, 
  MessageCircle,
  Award,
  AlertCircle,
  Sparkles,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'feedback':
      return MessageCircle;
    case 'achievement':
      return Award;
    case 'reminder':
      return AlertCircle;
    default:
      return Sparkles;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'feedback':
      return 'text-blue-500';
    case 'achievement':
      return 'text-yellow-500';
    case 'reminder':
      return 'text-orange-500';
    default:
      return 'text-primary';
  }
};

export default function NotificationCenter() {
  const { language } = useLanguage();
  const {
    notifications,
    unreadCount,
    loading,
    permissionStatus,
    requestPermission,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleEnableNotifications = async () => {
    await requestPermission();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 sm:w-96 p-0" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">
            {language === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
          </h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                {language === 'bn' ? 'সব পড়া' : 'Mark all read'}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearAll}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Permission Banner */}
        {permissionStatus !== 'granted' && (
          <div className="p-3 bg-muted/50 border-b">
            <div className="flex items-start gap-2">
              <BellOff className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">
                  {language === 'bn' 
                    ? 'ব্রাউজার নোটিফিকেশন বন্ধ আছে' 
                    : 'Browser notifications are off'}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={handleEnableNotifications}
                >
                  {language === 'bn' ? 'চালু করুন' : 'Enable now'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                {language === 'bn' ? 'কোনো নোটিফিকেশন নেই' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const iconColor = getNotificationColor(notification.type);
                
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-3 hover:bg-muted/50 transition-colors relative group',
                      !notification.is_read && 'bg-primary/5'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn('p-1.5 rounded-full bg-muted shrink-0', iconColor)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            'text-sm font-medium truncate',
                            !notification.is_read && 'text-foreground',
                            notification.is_read && 'text-muted-foreground'
                          )}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    {/* Actions on hover */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

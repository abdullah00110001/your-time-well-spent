import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean | null;
  created_at: string;
  metadata?: unknown;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const [loading, setLoading] = useState(true);

  // Check browser notification permission (web only)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermissionStatus(Notification.permission);
      }
    } catch {
      // Notification API not available (e.g., Capacitor WebView)
    }
  }, []);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      setNotifications((data as AppNotification[]) || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [user, fetchNotifications]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            try {
              const newNotification = payload.new as AppNotification;
              setNotifications((prev) => [newNotification, ...prev].slice(0, 20));
              setUnreadCount((prev) => prev + 1);
              
              // Show browser notification (web only, safe)
              showBrowserNotification(newNotification.title, newNotification.message);
              
              // Always show in-app toast
              toast(newNotification.title, {
                description: newNotification.message?.slice(0, 100),
                duration: 6000,
              });
            } catch (e) {
              console.error('[Notifications] Realtime handler error:', e);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[Notifications] Realtime channel error, will retry...');
          }
        });
    } catch (e) {
      console.error('[Notifications] Channel setup error:', e);
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [user]);

  // Request browser notification permission
  const requestPermission = async (): Promise<boolean> => {
    try {
      if (!('Notification' in window)) {
        toast.error('This browser does not support notifications');
        return false;
      }

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        if (user) {
          try {
            await supabase
              .from('profiles')
              .update({ notifications_enabled: true } as any)
              .eq('user_id', user.id);
          } catch {}
        }
        toast.success('Notifications enabled!');
        return true;
      } else if (permission === 'denied') {
        toast.error('Notification permission denied');
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  // Show browser notification (safe for all environments)
  const showBrowserNotification = (title: string, body: string, icon?: string) => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      
      // Try service worker first (works in background tabs)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body,
            icon: icon || '/lifeos-logo-light.png',
            tag: `oporajeyo-${Date.now()}`,
          });
        }).catch(() => {
          fallbackNotification(title, body, icon);
        });
      } else {
        fallbackNotification(title, body, icon);
      }
    } catch {
      // Silently fail - notification display is not critical
    }
  };

  const fallbackNotification = (title: string, body: string, icon?: string) => {
    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/lifeos-logo-light.png',
        tag: `oporajeyo-${Date.now()}`,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Silently fail
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Disable notifications
  const disableNotifications = async () => {
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ notifications_enabled: false } as any)
          .eq('user_id', user.id);
      } catch {}
    }
    toast.success('Notifications disabled');
  };

  return {
    notifications,
    unreadCount,
    loading,
    permissionStatus,
    requestPermission,
    showBrowserNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    disableNotifications,
    refetch: fetchNotifications,
  };
}

// Utility function to send notification to a user (for admin use)
export async function sendNotificationToUser(
  userId: string,
  title: string,
  message: string,
  type: string = 'general',
  metadata: Record<string, any> = {}
) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type,
      metadata,
    });

  if (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

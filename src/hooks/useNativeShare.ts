import { useCallback, useState } from 'react';
import {
  canShare,
  share,
  shareAchievement,
  shareProgress,
  shareChallenge,
  shareVia,
  openUrl,
  openInAppBrowser
} from '@/lib/capacitor/nativeShare';
import { Feedback } from '@/lib/capacitor/nativeHaptics';
import { toast } from 'sonner';

export function useNativeShare() {
  const [isSharing, setIsSharing] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState<boolean | null>(null);

  // Check sharing capability
  const checkCanShare = useCallback(async () => {
    const available = await canShare();
    setCanNativeShare(available);
    return available;
  }, []);

  // Generic share
  const shareContent = useCallback(async (options: {
    title?: string;
    text?: string;
    url?: string;
  }) => {
    setIsSharing(true);
    try {
      const result = await share(options);
      if (result) {
        Feedback.success();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Share] Failed:', error);
      Feedback.error();
      toast.error('Failed to share');
      return false;
    } finally {
      setIsSharing(false);
    }
  }, []);

  // Share an achievement
  const shareUserAchievement = useCallback(async (
    title: string,
    description: string,
    appUrl?: string
  ) => {
    setIsSharing(true);
    try {
      const result = await shareAchievement({ title, description, appUrl });
      if (result) {
        Feedback.success();
        toast.success('Achievement shared!');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Share] Achievement share failed:', error);
      Feedback.error();
      return false;
    } finally {
      setIsSharing(false);
    }
  }, []);

  // Share streak/progress
  const shareUserProgress = useCallback(async (
    days: number,
    metric: string,
    appUrl?: string
  ) => {
    setIsSharing(true);
    try {
      const result = await shareProgress({ days, metric, appUrl });
      if (result) {
        Feedback.success();
        toast.success('Progress shared!');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Share] Progress share failed:', error);
      Feedback.error();
      return false;
    } finally {
      setIsSharing(false);
    }
  }, []);

  // Share a challenge
  const shareUserChallenge = useCallback(async (
    name: string,
    description: string,
    joinUrl?: string
  ) => {
    setIsSharing(true);
    try {
      const result = await shareChallenge({ name, description, joinUrl });
      if (result) {
        Feedback.success();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Share] Challenge share failed:', error);
      Feedback.error();
      return false;
    } finally {
      setIsSharing(false);
    }
  }, []);

  // Share via specific platform
  const shareToPlatform = useCallback(async (
    platform: 'whatsapp' | 'telegram' | 'twitter' | 'facebook' | 'email',
    content: { title?: string; text?: string; url?: string }
  ) => {
    try {
      Feedback.tap();
      await shareVia(platform, content);
    } catch (error) {
      console.error(`[Share] ${platform} share failed:`, error);
      Feedback.error();
    }
  }, []);

  // Open external URL
  const openExternalUrl = useCallback(async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error('[Share] Open URL failed:', error);
      window.open(url, '_blank');
    }
  }, []);

  // Open in-app browser
  const openBrowser = useCallback(async (url: string, options?: {
    toolbarColor?: string;
  }) => {
    try {
      await openInAppBrowser(url, options);
    } catch (error) {
      console.error('[Share] Open browser failed:', error);
      window.open(url, '_blank');
    }
  }, []);

  return {
    isSharing,
    canNativeShare,
    checkCanShare,
    shareContent,
    shareUserAchievement,
    shareUserProgress,
    shareUserChallenge,
    shareToPlatform,
    openExternalUrl,
    openBrowser,
  };
}

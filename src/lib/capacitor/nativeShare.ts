// Native Share Bridge for Capacitor
import { Share, ShareOptions, ShareResult } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { isNative } from './platform';

// Check if sharing is available
export async function canShare(): Promise<boolean> {
  if (!isNative) {
    return 'share' in navigator;
  }
  
  try {
    const result = await Share.canShare();
    return result.value;
  } catch {
    return false;
  }
}

// Share content
export async function share(options: {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}): Promise<ShareResult | null> {
  try {
    const shareOptions: ShareOptions = {
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: options.dialogTitle,
    };
    
    if (!isNative) {
      // Web fallback
      const nav = navigator as any;
      if ('share' in nav) {
        await nav.share({
          title: options.title,
          text: options.text,
          url: options.url,
        });
        return { activityType: 'web' };
      }
      
      // Clipboard fallback
      const textToCopy = options.url || options.text || options.title || '';
      if (nav.clipboard && nav.clipboard.writeText) {
        await nav.clipboard.writeText(textToCopy);
      }
      return { activityType: 'clipboard' };
    }
    
    return await Share.share(shareOptions);
  } catch (error: any) {
    if (error?.message?.includes('cancelled') || error?.message?.includes('abort')) {
      console.log('[Share] User cancelled');
      return null;
    }
    console.error('[Share] Failed:', error);
    throw error;
  }
}

// Share achievement/milestone
export async function shareAchievement(achievement: {
  title: string;
  description: string;
  appUrl?: string;
}): Promise<ShareResult | null> {
  const text = `🏆 ${achievement.title}\n\n${achievement.description}\n\nTracking my progress with Life OS!`;
  
  return share({
    title: achievement.title,
    text,
    url: achievement.appUrl,
    dialogTitle: 'Share Achievement',
  });
}

// Share progress/streak
export async function shareProgress(progress: {
  days: number;
  metric: string;
  appUrl?: string;
}): Promise<ShareResult | null> {
  const text = `🔥 ${progress.days} day streak!\n\nI've been consistent with ${progress.metric} for ${progress.days} days straight! 💪\n\nTracking my journey with Life OS.`;
  
  return share({
    title: `${progress.days} Day Streak`,
    text,
    url: progress.appUrl,
    dialogTitle: 'Share Your Progress',
  });
}

// Share challenge
export async function shareChallenge(challenge: {
  name: string;
  description: string;
  joinUrl?: string;
}): Promise<ShareResult | null> {
  const text = `🎯 Join me in the "${challenge.name}" challenge!\n\n${challenge.description}\n\nLet's grow together!`;
  
  return share({
    title: `Join: ${challenge.name}`,
    text,
    url: challenge.joinUrl,
    dialogTitle: 'Share Challenge',
  });
}

// Share via specific method
export async function shareVia(
  platform: 'whatsapp' | 'telegram' | 'twitter' | 'facebook' | 'email',
  content: { title?: string; text?: string; url?: string }
): Promise<void> {
  const text = encodeURIComponent(content.text || '');
  const url = encodeURIComponent(content.url || '');
  const title = encodeURIComponent(content.title || '');
  
  let shareUrl = '';
  
  switch (platform) {
    case 'whatsapp':
      shareUrl = `https://wa.me/?text=${text}%20${url}`;
      break;
    case 'telegram':
      shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
      break;
    case 'twitter':
      shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
      break;
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`;
      break;
    case 'email':
      shareUrl = `mailto:?subject=${title}&body=${text}%20${url}`;
      break;
  }
  
  if (shareUrl) {
    await openUrl(shareUrl);
  }
}

// Open external URL
export async function openUrl(url: string): Promise<void> {
  if (!isNative) {
    window.open(url, '_blank');
    return;
  }
  
  try {
    await Browser.open({ url });
  } catch (error) {
    console.error('[Browser] Open URL failed:', error);
    window.open(url, '_blank');
  }
}

// Open in-app browser
export async function openInAppBrowser(
  url: string,
  options?: {
    toolbarColor?: string;
    presentationStyle?: 'fullscreen' | 'popover';
  }
): Promise<void> {
  if (!isNative) {
    window.open(url, '_blank');
    return;
  }
  
  try {
    await Browser.open({
      url,
      toolbarColor: options?.toolbarColor,
      presentationStyle: options?.presentationStyle,
    });
  } catch (error) {
    console.error('[Browser] Open in-app browser failed:', error);
    window.open(url, '_blank');
  }
}

// Close in-app browser
export async function closeInAppBrowser(): Promise<void> {
  if (!isNative) return;
  
  try {
    await Browser.close();
  } catch (error) {
    console.error('[Browser] Close failed:', error);
  }
}

import { Share2, Twitter, Facebook, MessageCircle, Send, Mail, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNativeShare } from '@/hooks/useNativeShare';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ShareSheetProps {
  content: {
    title?: string;
    text?: string;
    url?: string;
  };
  trigger?: React.ReactNode;
  className?: string;
}

export function ShareSheet({
  content,
  trigger,
  className,
}: ShareSheetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { shareContent, shareToPlatform, isSharing } = useNativeShare();
  const { tap } = useNativeHaptics();

  const handleNativeShare = async () => {
    tap();
    const success = await shareContent(content);
    if (success) {
      setOpen(false);
    }
  };

  const handlePlatformShare = async (platform: 'whatsapp' | 'telegram' | 'twitter' | 'facebook' | 'email') => {
    tap();
    await shareToPlatform(platform, content);
    setOpen(false);
  };

  const handleCopy = async () => {
    tap();
    const textToCopy = content.url || content.text || content.title || '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const platforms = [
    { id: 'whatsapp' as const, icon: MessageCircle, label: 'WhatsApp', color: 'bg-green-500' },
    { id: 'telegram' as const, icon: Send, label: 'Telegram', color: 'bg-blue-500' },
    { id: 'twitter' as const, icon: Twitter, label: 'Twitter', color: 'bg-sky-500' },
    { id: 'facebook' as const, icon: Facebook, label: 'Facebook', color: 'bg-blue-600' },
    { id: 'email' as const, icon: Mail, label: 'Email', color: 'bg-gray-500' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" className={className}>
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Preview */}
          {content.title && (
            <div className="mb-4 p-3 rounded-xl bg-muted/50">
              <p className="font-medium text-sm line-clamp-2">{content.title}</p>
              {content.text && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{content.text}</p>
              )}
              {content.url && (
                <p className="text-xs text-primary mt-1 truncate">{content.url}</p>
              )}
            </div>
          )}

          {/* Native Share Button */}
          <Button
            onClick={handleNativeShare}
            disabled={isSharing}
            className="w-full mb-4"
          >
            <Share2 className="h-4 w-4 mr-2" />
            {isSharing ? 'Sharing...' : 'Share'}
          </Button>

          {/* Platform Icons */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handlePlatformShare(platform.id)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl',
                  'transition-all active:scale-95'
                )}
              >
                <div className={cn(
                  'p-3 rounded-full text-white',
                  platform.color
                )}>
                  <platform.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] text-muted-foreground">{platform.label}</span>
              </button>
            ))}
          </div>

          {/* Copy Link */}
          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

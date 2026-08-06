import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Share2, Download, Copy, Check, Flame, Trophy, Target, Star } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/contexts/AppModeContext';

interface ShareCardProps {
  type: 'streak' | 'badge' | 'challenge' | 'milestone';
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
}

export function ShareCard({ type, title, value, subtitle, icon }: ShareCardProps) {
  const { user } = useAuth();
  const { mode } = useAppMode();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getTypeIcon = () => {
    switch (type) {
      case 'streak': return <Flame className="h-8 w-8 text-orange-500" />;
      case 'badge': return <Trophy className="h-8 w-8 text-amber-500" />;
      case 'challenge': return <Target className="h-8 w-8 text-blue-500" />;
      case 'milestone': return <Star className="h-8 w-8 text-purple-500" />;
    }
  };

  const getGradient = () => {
    if (mode === 'islamic') {
      return 'from-emerald-500 via-teal-500 to-cyan-500';
    }
    switch (type) {
      case 'streak': return 'from-orange-500 via-red-500 to-pink-500';
      case 'badge': return 'from-amber-500 via-yellow-500 to-orange-500';
      case 'challenge': return 'from-blue-500 via-indigo-500 to-purple-500';
      case 'milestone': return 'from-purple-500 via-pink-500 to-rose-500';
    }
  };

  const logShare = async (platform: string) => {
    if (!user) return;
    
    try {
      await supabase.from('shared_achievements').insert({
        user_id: user.id,
        achievement_type: type,
        achievement_data: { title, value, subtitle },
        platform
      });
    } catch (error) {
      console.error('Error logging share:', error);
    }
  };

  const shareText = `🎉 ${title}: ${value}${subtitle ? ` - ${subtitle}` : ''}\n\nTracking my progress with Life OS! 📊`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    await logShare('copy');
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = async () => {
    await logShare('whatsapp');
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleTwitter = async () => {
    await logShare('twitter');
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Achievement</DialogTitle>
        </DialogHeader>
        
        {/* Preview Card */}
        <div 
          ref={cardRef}
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradient()} p-6 text-white`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              {icon ? <span className="text-4xl">{icon}</span> : getTypeIcon()}
              <div>
                <p className="text-white/80 text-sm font-medium uppercase tracking-wider">{type}</p>
                <h3 className="text-xl font-bold">{title}</h3>
              </div>
            </div>
            
            <div className="text-center py-4">
              <div className="text-5xl font-bold">{value}</div>
              {subtitle && <p className="text-white/80 mt-1">{subtitle}</p>}
            </div>
            
            <div className="flex items-center justify-center gap-2 text-white/60 text-xs mt-4">
              <span>Tracked with</span>
              <span className="font-semibold text-white">Life OS</span>
            </div>
          </div>
        </div>

        {/* Share Options */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Button
            variant="outline"
            className="flex flex-col gap-1 h-auto py-3"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
            <span className="text-xs">Copy</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col gap-1 h-auto py-3"
            onClick={handleWhatsApp}
          >
            <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-xs">WhatsApp</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col gap-1 h-auto py-3"
            onClick={handleTwitter}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="text-xs">X/Twitter</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

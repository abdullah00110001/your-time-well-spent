import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Check, Upload, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BlockScreenOption {
  id: string;
  background: string;
  isCustom?: boolean;
  label: string;
}

interface ShieldBlockScreenProps {
  onBack: () => void;
}

export function ShieldBlockScreen({ onBack }: ShieldBlockScreenProps) {
  const [selectedScreen, setSelectedScreen] = useState('default');
  const [customText, setCustomText] = useState('Stay Focused on your GOALS, your PEACE & your HAPPINESS...');
  const [customImage, setCustomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blockScreens: BlockScreenOption[] = [
    { id: 'default', label: 'Violet', background: 'bg-gradient-to-br from-violet-400 to-purple-600' },
    { id: 'ocean', label: 'Ocean', background: 'bg-gradient-to-br from-cyan-400 to-blue-600' },
    { id: 'sunset', label: 'Sunset', background: 'bg-gradient-to-br from-orange-400 via-pink-500 to-rose-600' },
    { id: 'forest', label: 'Forest', background: 'bg-gradient-to-br from-emerald-500 to-teal-700' },
    { id: 'midnight', label: 'Midnight', background: 'bg-gradient-to-br from-slate-800 via-indigo-900 to-black' },
    { id: 'mono', label: 'Mono', background: 'bg-gradient-to-br from-zinc-700 to-zinc-900' },
    { id: 'rose', label: 'Rose', background: 'bg-gradient-to-br from-pink-400 to-rose-600' },
    { id: 'custom', label: 'Custom', background: 'bg-slate-800', isCustom: true },
  ];

  useEffect(() => {
    const savedTheme = localStorage.getItem('shield_block_screen_theme');
    const savedText = localStorage.getItem('shield_block_screen_text');
    const savedImage = localStorage.getItem('shield_block_screen_image');
    if (savedTheme) setSelectedScreen(savedTheme);
    if (savedText) setCustomText(savedText);
    if (savedImage) setCustomImage(savedImage);
  }, []);

  const handleSelectScreen = (id: string) => {
    setSelectedScreen(id);
    localStorage.setItem('shield_block_screen_theme', id);
    // Also persist to the legacy key used by the native side
    localStorage.setItem('shield_block_screen', id);
    // Notify native overlay if available
    try {
      window.dispatchEvent(new CustomEvent('shield:blockScreenChanged', { detail: { theme: id } }));
    } catch {}
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setCustomText(newText);
    localStorage.setItem('shield_block_screen_text', newText);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomImage(base64String);
        localStorage.setItem('shield_block_screen_image', base64String);
        toast.success('Custom background updated!');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 py-4 shrink-0 border-b border-border/50 bg-card/50 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Block Screen Style</h1>
            <p className="text-xs text-muted-foreground">Choose what appears when apps are blocked</p>
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto pb-24 space-y-5">
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Type className="h-4 w-4 text-primary" />
            Custom Motivation Message
          </h3>
          <Textarea
            value={customText}
            onChange={handleTextChange}
            placeholder="Type your custom motivation here..."
            className="resize-none h-20 bg-muted/50 border-border/50 focus-visible:ring-primary/50 text-sm font-medium"
          />
          <p className="text-[10px] text-muted-foreground">This text will appear when you try to open a blocked app.</p>
        </div>

        <div className="h-px bg-border/50 w-full" />

        <h3 className="text-sm font-bold text-foreground">Choose a theme</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {blockScreens.map((screen) => (
            <Card
              key={screen.id}
              className={cn(
                'relative overflow-hidden cursor-pointer transition-all aspect-[3/4] shadow-sm hover:shadow-md',
                selectedScreen === screen.id ? 'ring-4 ring-primary scale-[0.98]' : 'ring-1 ring-border/50 hover:scale-[1.02]'
              )}
              onClick={() => handleSelectScreen(screen.id)}
            >
              <CardContent className={cn('p-0 h-full w-full relative', screen.background)}>
                {screen.isCustom && customImage && (
                  <>
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${customImage})` }} />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                  </>
                )}

                <div className="absolute inset-0 p-3 flex flex-col z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/90 drop-shadow">
                      {screen.label}
                    </span>
                    {selectedScreen === screen.id && (
                      <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center shadow">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex-1 flex items-center">
                    <p className="text-white text-[11px] font-semibold leading-relaxed drop-shadow-md line-clamp-5">
                      {customText || 'Stay Focused...'}
                    </p>
                  </div>

                  {screen.isCustom && (
                    <div className="mt-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 border border-white/20 shadow-lg h-7 text-[10px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectScreen(screen.id);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        {customImage ? 'Change' : 'Upload'}
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          The selected theme appears when a blocked app is opened.
        </p>
      </div>
    </div>
  );
}

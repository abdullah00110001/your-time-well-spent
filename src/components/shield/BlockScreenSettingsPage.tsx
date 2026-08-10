// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Fully functional Block Screen settings — message, reason, 1-min bypass +
// PIN, and background. Live preview reflects every change instantly.

import { useState } from 'react';
import { ArrowLeft, MessageSquare, Info, Timer, Palette, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  loadBlockScreen, saveBlockScreen, DEFAULT_BLOCK_SCREEN,
  type BlockScreenSettings, type BlockBackground,
} from '@/lib/shield/settingsStore';
import { BlockedScreen } from './BlockedScreen';

const GOLD = '#FFD166';
const EMBER = '#FF8C42';

const BACKGROUNDS: { id: BlockBackground; label: string; css: string }[] = [
  { id: 'DARK_SOIL', label: 'Dark Soil', css: 'linear-gradient(180deg,#1b1710,#070605)' },
  { id: 'LIGHT_RAYS', label: 'Light Rays', css: `radial-gradient(120% 80% at 50% 0%, ${GOLD}55, ${EMBER}33 40%, #14110c)` },
];

interface Props { onBack: () => void }

export function BlockScreenSettingsPage({ onBack }: Props) {
  const [s, setS] = useState<BlockScreenSettings>(loadBlockScreen);
  const [preview, setPreview] = useState(false);

  const patch = (p: Partial<BlockScreenSettings>) => {
    const next = { ...s, ...p };
    setS(next);
    saveBlockScreen(next); // persists + broadcasts to <BlockedScreen />
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/85 px-4 py-3 backdrop-blur pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold">Block Screen Settings</h1>
          <p className="text-[11px] text-muted-foreground">What users see when something is blocked</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Preview" onClick={() => setPreview(true)}>
          <Eye className="h-5 w-5" style={{ color: GOLD }} />
        </Button>
      </div>

      <div className="space-y-6 p-4">
        {/* 1 — Block message */}
        <Row icon={MessageSquare} title="Block Message" hint="Shown in large text on the block screen">
          <Input
            value={s.message}
            maxLength={80}
            onChange={(e) => patch({ message: e.target.value })}
            placeholder={DEFAULT_BLOCK_SCREEN.message}
            className="bg-muted/30 border-border/60"
          />
        </Row>

        {/* 2 — Show reason */}
        <Row icon={Info} title="Show Reason" hint='Displays "Why: Blocked during Focus Mode"'>
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
            <span className="text-sm">{s.showReason ? 'Reason visible' : 'Reason hidden'}</span>
            <Switch checked={s.showReason} onCheckedChange={(v) => patch({ showReason: v })} />
          </div>
          {s.showReason && (
            <Input
              value={s.reasonText}
              maxLength={60}
              onChange={(e) => patch({ reasonText: e.target.value })}
              className="mt-2 bg-muted/30 border-border/60 text-sm"
            />
          )}
        </Row>

        {/* 3 — 1 min bypass + PIN */}
        <Row icon={Timer} title="Allow 1 Min Bypass" hint="Adds an “Open for 1 Min” escape hatch">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
            <span className="text-sm">{s.allowOneMinBypass ? 'Bypass enabled' : 'Bypass disabled'}</span>
            <Switch checked={s.allowOneMinBypass} onCheckedChange={(v) => patch({ allowOneMinBypass: v })} />
          </div>
          {s.allowOneMinBypass && (
            <div className="mt-2 space-y-1">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={s.bypassPin}
                onChange={(e) => patch({ bypassPin: e.target.value.replace(/\D/g, '') })}
                placeholder="Protect with a PIN (optional)"
                className="bg-muted/30 border-border/60 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                {s.bypassPin ? 'PIN required before the 1-minute window opens.' : 'No PIN — one tap unlocks 1 minute.'}
              </p>
            </div>
          )}
        </Row>

        {/* 4 — Background */}
        <Row icon={Palette} title="Block Screen Background" hint="Pick the mood of the block screen">
          <div className="grid grid-cols-2 gap-3">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => patch({ background: b.id })}
                className={cn(
                  'relative aspect-[3/4] overflow-hidden rounded-xl border transition-all',
                  s.background === b.id ? 'border-[#FFD166] ring-2 ring-[#FFD166]/40' : 'border-border/60',
                )}
                style={{ background: b.css }}
              >
                <span className="absolute bottom-2 left-0 right-0 text-[11px] font-semibold text-white/90">
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        </Row>

        <Button
          variant="ghost"
          className="w-full text-xs text-muted-foreground"
          onClick={() => { setS(DEFAULT_BLOCK_SCREEN); saveBlockScreen(DEFAULT_BLOCK_SCREEN); toast.success('Reset to defaults'); }}
        >
          Reset block screen settings
        </Button>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-[360px] overflow-hidden rounded-2xl p-0">
          <div className="max-h-[70vh] overflow-y-auto">
            <BlockedScreen appName="Preview" settingsOverride={s} onClose={() => setPreview(false)} onBypass={() => setPreview(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ icon: Icon, title, hint, children }: { icon: any; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: GOLD }} />
        <div>
          <h3 className="text-sm font-bold leading-tight">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default BlockScreenSettingsPage;

// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// The actual screen shown when a blocked app/site is opened.
// Every value here is driven by Settings > Block Screen Settings.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sprout, Info, Timer, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadBlockScreen, type BlockScreenSettings } from '@/lib/shield/settingsStore';

const GOLD = '#FFD166';
const EMBER = '#FF8C42';

interface Props {
  appName?: string;
  onBypass?: (seconds: number) => void;
  onClose?: () => void;
  /** Override persisted settings (used by the live preview). */
  settingsOverride?: BlockScreenSettings;
}

export function BlockedScreen({ appName, onBypass, onClose, settingsOverride }: Props) {
  const [settings, setSettings] = useState<BlockScreenSettings>(
    () => settingsOverride ?? loadBlockScreen(),
  );
  const [pinPrompt, setPinPrompt] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (settingsOverride) { setSettings(settingsOverride); return; }
    const sync = () => setSettings(loadBlockScreen());
    window.addEventListener('shield:settings', sync);
    return () => window.removeEventListener('shield:settings', sync);
  }, [settingsOverride]);

  const bg =
    settings.background === 'LIGHT_RAYS'
      ? `radial-gradient(120% 80% at 50% 0%, ${GOLD}33 0%, ${EMBER}1f 35%, #14110c 75%)`
      : 'linear-gradient(180deg, #1b1710 0%, #0e0c08 60%, #070605 100%)';

  const startBypass = () => {
    if (settings.bypassPin) {
      if (pin !== settings.bypassPin) { setError('Wrong PIN'); return; }
    }
    setPinPrompt(false);
    setPin('');
    setError('');
    onBypass?.(60);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center" style={{ background: bg }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-[340px] w-full space-y-5"
      >
        <div
          className="mx-auto h-20 w-20 rounded-full flex items-center justify-center"
          style={{ background: `${GOLD}1f`, boxShadow: `0 0 60px -12px ${GOLD}` }}
        >
          <Sprout className="h-9 w-9" style={{ color: GOLD }} />
        </div>

        <h1 className="text-2xl font-bold leading-snug" style={{ color: GOLD }}>
          {settings.message}
        </h1>

        {appName && (
          <p className="text-xs uppercase tracking-widest text-white/40">{appName}</p>
        )}

        {settings.showReason && (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
            <Info className="h-3.5 w-3.5" style={{ color: EMBER }} />
            Why: {settings.reasonText}
          </div>
        )}

        <div className="space-y-2 pt-2">
          {settings.allowOneMinBypass && !pinPrompt && (
            <Button
              variant="outline"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => (settings.bypassPin ? setPinPrompt(true) : startBypass())}
            >
              {settings.bypassPin ? <Lock className="h-4 w-4 mr-2" /> : <Timer className="h-4 w-4 mr-2" />}
              Open for 1 Min
            </Button>
          )}

          {pinPrompt && (
            <div className="space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(''); }}
                placeholder="Enter bypass PIN"
                className="text-center bg-white/5 border-white/15 text-white placeholder:text-white/30"
              />
              {error && <p className="text-xs text-rose-400">{error}</p>}
              <Button
                className="w-full font-semibold text-black"
                style={{ background: `linear-gradient(90deg, ${GOLD}, ${EMBER})` }}
                onClick={startBypass}
              >
                Unlock 1 minute
              </Button>
            </div>
          )}

          <Button variant="ghost" className="w-full text-white/60 hover:text-white" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go back
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default BlockedScreen;

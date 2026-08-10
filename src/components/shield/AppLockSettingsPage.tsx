// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// App Lock — PIN + device biometric gate for Focus Shield itself.
// PIN is verified natively (salted SHA-256 in SharedPreferences); the raw PIN
// never touches localStorage.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Fingerprint, Lock, ShieldCheck, Delete } from 'lucide-react';
import { toast } from 'sonner';
import ShieldPlugin, { type AppLockStatus } from '@/lib/capacitor/shieldPlugin';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const isAndroid = () => Capacitor.getPlatform() === 'android';

/** Numeric keypad shared by the gate and the setup flow. */
function Keypad({ value, onChange, max = 6 }: { value: string; onChange: (v: string) => void; max?: number }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[264px]">
      {keys.map((k, i) =>
        k === '' ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (k === 'del') onChange(value.slice(0, -1));
              else if (value.length < max) onChange(value + k);
            }}
            className="h-16 rounded-2xl bg-[#FFD166]/10 border border-[#FFD166]/20 text-xl font-semibold text-[#FFD166] active:scale-95 transition-transform flex items-center justify-center"
          >
            {k === 'del' ? <Delete className="h-5 w-5" /> : k}
          </button>
        )
      )}
    </div>
  );
}

function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex gap-3 justify-center my-6">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-3 w-3 rounded-full transition-colors',
            i < filled ? 'bg-[#FFD166]' : 'bg-[#FFD166]/20'
          )}
        />
      ))}
    </div>
  );
}

/**
 * Full-screen lock gate. Render it above the app when App Lock is enabled.
 * `onUnlock` is only called after a real native verification.
 */
export function AppLockGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<AppLockStatus | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!isAndroid()) return;
    ShieldPlugin.getAppLockStatus()
      .then(async (s) => {
        setStatus(s);
        if (s.biometric && s.biometricAvailable) {
          try {
            const r = await ShieldPlugin.authenticateBiometric();
            if (r.authenticated) onUnlock();
          } catch {
            /* fall back to PIN */
          }
        }
      })
      .catch(() => setStatus(null));
  }, [onUnlock]);

  useEffect(() => {
    if (pin.length < 4) return;
    let cancelled = false;
    ShieldPlugin.verifyAppLockPin({ pin })
      .then((r) => {
        if (cancelled) return;
        if (r.valid) onUnlock();
        else if (pin.length >= 4) {
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setPin('');
          }, 300);
        }
      })
      .catch(() => setPin(''));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0F0C0A] flex flex-col items-center justify-center px-6">
      <motion.div
        animate={shake ? { x: [0, -8, 8, -6, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center"
      >
        <div className="h-16 w-16 rounded-full bg-[#FFD166]/15 flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-[#FFD166]" />
        </div>
        <h1 className="text-lg font-semibold text-[#FFD166]">Focus Shield is locked</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter your PIN to continue</p>
        <PinDots length={Math.max(4, pin.length)} filled={pin.length} />
        <Keypad value={pin} onChange={setPin} />
        {status?.biometric && status?.biometricAvailable && (
          <button
            type="button"
            onClick={async () => {
              try {
                const r = await ShieldPlugin.authenticateBiometric();
                if (r.authenticated) onUnlock();
              } catch {
                toast.error('Biometric unavailable — use your PIN');
              }
            }}
            className="mt-6 flex items-center gap-2 text-sm text-[#FF8C42]"
          >
            <Fingerprint className="h-4 w-4" /> Use fingerprint
          </button>
        )}
      </motion.div>
    </div>
  );
}

/** Settings page: enable/disable App Lock, set PIN, toggle biometric. */
export function AppLockSettingsPage({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<AppLockStatus>({
    enabled: false,
    hasPin: false,
    biometric: true,
    biometricAvailable: false,
  });
  const [settingPin, setSettingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const load = async () => {
    if (!isAndroid()) return;
    try {
      setStatus(await ShieldPlugin.getAppLockStatus());
    } catch {
      /* keep defaults */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const savePin = async () => {
    if (pin.length < 4) return toast.error('PIN must be at least 4 digits');
    if (pin !== confirmPin) {
      setConfirmPin('');
      return toast.error('PINs do not match');
    }
    try {
      await ShieldPlugin.setAppLock({ enabled: true, pin, biometric: status.biometric });
      toast.success('App Lock enabled 🔒');
      setSettingPin(false);
      setPin('');
      setConfirmPin('');
      load();
    } catch {
      toast.error('Could not save PIN');
    }
  };

  const toggleLock = async (value: boolean) => {
    if (value && !status.hasPin) {
      setSettingPin(true);
      return;
    }
    try {
      await ShieldPlugin.setAppLock({ enabled: value });
      toast.success(value ? 'App Lock enabled 🔒' : 'App Lock disabled');
      load();
    } catch {
      toast.error('Could not update App Lock');
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0C0A] text-foreground pb-24">
      <header className="flex items-center gap-3 p-4 border-b border-[#FFD166]/10">
        <button onClick={onBack} aria-label="Back" className="p-2 -ml-2">
          <ArrowLeft className="h-5 w-5 text-[#FFD166]" />
        </button>
        <h1 className="text-base font-semibold">App Lock</h1>
      </header>

      {settingPin ? (
        <div className="flex flex-col items-center px-6 pt-10">
          <ShieldCheck className="h-8 w-8 text-[#FFD166] mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            {pin.length < 4 || confirmPin.length > 0 ? 'Confirm your PIN' : 'Choose a 4–6 digit PIN'}
          </p>
          <PinDots length={6} filled={(pin.length >= 4 ? confirmPin : pin).length} />
          <Keypad
            value={pin.length >= 4 ? confirmPin : pin}
            onChange={(v) => (pin.length >= 4 ? setConfirmPin(v) : setPin(v))}
          />
          <div className="flex gap-3 mt-8 w-full max-w-[264px]">
            <button
              onClick={() => {
                setSettingPin(false);
                setPin('');
                setConfirmPin('');
              }}
              className="flex-1 h-11 rounded-xl border border-[#FFD166]/20 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={savePin}
              className="flex-1 h-11 rounded-xl bg-[#FFD166] text-[#1A1410] font-semibold text-sm"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FFD166]/5 border border-[#FFD166]/10">
            <Lock className="h-5 w-5 text-[#FFD166]" />
            <div className="flex-1">
              <p className="text-sm font-medium">Require PIN to open Shield</p>
              <p className="text-xs text-muted-foreground">
                {status.hasPin ? 'PIN is set' : 'No PIN set yet'}
              </p>
            </div>
            <Switch checked={status.enabled} onCheckedChange={toggleLock} />
          </div>

          <button
            onClick={() => setSettingPin(true)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#FFD166]/5 border border-[#FFD166]/10 text-left"
          >
            <ShieldCheck className="h-5 w-5 text-[#FF8C42]" />
            <div className="flex-1">
              <p className="text-sm font-medium">{status.hasPin ? 'Change PIN' : 'Set PIN'}</p>
              <p className="text-xs text-muted-foreground">4–6 digits, stored hashed on device</p>
            </div>
          </button>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FFD166]/5 border border-[#FFD166]/10">
            <Fingerprint className="h-5 w-5 text-[#FFD166]" />
            <div className="flex-1">
              <p className="text-sm font-medium">Fingerprint unlock</p>
              <p className="text-xs text-muted-foreground">
                {status.biometricAvailable ? 'Available on this device' : 'Not enrolled on this device'}
              </p>
            </div>
            <Switch
              checked={status.biometric && status.biometricAvailable}
              disabled={!status.biometricAvailable}
              onCheckedChange={async (v) => {
                await ShieldPlugin.setAppLock({ enabled: status.enabled, biometric: v }).catch(() => null);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AppLockSettingsPage;

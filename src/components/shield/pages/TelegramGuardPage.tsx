import { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import ShieldPlugin, {
  DEFAULT_TELEGRAM_GUARD,
  type TelegramGuardSettings,
} from '@/lib/capacitor/shieldPlugin';

interface TelegramGuardPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'shield_telegram_guard_v1';

type Key = keyof TelegramGuardSettings;

const OPTIONS: Array<{ key: Key; title: string; description: string; strict?: boolean }> = [
  {
    key: 'blockChats',
    title: 'Chats, groups & channels',
    description: 'Blocks a chat when its name or messages contain 18+ words.',
  },
  {
    key: 'blockSearch',
    title: 'In-app search',
    description: 'Blocks adult results while searching inside Telegram.',
  },
  {
    key: 'blockInviteLinks',
    title: 'Invite links',
    description: 'Blocks adult t.me / join links before you can open them.',
  },
  {
    key: 'blockAllInvites',
    title: 'Block every join request',
    description: 'Strict: no joining any group or channel through a link.',
    strict: true,
  },
  {
    key: 'blockMedia',
    title: 'Photos & videos in flagged chats',
    description: 'Blocks the media viewer inside a chat that was just flagged.',
  },
  {
    key: 'blockAllMedia',
    title: 'Block every photo & video',
    description: 'Strict: no photo or video viewer inside Telegram at all.',
    strict: true,
  },
];

export function TelegramGuardPage({ onBack }: TelegramGuardPageProps) {
  const [settings, setSettings] = useState<TelegramGuardSettings>(DEFAULT_TELEGRAM_GUARD);

  useEffect(() => {
    (async () => {
      try {
        const native = await ShieldPlugin.getTelegramGuard();
        setSettings({ ...DEFAULT_TELEGRAM_GUARD, ...native });
        return;
      } catch {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setSettings({ ...DEFAULT_TELEGRAM_GUARD, ...JSON.parse(stored) });
      }
    })();
  }, []);

  const update = async (key: Key, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    try {
      await ShieldPlugin.setTelegramGuard({ [key]: value });
    } catch (e) {
      console.error(e);
    }
    toast.success(value ? 'Protection on' : 'Protection off');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Telegram Guard</h1>
            <p className="text-xs text-muted-foreground">
              Works offline, right on your phone
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Telegram Guard</p>
              <p className="text-xs text-muted-foreground">
                Checks what is on screen in Telegram — English and Bangla.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => update('enabled', v)}
            />
          </CardContent>
        </Card>

        <div className={settings.enabled ? 'space-y-3' : 'space-y-3 opacity-50 pointer-events-none'}>
          {OPTIONS.map((opt) => (
            <Card key={opt.key}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {opt.title}
                    {opt.strict && (
                      <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        STRICT
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                <Switch
                  checked={settings[opt.key]}
                  onCheckedChange={(v) => update(opt.key, v)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TelegramGuardPage;

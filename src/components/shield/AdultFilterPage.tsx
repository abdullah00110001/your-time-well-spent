import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, ShieldCheck, Check, ShieldX,
  Flame, Lock, Brain, Heart, Sparkles, AlertTriangle, Moon,
  Plus, Trash2, Globe, Type, Smartphone, ChevronRight, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';

const BLOCK_SCREENS = [
  {
    id: 'focus', label: 'Stay Focused', icon: Brain,
    preview: {
      bg: 'from-slate-900 to-slate-800', iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20', title: 'Stay Focused',
      subtitle: 'This content is blocked.\nYou are better than this.', accent: 'bg-blue-500',
    },
  },
  {
    id: 'reminder', label: 'Reminder', icon: Heart,
    preview: {
      bg: 'from-rose-950 to-slate-900', iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/20', title: 'Not Today',
      subtitle: 'Remember your goals.\nYou can do this.', accent: 'bg-rose-500',
    },
  },
  {
    id: 'strict', label: 'Strict', icon: Lock,
    preview: {
      bg: 'from-zinc-950 to-zinc-900', iconColor: 'text-red-500',
      iconBg: 'bg-red-500/20', title: 'Blocked',
      subtitle: 'Access Denied.\nFocus Shield is protecting you.', accent: 'bg-red-600',
    },
  },
  {
    id: 'motivate', label: 'Motivational', icon: Sparkles,
    preview: {
      bg: 'from-violet-950 to-indigo-950', iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/20', title: 'You Got This! 💪',
      subtitle: 'Every time you resist,\nyou grow stronger.', accent: 'bg-violet-500',
    },
  },
  {
    id: 'streak', label: 'Streak Alert', icon: Flame,
    preview: {
      bg: 'from-orange-950 to-amber-950', iconColor: 'text-orange-400',
      iconBg: 'bg-orange-500/20', title: "Don't Break Your Streak!",
      subtitle: "Stay strong.\nDon't ruin it now.", accent: 'bg-orange-500',
    },
  },
  {
    id: 'islamic', label: 'Islamic Mode', icon: Moon,
    preview: {
      bg: 'from-emerald-950 to-teal-950', iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20', title: 'اتق الله',
      subtitle: 'Fear Allah.\nGuard your eyes and heart.', accent: 'bg-emerald-500',
    },
  },
  { id: 'custom', label: 'Custom Message', icon: AlertTriangle, preview: null },
];

const COMMON_APPS = [
  { pkg: 'org.telegram.messenger', name: 'Telegram', icon: '✈️' },
  { pkg: 'com.android.chrome', name: 'Chrome', icon: '🌐' },
  { pkg: 'org.mozilla.firefox', name: 'Firefox', icon: '🦊' },
  { pkg: 'com.brave.browser', name: 'Brave', icon: '🦁' },
  { pkg: 'com.instagram.android', name: 'Instagram', icon: '📸' },
  { pkg: 'com.twitter.android', name: 'Twitter/X', icon: '🐦' },
  { pkg: 'com.reddit.frontpage', name: 'Reddit', icon: '🤖' },
  { pkg: 'com.discord', name: 'Discord', icon: '🎮' },
];

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 bg-muted/30 active:bg-muted/60 transition-colors"
      >
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="flex-1 text-left font-semibold text-sm">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-3 border-t border-border/50">{children}</div>}
    </div>
  );
}

interface AdultFilterPageProps {
  onBack: () => void;
  isActive: boolean;
}

export function AdultFilterPage({ onBack, isActive }: AdultFilterPageProps) {
  const [selectedScreen, setSelectedScreen] = useState('focus');
  const [customMessage, setCustomMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Keyword blocking
  const [keywordEnabled, setKeywordEnabled] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

  // Site blocking
  const [siteEnabled, setSiteEnabled] = useState(true);
  const [sites, setSites] = useState<string[]>([]);
  const [newSite, setNewSite] = useState('');

  // App selector
  const [selectedApps, setSelectedApps] = useState<string[]>([
    'org.telegram.messenger',
    'com.android.chrome',
    'org.mozilla.firefox',
    'com.brave.browser',
  ]);

  // Escalation
  const [baseMinutes, setBaseMinutes] = useState(5);

  useEffect(() => {
    const saved = localStorage.getItem('adult_filter_screen');
    if (saved) setSelectedScreen(saved);
    const savedMsg = localStorage.getItem('adult_filter_custom_message');
    if (savedMsg) setCustomMessage(savedMsg);
    const savedKw = localStorage.getItem('shield_user_keywords');
    if (savedKw) setKeywords(JSON.parse(savedKw));
    const savedSites = localStorage.getItem('shield_user_sites');
    if (savedSites) setSites(JSON.parse(savedSites));
    const savedApps = localStorage.getItem('shield_selected_apps');
    if (savedApps) setSelectedApps(JSON.parse(savedApps));
    const savedBase = localStorage.getItem('shield_escalation_base');
    if (savedBase) setBaseMinutes(parseInt(savedBase));
    const savedKwToggle = localStorage.getItem('shield_keyword_enabled');
    if (savedKwToggle !== null) setKeywordEnabled(savedKwToggle === 'true');
    const savedSiteToggle = localStorage.getItem('shield_site_enabled');
    if (savedSiteToggle !== null) setSiteEnabled(savedSiteToggle === 'true');
  }, []);

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw || keywords.includes(kw)) return;
    const updated = [...keywords, kw];
    setKeywords(updated);
    localStorage.setItem('shield_user_keywords', JSON.stringify(updated));
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    const updated = keywords.filter(k => k !== kw);
    setKeywords(updated);
    localStorage.setItem('shield_user_keywords', JSON.stringify(updated));
  };

  const addSite = () => {
    let s = newSite.trim().toLowerCase()
      .replace('https://', '').replace('http://', '').replace('www.', '');
    if (s.endsWith('/')) s = s.slice(0, -1);
    if (!s || sites.includes(s)) return;
    const updated = [...sites, s];
    setSites(updated);
    localStorage.setItem('shield_user_sites', JSON.stringify(updated));
    setNewSite('');
  };

  const removeSite = (site: string) => {
    const updated = sites.filter(s => s !== site);
    setSites(updated);
    localStorage.setItem('shield_user_sites', JSON.stringify(updated));
  };

  const toggleApp = (pkg: string) => {
    const updated = selectedApps.includes(pkg)
      ? selectedApps.filter(a => a !== pkg)
      : [...selectedApps, pkg];
    setSelectedApps(updated);
    localStorage.setItem('shield_selected_apps', JSON.stringify(updated));
  };

  const selected = BLOCK_SCREENS.find((s) => s.id === selectedScreen)!;

  const getDefaultMessage = (id: string) => {
    const s = BLOCK_SCREENS.find(b => b.id === id);
    return s?.preview?.subtitle?.replace('\n', ' ') || '';
  };

  const handleSave = async () => {
    if (selectedScreen === 'custom' && !customMessage.trim()) {
      toast.error('Please enter a custom message');
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem('adult_filter_screen', selectedScreen);
      localStorage.setItem('adult_filter_custom_message', customMessage);
      localStorage.setItem('shield_keyword_enabled', String(keywordEnabled));
      localStorage.setItem('shield_site_enabled', String(siteEnabled));
      localStorage.setItem('shield_escalation_base', String(baseMinutes));

      if (Capacitor.getPlatform() === 'android') {
        await ShieldPlugin.updateAdultFilterScreen({
          style: selectedScreen,
          customMessage: selectedScreen === 'custom' ? customMessage : getDefaultMessage(selectedScreen),
        });
        // Sync keywords, sites, apps to native
        try {
          await ShieldPlugin.setBlockedKeywords?.({ keywords });
          await ShieldPlugin.setBlockedSites?.({ sites });
          await ShieldPlugin.setBlockedApps?.({ packages: selectedApps });
          await ShieldPlugin.setEscalationBase?.({ minutes: baseMinutes });
        } catch (e) {
          // native methods may not exist yet — ignore
        }
      }
      toast.success('Saved 🛡️');
      onBack();
    } catch (e) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-base">Adult Filter</h1>
          <p className="text-xs text-muted-foreground">18+ content blocked automatically</p>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
          isActive ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground'
        )}>
          <span className={cn('h-2 w-2 rounded-full', isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground')} />
          {isActive ? 'Active' : 'Inactive'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">

        {/* Status Card */}
        <Card className={cn('border-2', isActive ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5')}>
          <CardContent className="p-4 flex items-center gap-3">
            {isActive
              ? <ShieldCheck className="h-8 w-8 text-green-500 shrink-0" />
              : <ShieldX className="h-8 w-8 text-amber-500 shrink-0" />}
            <div>
              <p className={cn('font-semibold text-sm', isActive ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
                {isActive ? 'Filter is running' : 'Filter is not active'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isActive
                  ? 'DNS + keyword + site list + app filter active.'
                  : 'Enable Accessibility Service to activate.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Keyword Blocking ── */}
        <CollapsibleSection title="Keyword Blocking" icon={<Type className="h-4 w-4 text-primary" />} defaultOpen>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm font-medium">Block typed keywords</p>
              <p className="text-xs text-muted-foreground">Clears input + blocks app when matched</p>
            </div>
            <Switch
              checked={keywordEnabled}
              onCheckedChange={(v) => {
                setKeywordEnabled(v);
                localStorage.setItem('shield_keyword_enabled', String(v));
              }}
            />
          </div>
          {keywordEnabled && (
            <>
              <div className="flex gap-2 mt-3">
                <Input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()}
                  placeholder="Add keyword..."
                  className="rounded-xl text-sm h-10 bg-muted border-0"
                />
                <Button size="sm" onClick={addKeyword} className="rounded-xl h-10 px-3">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map(kw => (
                    <div key={kw} className="flex items-center gap-1 bg-muted rounded-xl px-3 py-1.5 text-xs font-medium">
                      <span>{kw}</span>
                      <button onClick={() => removeKeyword(kw)} className="ml-1 text-muted-foreground active:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2 text-center py-2">
                  No custom keywords yet. Built-in adult keywords always active.
                </p>
              )}
            </>
          )}
        </CollapsibleSection>

        {/* ── Site Blocking ── */}
        <CollapsibleSection title="Site Blocking" icon={<Globe className="h-4 w-4 text-primary" />} defaultOpen>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm font-medium">Block specific sites</p>
              <p className="text-xs text-muted-foreground">Added to 15k+ built-in adult site list</p>
            </div>
            <Switch
              checked={siteEnabled}
              onCheckedChange={(v) => {
                setSiteEnabled(v);
                localStorage.setItem('shield_site_enabled', String(v));
              }}
            />
          </div>
          {siteEnabled && (
            <>
              <div className="flex gap-2 mt-3">
                <Input
                  value={newSite}
                  onChange={e => setNewSite(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSite()}
                  placeholder="example.com"
                  className="rounded-xl text-sm h-10 bg-muted border-0"
                />
                <Button size="sm" onClick={addSite} className="rounded-xl h-10 px-3">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {sites.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {sites.map(site => (
                    <div key={site} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2.5">
                      <span className="text-xs font-medium">{site}</span>
                      <button onClick={() => removeSite(site)} className="text-muted-foreground active:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2 text-center py-2">
                  No custom sites. Built-in 15k+ site list always active.
                </p>
              )}
            </>
          )}
        </CollapsibleSection>

        {/* ── App Selector ── */}
        <CollapsibleSection title="Protected Apps" icon={<Smartphone className="h-4 w-4 text-primary" />} defaultOpen>
          <p className="text-xs text-muted-foreground mb-3">Keyword & URL filter applies inside these apps</p>
          <div className="space-y-2">
            {COMMON_APPS.map(app => {
              const isOn = selectedApps.includes(app.pkg);
              return (
                <div key={app.pkg} className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{app.icon}</span>
                    <span className="text-sm font-medium">{app.name}</span>
                  </div>
                  <Switch checked={isOn} onCheckedChange={() => toggleApp(app.pkg)} />
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* ── Escalation Timer ── */}
        <CollapsibleSection title="Block Duration" icon={<Flame className="h-4 w-4 text-orange-400" />}>
          <p className="text-xs text-muted-foreground mb-3">
            Each violation increases block time. Minimum is {baseMinutes} min.
          </p>
          <div className="bg-muted/50 rounded-2xl p-3 space-y-2 text-xs">
            {[
              { label: '1st block', value: `${baseMinutes} min` },
              { label: '2nd block', value: `${baseMinutes * 2} min` },
              { label: '3rd block', value: `${baseMinutes * 6} min` },
              { label: '4th+ block', value: `${baseMinutes * 6} min (cap)` },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Base minutes (minimum {5})</p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={5}
                max={60}
                value={baseMinutes}
                onChange={e => {
                  const v = Math.max(5, parseInt(e.target.value) || 5);
                  setBaseMinutes(v);
                  localStorage.setItem('shield_escalation_base', String(v));
                }}
                className="rounded-xl h-10 bg-muted border-0 w-24 text-center font-bold"
              />
              <span className="text-xs text-muted-foreground">minutes (can only increase)</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Block Screen Style ── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">Block Screen Style</h2>
          <p className="text-xs text-muted-foreground mb-3 px-1">Shown when 18+ content is detected</p>
          <div className="space-y-2.5">
            {BLOCK_SCREENS.map((screen) => {
              const isSelected = selectedScreen === screen.id;
              return (
                <button
                  key={screen.id}
                  onClick={() => setSelectedScreen(screen.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] text-left',
                    isSelected ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/30'
                  )}
                >
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', isSelected ? 'bg-primary/10' : 'bg-muted')}>
                    <screen.icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium text-sm', isSelected && 'text-primary')}>{screen.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {screen.id === 'custom'
                        ? (customMessage.trim() || 'Write your own message')
                        : screen.preview?.subtitle.replace('\n', ' ')}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom message */}
        {selectedScreen === 'custom' && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Your Message</h2>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="e.g. Remember why you started. Stay strong."
              className="rounded-2xl resize-none text-sm min-h-[100px] bg-muted border-0 focus-visible:ring-1"
              maxLength={200}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 text-right px-1">{customMessage.length}/200</p>
          </div>
        )}

        {/* Preview */}
        {selected.preview && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Preview</h2>
            <div className={cn('rounded-3xl overflow-hidden bg-gradient-to-b p-8 flex flex-col items-center justify-center gap-4 min-h-[260px]', selected.preview.bg)}>
              <div className={cn('h-16 w-16 rounded-2xl flex items-center justify-center', selected.preview.iconBg)}>
                <ShieldX className={cn('h-8 w-8', selected.preview.iconColor)} />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-white font-bold text-xl">{selected.preview.title}</p>
                {selected.preview.subtitle.split('\n').map((line, i) => (
                  <p key={i} className="text-white/60 text-sm">{line}</p>
                ))}
              </div>
              <div className={cn('h-1 w-16 rounded-full mt-2', selected.preview.accent)} />
            </div>
          </div>
        )}

        {selectedScreen === 'custom' && customMessage.trim() && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Preview</h2>
            <div className="rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 p-8 flex flex-col items-center justify-center gap-4 min-h-[260px]">
              <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center">
                <ShieldX className="h-8 w-8 text-white/80" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-white font-bold text-xl">Blocked</p>
                {customMessage.trim().split('\n').map((line, i) => (
                  <p key={i} className="text-white/60 text-sm">{line}</p>
                ))}
              </div>
              <div className="h-1 w-16 rounded-full mt-2 bg-white/30" />
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border/50">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-semibold text-base">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
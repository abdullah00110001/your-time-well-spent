import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  Globe, 
  Type, 
  Film, 
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics'; // 🟢 Premium Vibration Added

interface ShieldQuickActionsProps {
  blockedAppsCount: number;
  blockedSitesCount: number;
  blockedKeywordsCount: number;
  reelsBlockEnabled: boolean;
  adultBlockEnabled: boolean;
  onReelsToggle: (value: boolean) => void;
  onAdultToggle: (value: boolean) => void;
  onManageApps: () => void;
  onManageSites: () => void;
  onManageKeywords: () => void;
}

export function ShieldQuickActions({
  blockedAppsCount,
  blockedSitesCount,
  blockedKeywordsCount,
  reelsBlockEnabled,
  adultBlockEnabled,
  onReelsToggle,
  onAdultToggle,
  onManageApps,
  onManageSites,
  onManageKeywords
}: ShieldQuickActionsProps) {
  
  // 🟢 Haptic Feedback for Clicks
  const handleMenuClick = async (onClick: () => void) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Ignore if haptics not available (e.g., on web)
    }
    onClick();
  };

  // 🟢 Haptic Feedback for Switches
  const handleToggle = async (enabled: boolean, onToggleAction: (val: boolean) => void) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
    onToggleAction(enabled);
  };

  const quickActions = [
    { 
      icon: Smartphone, 
      label: 'Apps Blocked', 
      value: blockedAppsCount, 
      onClick: () => handleMenuClick(onManageApps),
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10'
    },
    { 
      icon: Globe, 
      label: 'Sites Blocked', 
      value: blockedSitesCount, 
      onClick: () => handleMenuClick(onManageSites),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      icon: Type, 
      label: 'Keywords Blocked', 
      value: blockedKeywordsCount, 
      onClick: () => handleMenuClick(onManageKeywords),
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    }
  ];

  const toggleActions = [
    { 
      icon: Film, 
      label: 'Block Reels & Shorts', 
      description: 'Stop infinite scrolling immediately',
      enabled: reelsBlockEnabled,
      onToggle: (val: boolean) => handleToggle(val, onReelsToggle),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    }
/*     { 
      icon: ShieldAlert, 
      label: 'Adult Content Filter', 
      description: 'Block inappropriate sites via safe DNS',
      enabled: adultBlockEnabled,
      onToggle: (val: boolean) => handleToggle(val, onAdultToggle),
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    } */
  ];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2 font-bold tracking-wide">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
        
        {/* 🟢 Clickable Menu Items with Smooth Scale Animation */}
        {quickActions.map((action, index) => (
          <div 
            key={index} 
            className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 active:bg-muted active:scale-[0.98] cursor-pointer transition-all duration-200"
            onClick={action.onClick}
          >
            <div className="flex items-center gap-4">
              <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shadow-inner", action.bgColor)}>
                <action.icon className={cn("h-5 w-5", action.color)} />
              </div>
              <div>
                <p className="text-2xl font-extrabold leading-none">{action.value}</p>
                <p className="text-xs text-muted-foreground font-medium mt-1">{action.label}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
          </div>
        ))}

        <div className="h-px bg-border/50 mx-4 my-3" />

        {/* 🟢 Toggles with Haptic Feedback */}
        {toggleActions.map((action, index) => (
          <div 
            key={index} 
            className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shadow-inner", action.bgColor)}>
                <action.icon className={cn("h-5 w-5", action.color)} />
              </div>
              <div>
                <p className="font-bold text-sm tracking-tight">{action.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{action.description}</p>
              </div>
            </div>
            <Switch 
              checked={action.enabled} 
              onCheckedChange={action.onToggle}
              className="data-[state=checked]:bg-primary shadow-sm scale-110 mr-1"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

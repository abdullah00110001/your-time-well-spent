import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Zap,
  BarChart3,
  Users,
  Settings,
  FileBarChart,
} from 'lucide-react';

interface ShieldBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function ShieldBottomNav({ activeTab, onTabChange }: ShieldBottomNavProps) {
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'modes', icon: Zap, label: 'Modes' },
    { id: 'reports', icon: FileBarChart, label: 'Reports' },
    { id: 'analytics', icon: BarChart3, label: 'Stats' },
    { id: 'groups', icon: Users, label: 'Groups' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    // Matches the global MobileNav bottom bar exactly (height, blur, safe-area, typography)
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-all select-none active:scale-95',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <tab.icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

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
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all min-w-[48px]',
                isActive ? 'bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn('p-1.5 rounded-xl transition-all', isActive && 'bg-primary/20')}>
                <tab.icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <span className={cn('text-[10px] font-medium mt-0.5', isActive ? 'text-primary' : 'text-muted-foreground')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
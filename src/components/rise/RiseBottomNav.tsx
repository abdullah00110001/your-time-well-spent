import { cn } from '@/lib/utils';
import { AlarmClock, Users, Globe, BarChart3, Settings } from 'lucide-react';

interface RiseBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function RiseBottomNav({ activeTab, onTabChange }: RiseBottomNavProps) {
  const tabs = [
    { id: 'alarms', icon: AlarmClock, label: 'Alarms' },
    { id: 'group', icon: Users, label: 'Groups' },
    { id: 'community', icon: Globe, label: 'Community' },
    { id: 'reports', icon: BarChart3, label: 'Reports' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div data-rise-nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all min-w-[48px]',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className={cn('h-5 w-5 mb-1', isActive && 'text-primary')} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

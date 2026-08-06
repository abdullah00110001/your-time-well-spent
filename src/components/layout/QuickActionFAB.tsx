import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  X, 
  Calendar, 
  Target, 
  BookOpen,
  Moon,
  PenLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

const quickActions = [
  { 
    label: 'Daily Input', 
    icon: Calendar, 
    path: '/daily-input',
    description: 'Log today\'s activities'
  },
  { 
    label: 'Night Review', 
    icon: Moon, 
    path: '/night-muhasaba',
    description: 'Evening reflection'
  },
  { 
    label: 'New Habit', 
    icon: Target, 
    path: '/habits',
    description: 'Add a habit'
  },
  { 
    label: 'Journal', 
    icon: PenLine, 
    path: '/journal',
    description: 'Write your thoughts'
  },
];

export default function QuickActionFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const { mode } = useAppMode();
  const location = useLocation();
  const isIslamic = mode === 'islamic';

  // Hide on certain pages
  const hiddenPaths = ['/auth', '/admin'];
  if (hiddenPaths.some(path => location.pathname.startsWith(path))) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 lg:bottom-6 lg:right-6">
      {/* Quick action buttons */}
      <div className={cn(
        "absolute bottom-16 right-0 flex flex-col gap-2 transition-all duration-300",
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        {quickActions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.path}
              to={action.path}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-full bg-card shadow-lg border transition-all duration-200",
                "hover:scale-105 hover:shadow-xl",
                "animate-in fade-in slide-in-from-right-2",
              )}
              style={{ 
                animationDelay: `${idx * 50}ms`,
                animationFillMode: 'both'
              }}
            >
              <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
              <div className={cn(
                "p-2 rounded-full",
                isIslamic 
                  ? "bg-emerald-100 dark:bg-emerald-900/50" 
                  : "bg-primary/10"
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  isIslamic 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : "text-primary"
                )} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main FAB button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-all duration-300",
          isOpen && "rotate-45",
          isIslamic 
            ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
            : "bg-primary hover:bg-primary/90"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/50 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

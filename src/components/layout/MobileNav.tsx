import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isNative } from '@/lib/capacitor/platform';
import { useLanguage } from '@/contexts/LanguageContext';
import { LifeOSLogo } from '@/components/LifeOSLogo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Target, 
  LayoutDashboard, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  LogOut,
  Calendar,
  BookOpen,
  Map,
  Trophy,
  PieChart,
  GraduationCap,
  Image,
  Mail,
  Menu,
  Shield,
  Lightbulb,
  ClipboardList,
  Brain,
  Compass,
  Home,
  Plus,
  Flame,
  BookHeart,
  TrendingUp,
  Clock,
  Heart
} from 'lucide-react';
import { useAppMode } from '@/contexts/AppModeContext';
import { supabase } from '@/integrations/supabase/client';
import NotificationCenter from '@/components/notifications/NotificationCenter';

interface MobileNavProps {
  /** Hide the fixed top header (logo + bell). Bottom nav remains. */
  hideTopBar?: boolean;
}

export default function MobileNav({ hideTopBar = false }: MobileNavProps = {}) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { t, language } = useLanguage();
  const { mode } = useAppMode();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Haptic feedback on nav tap (native only)
  const triggerHaptic = useCallback(async () => {
    if (isNative) {
      try {
        const { lightImpact } = await import('@/lib/capacitor/nativeHaptics');
        lightImpact();
      } catch {}
    }
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setIsAdmin(data === true);
  };

  // Mode-aware dashboard name
  const unifiedDashboardName = mode === 'islamic' 
    ? (language === 'bn' ? 'ইসলামিক ড্যাশবোর্ড' : 'Islamic Dashboard')
    : (language === 'bn' ? 'লাইফ ড্যাশবোর্ড' : 'Life Dashboard');

  // Swipe gesture handling
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX.current = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeDistance = touchEndX.current - touchStartX.current;
      const minSwipeDistance = 50;

      if (swipeDistance > minSwipeDistance && touchStartX.current < 50) {
        setOpen(true);
      }
      if (swipeDistance < -minSwipeDistance && open) {
        setOpen(false);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open]);

  const navigation = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: unifiedDashboardName, href: '/unified-dashboard', icon: Compass },
    { name: t('nav.dailyInput'), href: '/daily-input', icon: ClipboardList },
    { name: t('nav.intelligence'), href: '/intelligence', icon: Brain },
    { name: 'Smart Insights', href: '/insights', icon: Lightbulb },
    { name: language === 'bn' ? 'চ্যালেঞ্জ' : 'Challenges', href: '/challenges', icon: Flame },
    { name: language === 'bn' ? 'মুহাসাবা' : 'Reflections', href: '/reflections', icon: BookHeart },
    { name: language === 'bn' ? 'তুলনামূলক বিশ্লেষণ' : 'Compare Analytics', href: '/comparative-analytics', icon: TrendingUp },
    { name: t('nav.journey'), href: '/journey', icon: Map },
    { name: t('nav.goals'), href: '/goals', icon: Target },
    { name: t('nav.quarterlyGoals'), href: '/quarterly-goals', icon: Target },
    { name: t('nav.habits'), href: '/habits', icon: CheckSquare },
    { name: t('nav.lifeDistribution'), href: '/life-distribution', icon: PieChart },
    { name: t('nav.knowledgeShelf'), href: '/knowledge-shelf', icon: GraduationCap },
    { name: t('nav.monthlyHighlights'), href: '/monthly-highlights', icon: Image },
    { name: t('nav.futureLetter'), href: '/future-letter', icon: Mail },
    { name: t('nav.leaderboard'), href: '/leaderboard', icon: Trophy },
    { name: t('nav.calendar'), href: '/calendar', icon: Calendar },
    { name: t('nav.journal'), href: '/journal', icon: BookOpen },
    { name: t('nav.analytics'), href: '/analytics', icon: BarChart3 },
    { name: language === 'bn' ? 'টাইম ট্র্যাকিং' : 'Time Tracking', href: '/time-tracking', icon: Clock },
    { name: language === 'bn' ? 'লাইফ ক্যালেন্ডার' : 'Life Calendar', href: '/life-calendar', icon: Heart },
    ...(isAdmin ? [{ name: t('nav.admin'), href: '/admin', icon: Shield }] : []),
    { name: t('nav.settings'), href: '/settings', icon: Settings },
  ];

  // Bottom navigation: Home | Habit | Rise | Shield | Life | Settings
  const bottomNavItems = [
    { name: language === 'bn' ? 'হোম' : 'Home', href: '/dashboard', icon: Home },
    { name: language === 'bn' ? 'অভ্যাস' : 'Habit', href: '/habits', icon: CheckSquare },
    { name: language === 'bn' ? 'রাইজ' : 'Rise', href: '/rise', icon: Flame },
    { name: language === 'bn' ? 'শিল্ড' : 'Shield', href: '/shield', icon: Shield },
    { name: language === 'bn' ? 'লাইফ' : 'Life', href: '/life-calendar', icon: Heart },
    { name: language === 'bn' ? 'সেটিংস' : 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Fixed Header for Mobile */}
      {!hideTopBar && (
      <div className="fixed top-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-sm border-b h-14 flex items-center px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-lg"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
            <div className="flex h-full flex-col">
              {/* Logo */}
              <div className="flex h-14 sm:h-16 items-center gap-2 border-b px-4 sm:px-6">
                <LifeOSLogo size={36} />
                <div className="flex flex-col min-w-0">
                  <span className="text-base sm:text-lg font-semibold truncate">{t('app.name')}</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 truncate">{t('app.tagline')}</span>
                </div>
              </div>

              {/* Navigation */}
              <ScrollArea className="flex-1 py-3 sm:py-4">
                <nav className="space-y-0.5 sm:space-y-1 px-2 sm:px-3">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href || 
                                   (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-2.5 sm:gap-3 rounded-lg px-3 py-2.5 sm:py-3 text-sm font-medium transition-all active:scale-[0.98]',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted active:bg-muted'
                        )}
                      >
                        <item.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </ScrollArea>

              {/* Footer */}
              <div className="border-t p-3 sm:p-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2.5 sm:gap-3 text-foreground hover:bg-muted active:scale-[0.98]"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('nav.signOut')}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* App Name in Header */}
        <div className="flex items-center gap-2 ml-2 flex-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Target className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">{t('app.name')}</span>
        </div>

        {/* Notification Center */}
        <NotificationCenter />
      </div>
      )}

      {/* Fixed Bottom Navigation for Mobile */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-lg border-t border-border select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <nav className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.href || 
                           (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-all select-none active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                style={{ minWidth: 44, minHeight: 44 }}
                onClick={triggerHaptic}
              >
                <item.icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

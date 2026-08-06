import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { LifeOSLogo } from '@/components/LifeOSLogo';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { 
  Target, 
  LayoutDashboard, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  LogOut,
  Plus,
  Calendar,
  BookOpen,
  Map,
  Trophy,
  PieChart,
  GraduationCap,
  Image,
  Mail,
  Shield,
  Sparkles,
  Download,
  ClipboardList,
  Moon,
  FileText,
  Brain,
  Lightbulb,
  Compass,
  Flame,
  BookHeart,
  TrendingUp,
  FileType,
  Crown
} from 'lucide-react';
import { useAppMode } from '@/contexts/AppModeContext';

export default function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { t, language } = useLanguage();
  const { mode, labels } = useAppMode();
  const [isAdmin, setIsAdmin] = useState(false);

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

  const navigation = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: unifiedDashboardName, href: '/unified-dashboard', icon: Compass },
    { name: t('nav.dailyInput'), href: '/daily-input', icon: ClipboardList },
    { name: t('nav.nightMuhasaba'), href: '/night-muhasaba', icon: Moon },
    { name: t('nav.weeklyReview'), href: '/weekly-review', icon: FileText },
    { name: t('nav.monthlyReview'), href: '/monthly-review', icon: Calendar },
    { name: t('nav.intelligence'), href: '/intelligence', icon: Brain },
    { name: 'Smart Insights', href: '/insights', icon: Lightbulb },
    { name: language === 'bn' ? 'চ্যালেঞ্জ' : 'Challenges', href: '/challenges', icon: Flame },
    { name: language === 'bn' ? 'মুহাসাবা' : 'Reflections', href: '/reflections', icon: BookHeart },
    { name: language === 'bn' ? 'তুলনামূলক বিশ্লেষণ' : 'Compare Analytics', href: '/comparative-analytics', icon: TrendingUp },
    { name: t('nav.gamification'), href: '/gamification', icon: Trophy },
    { name: t('nav.journey'), href: '/journey', icon: Map },
    { name: t('nav.goals'), href: '/goals', icon: Target },
    { name: t('nav.quarterlyGoals'), href: '/quarterly-goals', icon: Target },
    { name: t('nav.habits'), href: '/habits', icon: CheckSquare },
    { name: t('nav.lifeDistribution'), href: '/life-distribution', icon: PieChart },
    { name: t('nav.knowledgeShelf'), href: '/knowledge-shelf', icon: GraduationCap },
    { name: t('nav.monthlyHighlights'), href: '/monthly-highlights', icon: Image },
    { name: t('nav.futureLetter'), href: '/future-letter', icon: Mail },
    { name: t('nav.wrapped'), href: '/wrapped', icon: Sparkles },
    { name: t('nav.leaderboard'), href: '/leaderboard', icon: Trophy },
    { name: t('nav.calendar'), href: '/calendar', icon: Calendar },
    { name: t('nav.journal'), href: '/journal', icon: BookOpen },
    { name: t('nav.analytics'), href: '/analytics', icon: BarChart3 },
    { name: t('nav.export'), href: '/export', icon: Download },
    { name: 'BlackBox PDF', href: '/pdf-tools', icon: FileType },
    { name: language === 'bn' ? 'প্রিমিয়াম' : 'Premium', href: '/premium', icon: Crown },
    ...(isAdmin ? [
      { name: t('nav.admin'), href: '/admin', icon: Shield },
      { name: t('nav.adminCommand'), href: '/admin-command', icon: Shield },
      { name: 'PDF Admin', href: '/admin/pdf-tools', icon: FileType },
    ] : []),
    { name: t('nav.settings'), href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar-background">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <LifeOSLogo size={36} />
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-sidebar-foreground">{t('app.name')}</span>
            <span className="text-[10px] text-muted-foreground -mt-1">{t('app.tagline')}</span>
          </div>
        </div>
        <NotificationCenter />
      </div>

      {/* Quick Actions */}
      <div className="p-4">
        <Button asChild className="w-full gap-2">
          <Link to="/habits/new">
            <Plus className="h-4 w-4" />
            {t('nav.newHabit')}
          </Link>
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
                           (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-5 w-5" />
          {t('nav.signOut')}
        </Button>
      </div>
    </div>
  );
}

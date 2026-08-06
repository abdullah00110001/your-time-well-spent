import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  ChevronLeft,
  Shield,
  AlertTriangle,
  BarChart3,
  Search,
  Bell,
  ChevronDown,
  Settings,
  Activity,
  FileType,
  Zap,
  Menu,
  X,
  Inbox,
  Rocket,
  Megaphone,
  Music2,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AdminLayoutProps {
  children: ReactNode;
}

const adminNavCategories = [
  {
    title: 'Dashboard',
    items: [
      { title: 'Overview', href: '/admin', icon: LayoutDashboard },
      { title: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    ]
  },
  {
    title: 'User Management',
    items: [
      { title: 'User Inspector', href: '/admin/users', icon: Search },
      { title: 'At-Risk Users', href: '/admin/at-risk', icon: AlertTriangle },
      { title: 'User Feedback', href: '/admin/feedback', icon: Inbox },
      { title: 'Notifications', href: '/admin/notifications', icon: Bell },
      { title: 'Announcements', href: '/admin/announcements', icon: Megaphone },
    ]
  },
  {
    title: 'Content & Audio',
    items: [
      { title: 'Ringtones', href: '/admin/ringtones', icon: Music2 },
    ]
  },
  {
    title: 'System Controls',
    items: [
      { title: 'Control Center', href: '/admin/panel', icon: Settings },
      { title: 'Command Center', href: '/admin/command', icon: Zap },
      { title: 'App Updates', href: '/admin/panel?tab=updates', icon: Rocket },
      { title: 'OTA Bundles', href: '/admin/bundles', icon: Package },
      { title: 'PDF Admin', href: '/admin/pdf-tools', icon: FileType },
    ]
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => location.pathname === href;

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 backdrop-blur-sm border border-primary/30">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-sm">Admin Panel</h2>
          <p className="text-[10px] text-primary/70 font-medium tracking-wider uppercase">God Mode</p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-4">
          {adminNavCategories.map((category) => (
            <Collapsible key={category.title} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                {category.title}
                <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <nav className="mt-1 space-y-0.5">
                  {category.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          active
                            ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm shadow-primary/10'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
                        )}
                      >
                        <item.icon className={cn('h-4 w-4 transition-colors', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                        {item.title}
                        {active && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {/* Back to App */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <Link
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border/50 p-4">
        <div className="rounded-xl bg-muted/30 backdrop-blur-sm border border-border/30 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3 w-3 text-primary" />
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">System Status</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            All services operational
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:z-50 lg:w-64">
        <div className="flex h-full flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-card border-r border-border/50 shadow-2xl flex flex-col">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b border-border/50 bg-card/80 backdrop-blur-xl flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-bold text-foreground text-sm">Admin</h2>
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard" className="text-xs text-muted-foreground">
            <ChevronLeft className="h-3 w-3 mr-1" />
            Exit
          </Link>
        </Button>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-x-hidden overflow-y-auto pt-14 lg:pt-0 lg:pl-64">
        <div className="min-h-screen p-3 sm:p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

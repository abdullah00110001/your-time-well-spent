import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import QuickActionFAB from './QuickActionFAB';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: ReactNode;
  /** Hide the global mobile top bar (logo + bell) for feature pages that
   *  provide their own header. Bottom nav stays visible. */
  hideMobileHeader?: boolean;
}

export default function AppLayout({ children, hideMobileHeader = false }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:z-50 lg:w-64">
        <Sidebar />
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav hideTopBar={hideMobileHeader} />
      
      {/* Main content area */}
      <main className={`flex-1 w-full lg:pt-0 lg:pl-64 ${hideMobileHeader ? 'pt-0' : 'pt-14'}`}>
        <div className={isMobile ? "min-h-[calc(100vh-4rem)] pb-[90px] animate-fade-in" : "min-h-screen pb-8 animate-fade-in"}>
          {children}
        </div>
      </main>

      {/* Quick Action FAB */}
      <QuickActionFAB />
    </div>
  );
}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { CapacitorProvider } from "@/contexts/CapacitorContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import SmartNotificationProvider from "@/components/notifications/SmartNotifications";
import { useState, useEffect } from "react";
import { isNative } from "@/lib/capacitor/platform";
import NativeSplash from "@/components/NativeSplash";
import AnnouncementPopup from "@/components/AnnouncementPopup";
import JoinByInviteHandler from "@/components/JoinByInviteHandler";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useLiveUpdate } from "@/hooks/useLiveUpdate";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen as CapSplashScreen } from "@capacitor/splash-screen";
import { toast } from "sonner";
import { getRingingAlarmId } from "@/lib/capacitor/riseAlarmBridge";
import { OfflineGuardProvider } from "@/components/OfflineGuard";

// Pages Import
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import Features from "./pages/marketing/Features";
import Permissions from "./pages/marketing/Permissions";
import Privacy from "./pages/marketing/Privacy";
import PrivacyPolicy from "./pages/marketing/PrivacyPolicy";
import About from "./pages/marketing/About";
import Contact from "./pages/marketing/Contact";
import Faq from "./pages/marketing/Faq";
import Roadmap from "./pages/marketing/Roadmap";
import Changelog from "./pages/marketing/Changelog";
import Pricing from "./pages/marketing/Pricing";
import Terms from "./pages/marketing/Terms";
import Refund from "./pages/marketing/Refund";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Goals from "./pages/Goals";
import Habits from "./pages/Habits";
import Calendar from "./pages/Calendar";
import Journal from "./pages/Journal";
import Journey from "./pages/Journey";
import Leaderboard from "./pages/Leaderboard";
import LifeDistribution from "./pages/LifeDistribution";
import KnowledgeShelf from "./pages/KnowledgeShelf";
import QuarterlyGoals from "./pages/QuarterlyGoals";
import MonthlyHighlights from "./pages/MonthlyHighlights";
import FutureLetter from "./pages/FutureLetter";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import YearEndWrapped from "./pages/YearEndWrapped";
import DataExport from "./pages/DataExport";
import DailyInput from "./pages/DailyInput";
import NightMuhasaba from "./pages/NightMuhasaba";
import WeeklyReview from "./pages/WeeklyReview";
import AdminCommand from "./pages/AdminCommand";
import Gamification from "./pages/Gamification";
import MonthlyReview from "./pages/MonthlyReview";
import IntelligenceEngine from "./pages/IntelligenceEngine";
import Insights from "./pages/Insights";
import IslamicDashboard from "./pages/IslamicDashboard";
import UnifiedDashboard from "./pages/UnifiedDashboard";
import Challenges from "./pages/Challenges";
import Reflections from "./pages/Reflections";
import ComparativeAnalytics from "./pages/ComparativeAnalytics";
import ShieldPage from "./pages/Shield";
import RisePage from "./pages/Rise";
import TimeTracking from "./pages/TimeTracking";
import LifeCalendar from "./pages/LifeCalendar";
import Premium from "./pages/Premium";
import AdminOverview from "./pages/admin/AdminOverview";
import UserInspector from "./pages/admin/UserInspector";
import AtRiskUsers from "./pages/admin/AtRiskUsers";
import FeedbackCenter from "./pages/admin/FeedbackCenter";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminCommandCenter from "./pages/admin/AdminCommandCenter";
import AdminPanel from "./pages/admin/AdminPanel";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminRingtones from "./pages/admin/AdminRingtones";
import AdminBundles from "./pages/admin/AdminBundles";
import DownloadApp from "./pages/DownloadApp";
import RiseRingScreen from "./pages/RiseRingScreen";
import NightToRise from "./pages/NightToRise";
import Welcome from "./pages/Welcome";
import { NightToRiseGuard } from "@/components/rise/night-to-rise/NightToRiseGuard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: (failureCount) => {
        if (!navigator.onLine) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const AppContent = () => {
  usePushNotifications();
  const navigate = useNavigate();
  const [isAppInitialized, setIsAppInitialized] = useState(false);

  useEffect(() => {
    // 🟢 Gatekeeper: শুধু একবার চেক করবে অ্যাপ স্টার্ট হওয়ার সময়
    const handleInitialRedirect = async () => {
      if (isNative) {
        try {
          const id = await getRingingAlarmId();
          if (id) {
            navigate(`/rise/ring/${id}`, { replace: true });
          }
        } catch (e) {
          console.error("Redirect check failed", e);
        }
      }
      setIsAppInitialized(true);
    };

    handleInitialRedirect();

    // 🟢 Event Listener: অ্যাপ যখন ব্যাকগ্রাউন্ড থেকে সামনে আসবে তখন জাস্ট একবার চেক করবে
    const listener = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive && isNative) {
        const id = await getRingingAlarmId();
        if (id) {
          navigate(`/rise/ring/${id}`, { replace: true });
        }
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate]);

  // চেক শেষ না হওয়া পর্যন্ত কিছুই রেন্ডার হবে না
  if (!isAppInitialized) return null;

  return (
    <>
      <Toaster />
      <Sonner />
      <SmartNotificationProvider />
      <ScrollToTop />
      <AnnouncementPopup />
      <NightToRiseGuard />
      <JoinByInviteHandler />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/download" element={<DownloadApp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
        <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
        <Route path="/journey" element={<ProtectedRoute><Journey /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/life-distribution" element={<ProtectedRoute><LifeDistribution /></ProtectedRoute>} />
        <Route path="/knowledge-shelf" element={<ProtectedRoute><KnowledgeShelf /></ProtectedRoute>} />
        <Route path="/quarterly-goals" element={<ProtectedRoute><QuarterlyGoals /></ProtectedRoute>} />
        <Route path="/monthly-highlights" element={<ProtectedRoute><MonthlyHighlights /></ProtectedRoute>} />
        <Route path="/future-letter" element={<ProtectedRoute><FutureLetter /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/wrapped" element={<ProtectedRoute><YearEndWrapped /></ProtectedRoute>} />
        <Route path="/export" element={<ProtectedRoute><DataExport /></ProtectedRoute>} />
        <Route path="/daily-input" element={<ProtectedRoute><DailyInput /></ProtectedRoute>} />
        <Route path="/night-muhasaba" element={<ProtectedRoute><NightMuhasaba /></ProtectedRoute>} />
        <Route path="/monthly-review" element={<ProtectedRoute><MonthlyReview /></ProtectedRoute>} />
        <Route path="/intelligence" element={<ProtectedRoute><IntelligenceEngine /></ProtectedRoute>} />
        <Route path="/weekly-review" element={<ProtectedRoute><WeeklyReview /></ProtectedRoute>} />
        <Route path="/admin-command" element={<ProtectedRoute><AdminCommand /></ProtectedRoute>} />
        <Route path="/gamification" element={<ProtectedRoute><Gamification /></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
        <Route path="/islamic-dashboard" element={<ProtectedRoute><IslamicDashboard /></ProtectedRoute>} />
        <Route path="/unified-dashboard" element={<ProtectedRoute><UnifiedDashboard /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
        <Route path="/reflections" element={<ProtectedRoute><Reflections /></ProtectedRoute>} />
        <Route path="/comparative-analytics" element={<ProtectedRoute><ComparativeAnalytics /></ProtectedRoute>} />
        <Route path="/shield" element={<ProtectedRoute><ShieldPage /></ProtectedRoute>} />
        <Route path="/rise" element={<ProtectedRoute><RisePage /></ProtectedRoute>} />
        <Route path="/rise/night-to-rise" element={<ProtectedRoute><NightToRise /></ProtectedRoute>} />
        
        {/* 🟢 ওয়েক আপ স্ক্রিন - কোনো ড্যাশবোর্ড ফিলিকার ছাড়াই সরাসরি এখানে ল্যান্ড করবে */}
        <Route path="/rise/ring/:id" element={<RiseRingScreen />} />
        <Route path="/rise/ring" element={<RiseRingScreen />} />
        
        <Route path="/time-tracking" element={<ProtectedRoute><TimeTracking /></ProtectedRoute>} />
        <Route path="/life-calendar" element={<ProtectedRoute><LifeCalendar /></ProtectedRoute>} />
        <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminProtectedRoute><AdminOverview /></AdminProtectedRoute>} />
        <Route path="/admin/users" element={<AdminProtectedRoute><UserInspector /></AdminProtectedRoute>} />
        <Route path="/admin/at-risk" element={<AdminProtectedRoute><AtRiskUsers /></AdminProtectedRoute>} />
        <Route path="/admin/feedback" element={<AdminProtectedRoute><FeedbackCenter /></AdminProtectedRoute>} />
        <Route path="/admin/analytics" element={<AdminProtectedRoute><AdminAnalytics /></AdminProtectedRoute>} />
        <Route path="/admin/notifications" element={<AdminProtectedRoute><AdminNotifications /></AdminProtectedRoute>} />
        <Route path="/admin/panel" element={<AdminProtectedRoute><AdminPanel /></AdminProtectedRoute>} />
        <Route path="/admin/command" element={<AdminProtectedRoute><AdminCommandCenter /></AdminProtectedRoute>} />
        <Route path="/admin/announcements" element={<AdminProtectedRoute><AdminAnnouncements /></AdminProtectedRoute>} />
        <Route path="/admin/ringtones" element={<AdminProtectedRoute><AdminRingtones /></AdminProtectedRoute>} />
        <Route path="/admin/bundles" element={<AdminProtectedRoute><AdminBundles /></AdminProtectedRoute>} />
        <Route path="/features" element={<Features />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/refund" element={<Refund />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

/**
 * AppBoot — single gatekeeper that:
 *   1. Keeps the native + React splash visible until auth resolves
 *   2. Kicks off Capawesome OTA sync on native after auth
 *   3. Renders nothing else until auth.loading === false (prevents FOUC)
 */
const SPLASH_SESSION_KEY = 'lifeos_splash_shown_v1';

const AppBoot = () => {
  const { loading: authLoading } = useAuth();
  // Web: show splash only once per browser session
  const [splashGone, setSplashGone] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (isNative) return false;
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
  });
  const [alarmRouteDetected, setAlarmRouteDetected] = useState(
    typeof window !== 'undefined' && window.location.pathname.startsWith('/rise/ring'),
  );

  useLiveUpdate({ onApplied: () => toast.success('App updated to latest version ✓') });

  useEffect(() => {
    if (!isNative) return;
    (async () => {
      try {
        const launch: any = await (CapApp as any).getLaunchUrl?.();
        const url: string | undefined = launch?.url;
        if (url && url.includes('/rise/ring')) {
          setAlarmRouteDetected(true);
          CapSplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
          try {
            const u = new URL(url);
            if (!window.location.pathname.startsWith('/rise/ring')) {
              window.history.replaceState({}, '', u.pathname);
            }
          } catch {}
          return;
        }
      } catch {}
      try {
        const ringing = await getRingingAlarmId();
        if (ringing) {
          setAlarmRouteDetected(true);
          CapSplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
          if (!window.location.pathname.startsWith('/rise/ring')) {
            window.history.replaceState({}, '', `/rise/ring/${ringing}`);
          }
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isNative) CapSplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
  }, [authLoading]);

  const isAlarmRoute = alarmRouteDetected
    || (typeof window !== 'undefined' && window.location.pathname.startsWith('/rise/ring'));

  if (isAlarmRoute) return <AppContent />;

  // Web: skip splash entirely after the first show this session
  if (!isNative && splashGone) return <AppContent />;

  if (authLoading) {
    return <NativeSplash waitFor={true} minimumDuration={isNative ? 2200 : 1200} />;
  }

  if (!splashGone) {
    return (
      <NativeSplash
        waitFor={false}
        minimumDuration={isNative ? 2200 : 1200}
        onComplete={() => {
          if (!isNative && typeof window !== 'undefined') {
            window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
          }
          setSplashGone(true);
        }}
      />
    );
  }

  return <AppContent />;
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <CapacitorProvider>
              <LanguageProvider>
                <AppModeProvider>
                  <TooltipProvider>
                    <BrowserRouter>
                      <OfflineGuardProvider>
                        <AppBoot />
                      </OfflineGuardProvider>
                    </BrowserRouter>
                  </TooltipProvider>
                </AppModeProvider>
              </LanguageProvider>
            </CapacitorProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

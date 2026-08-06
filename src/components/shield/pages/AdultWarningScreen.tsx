import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, BrainCircuit, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function AdultWarningScreen() {
  const navigate = useNavigate();

  // Settings থেকে real-time ডাটা নাও TanStack Query দিয়ে
  const { data: settings } = useQuery({
    queryKey: ['shield_settings'],
    queryFn: () => JSON.parse(localStorage.getItem('shield_settings') || '{}'),
    staleTime: Infinity // Settings খুব বেশি চেঞ্জ হয় না
  });

  const isIslamicMode = settings?.islamicMode?? true;

  useEffect(() => {
    // স্ক্রিন ওপেন হলেই Haptic Feedback + ব্যাক বাটন ডিসেবল
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 200]) // স্ট্রং ওয়ার্নিং প্যাটার্ন
    }

    // Android back button disable যাতে ইউজার ব্যাক যেতে না পারে
    const handleBackButton = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.pathname);
    };

    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, []);

  const handleGoBack = () => {
    // আগের অ্যাপ/স্ক্রিনে ব্যাক যাও। ফলব্যাক হিসেবে /shield
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/shield', { replace: true });
    }
  };

  const handleReportMistake = () => {
    toast.info("Reported to Shield AI. We'll review this detection.", {
      duration: 3000,
    });
    handleGoBack(); // রিপোর্ট করার পর অটো ব্যাক
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6 text-center animate-in fade-in duration-300">
      {/* Background Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 space-y-8 max-w-md w-full">
        {/* Top Icon */}
        <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
          <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse" />
        </div>

        {isIslamicMode? (
          /* ================= ISLAMIC MODE ================= */
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <h2 className="text-3xl font-extrabold text-red-500">নজরের হেফাজত করুন</h2>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                <p className="text-2xl font-serif leading-relaxed mb-4 text-emerald-400" dir="rtl">
                  قُل لِّلْمُؤْمِنِينَ يَغُضُّوا مِنْ أَبْصَارِهِمْ وَيَحْفَظُوا فُرُوجَهُمْ ۚ ذَٰلِكَ أَزْكَىٰ لَهُمْ
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  "মুমিনদেরকে বলুন, তারা যেন তাদের দৃষ্টি অবনত রাখে এবং তাদের যৌনাঙ্গের হেফাজত করে। এতেই তাদের জন্য অধিক পবিত্রতা রয়েছে।" (সূরা আন-নূর: ৩০)
                </p>
              </div>
            </div>
            <p className="text-lg font-medium text-white/80">
              আল্লাহ আপনার সব কাজ দেখছেন। <br /> শয়তানের ধোঁকা থেকে ফিরে আসুন।
            </p>
          </div>
        ) : (
          /* ================= NORMAL MODE ================= */
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tighter text-red-500 uppercase">Protect Your Brain</h2>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                <BrainCircuit className="w-10 h-10 text-blue-400 mx-auto mb-4" />
                <p className="text-xl font-bold leading-tight">
                  Do not trade your long-term peace for a few seconds of cheap dopamine.
                </p>
              </div>
            <p className="text-base text-white/70 leading-relaxed">
              This content rewires your brain, kills motivation, and destroys real-life satisfaction.
              <span className="block mt-2 font-semibold text-white/90">Take control back. You are better than this.</span>
            </p>
          </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleGoBack}
            className="w-full h-14 bg-white text-black hover:bg-white/90 rounded-2xl font-bold text-lg shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-all active:scale-95"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Discipline
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-white/40 hover:text-white/70 hover:bg-white/5 w-full"
            onClick={handleReportMistake}
          >
            <Flag className="mr-2 h-3 w-3" />
            This was a mistake?
          </Button>
        </div>

        <p className="text-xs text-white/30 pt-2">Shield Hardcore Enforcement Active 🛡️</p>
      </div>
    </div>
  );
}
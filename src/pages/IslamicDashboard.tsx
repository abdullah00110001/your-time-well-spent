import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import NiyyahValidator from '@/components/islamic/NiyyahValidator';
import BarakahIndex from '@/components/islamic/BarakahIndex';
import NafsCounter from '@/components/islamic/NafsCounter';
import TawbahProtocol from '@/components/islamic/TawbahProtocol';
import GhaflahMeter from '@/components/islamic/GhaflahmMeter';
import SadaqahTracker from '@/components/islamic/SadaqahTracker';
import QuranicAnchorSystem from '@/components/islamic/QuranicAnchor';
import MawtMode from '@/components/islamic/MawtMode';
import TahajjudAnalytics from '@/components/islamic/TahajjudAnalytics';
import AkhirahRatio from '@/components/islamic/AkhirahRatio';
import { toast } from 'sonner';

export default function IslamicDashboard() {
  const { user } = useAuth();
  const [showNiyyah, setShowNiyyah] = useState(false);
  const [showMawt, setShowMawt] = useState(false);
  const [dailyData, setDailyData] = useState<any>(null);

  const currentHour = new Date().getHours();
  const isFriday = new Date().getDay() === 5;

  useEffect(() => {
    if (isFriday && !localStorage.getItem('mawt_shown_' + new Date().toDateString())) {
      setShowMawt(true);
      localStorage.setItem('mawt_shown_' + new Date().toDateString(), 'true');
    }
  }, [isFriday]);

  const handleNiyyahConfirm = (niyyah: string, multiplier: number) => {
    toast.success(`Session started with ${multiplier}x multiplier`);
    setShowNiyyah(false);
  };

  const handleMawtSubmit = (preparedness: number) => {
    toast.success('Reflection saved. May Allah grant you readiness.');
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Islamic Productivity Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AkhirahRatio
          worshipScore={75}
          duniaScore={60}
          salahCompleted={4}
          quranMinutes={20}
          sadaqahDone={true}
          studyMinutes={120}
          exerciseMinutes={30}
        />
        <NafsCounter urgesResisted={5} urgesSuccumbed={1} />
        <QuranicAnchorSystem />
        <TahajjudAnalytics
          data={[]}
          tahajjudPerformed={false}
          onTahajjudToggle={() => {}}
        />
        <GhaflahMeter activeLearningMinutes={90} mindlessScrollingMinutes={30} />
        <SadaqahTracker totalHours={5} serviceLogs={[]} onLogService={() => {}} />
        <TawbahProtocol
          currentScore={30}
          targetScore={100}
          currentHour={currentHour}
          dayResetUsed={false}
          onReset={() => toast.success('Fresh start activated!')}
        />
        <BarakahIndex sessions={[]} bestTimeSlot="After Fajr" averageBarakah={7.5} />
      </div>

      <NiyyahValidator isOpen={showNiyyah} onClose={() => setShowNiyyah(false)} onConfirm={handleNiyyahConfirm} />
      <MawtMode isOpen={showMawt} onClose={() => setShowMawt(false)} onSubmit={handleMawtSubmit} />
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bed, Sun } from 'lucide-react';
import { MathMission }    from '@/components/rise/missions/MathMission';
import { ShakeMission }   from '@/components/rise/missions/ShakeMission';
import { BarcodeMission } from '@/components/rise/missions/BarcodeMission';
import { PhotoMission }   from '@/components/rise/missions/PhotoMission';
import { TypingMission }  from '@/components/rise/missions/TypingMission';
import { WakeStatusModal }      from '@/components/rise/WakeStatusModal';
import { LocationPrivacySheet } from '@/components/rise/LocationPrivacySheet';

import { isNative } from '@/lib/capacitor/platform';
import { cancelAlarmByUuid, scheduleAlarm, uuidToNumericId } from '@/lib/capacitor/nativeAlarm';
import { readLocalAlarms, updateLocalAlarm } from '@/lib/rise/localAlarms';
import { toast } from 'sonner';
import { stopNativeRinging, clearRingingAlarmId, baseAlarmUuid, scheduleOneShotAlarm } from '@/lib/capacitor/riseAlarmBridge';
import { setPresence } from '@/hooks/useLifeosLive';
import { supabase } from '@/integrations/supabase/client';
import { App } from '@capacitor/app';
import { format } from 'date-fns';
import { recordWakeEvent } from '@/lib/rise/recordWakeEvent';

interface LocalAlarm {
  id: string;
  alarm_time: string;
  label: string | null;
  intention: string | null;
  verification_type: string;
  snooze_limit: number;
  snooze_interval_minutes: number;
  vibration_enabled?: boolean;
  extra_loud?: boolean;
  wallpaper_url?: string | null;
  ringtone_url?: string | null;
  mission_config?: {
    difficulty: 'easy' | 'medium' | 'hard';
    count: number;
    targetBarcode?: string;
    photoLocation?: string;
    photoDataUrl?: string;
    typingPhrase?: string;
  };
}

const PER_PROBLEM_SECONDS: Record<string, number> = { easy: 120, medium: 60, hard: 30 };
const VALID_MISSIONS = ['math', 'shake', 'qr', 'barcode', 'photo', 'typing'];

export default function RiseRingScreen() {
  const { id: rawId } = useParams<{ id: string }>();
  // Native deep-links carry the suffixed uuid (`<id>_day3`, `<id>-snooze`),
  // so always resolve to the base alarm id before any lookup.
  const id = baseAlarmUuid(rawId) || rawId;
  const navigate = useNavigate();

  const [alarm,            setAlarm]            = useState<LocalAlarm | null>(null);
  const [phase,            setPhase]            = useState<'wake' | 'mission'>('wake');
  const [showStatusModal,  setShowStatusModal]  = useState(false);
  const [statusBusy,       setStatusBusy]       = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [snoozesLeft,      setSnoozesLeft]      = useState(0);
  const [now,              setNow]              = useState(new Date());

  const isCompletedRef    = useRef(false);
  const audioRef          = useRef<HTMLAudioElement | null>(null);
  const vibrationTimer    = useRef<number | null>(null);
  

  useEffect(() => {
    setPresence({ status: phase === 'wake' ? 'waking' : 'in_rise_mission' });
  }, [phase]);

  // Back button is suppressed while ringing. No re-navigation loop on
  // background: the native AlarmSoundService keeps the alarm alive, and
  // re-navigating to the current route did nothing but churn the router.
  useEffect(() => {
    let cancelled = false;
    const handles: Array<{ remove: () => void }> = [];

    App.addListener('backButton', () => {
      if (isCompletedRef.current) return;
      toast.error('Complete the mission to dismiss', { duration: 1000 });
    }).then((h) => {
      if (cancelled) { h.remove(); return; }
      handles.push(h);
    });

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, []);

  // NOTE: the ringing flag is intentionally NOT cleared on mount. It used to be,
  // which meant the native state said "not ringing" the moment this screen
  // rendered — so a kill/relaunch lost the alarm and Rise Guard never armed.
  // The flag is cleared only by an explicit dismiss/mission completion
  // (stopAlarm → clearRingingAlarmId).

  // ✅ alarm load — alarm-specific config প্রায়োরিটি পায়
  useEffect(() => {
    try {
      const stored = readLocalAlarms();
      const found  = stored.find((a: any) => String(a.id) === String(id));
      if (found) {
        let cfg = found.mission_config ?? null;
        if (!cfg) {
          try {
            const raw = localStorage.getItem(`rise_mission_cfg_${found.verification_type}`);
            if (raw) cfg = JSON.parse(raw);
          } catch {}
        }
        setAlarm({ ...found, mission_config: cfg });
        setSnoozesLeft(found.snooze_limit ?? 3);
      } else {
        setAlarm({
          id: id || 'fallback',
          alarm_time: new Date().toTimeString().slice(0, 5),
          label: 'Wake Up',
          intention: 'Time to start the day',
          verification_type: 'none',
          snooze_limit: 3,
          snooze_interval_minutes: 5,
          vibration_enabled: true,
        });
        setSnoozesLeft(3);
      }
    } catch (e) { console.error('Error loading alarm:', e); }
  }, [id]);

  // Clock only renders HH:MM — tick on the minute boundary, not every second.
  useEffect(() => {
    let timer: number;
    const tick = () => {
      setNow(new Date());
      const msToNextMinute = 60000 - (Date.now() % 60000);
      timer = window.setTimeout(tick, msToNextMinute + 20);
    };
    const msToNextMinute = 60000 - (Date.now() % 60000);
    timer = window.setTimeout(tick, msToNextMinute + 20);
    return () => clearTimeout(timer);
  }, []);

  // Sound + vibration ownership:
  //  • native  → AlarmSoundService (started by RiseAlarmReceiver) owns both.
  //              Running a JS haptics loop on top of it double-buzzed the
  //              device and fought the native pattern, so JS stays out.
  //  • web/dev → the browser audio element is the only source.
  useEffect(() => {
    if (!alarm || isNative) return;
    const extraLoud = alarm.extra_loud === true;
    try {
      const audio = new Audio(alarm.ringtone_url || '');
      audio.loop = true;
      audio.volume = extraLoud ? 1.0 : 0.6;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {}

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [alarm]);

  const stopAlarm = async () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (vibrationTimer.current) { clearInterval(vibrationTimer.current); vibrationTimer.current = null; }
    try { await stopNativeRinging(); } catch {}
    try { await clearRingingAlarmId(); } catch {}
  };

  const handleMissionComplete = async () => {
    isCompletedRef.current = true;
    try { await stopAlarm(); } catch {}
    try { await setPresence({ status: 'idle' }); } catch {}

    if (alarm?.id && alarm.id !== 'fallback') {
      try {
        await cancelAlarmByUuid(`${alarm.id}-snooze`);
        await cancelAlarmByUuid(`${alarm.id}-followup`);
      } catch {}
    }

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await recordWakeEvent({ userId: user.id, missionType: alarm?.verification_type, alarmLabel: alarm?.label });
        const groupId = (alarm as any)?.groupId;
        if (groupId) { void Promise.resolve(supabase.rpc('record_group_wake' as any, { _group_id: groupId })).catch(() => {}); }
      } catch {}
    })();

    toast.success('Alarm dismissed. Have a great day! ☀️');
    navigate('/rise', { replace: true });
  };

  const handleSnooze = async () => {
    if (!alarm) return;
    if (snoozesLeft <= 0) { toast.error('No snoozes left.'); setPhase('mission'); return; }
    await stopAlarm();

    const mins = alarm.snooze_interval_minutes ?? 5;
    const next = new Date(Date.now() + mins * 60 * 1000);

    // Absolute one-shot: the old recurring path resolved "next occurrence of
    // this weekday", so a snooze across midnight could land up to 6 days out.
    try {
      if (isNative) {
        await scheduleOneShotAlarm(`${alarm.id}-snooze`, next, {
          title: alarm.label || 'Rise Alarm',
          body: alarm.intention || 'Snooze over!',
          extraLoud: alarm.extra_loud ?? false,
          soundUri: alarm.ringtone_url ?? null,
        });
      } else {
        await scheduleAlarm({
          id: uuidToNumericId(`${alarm.id}-snooze`),
          title: alarm.label || 'Rise Alarm',
          body: alarm.intention || 'Snooze over!',
          scheduledAt: next,
          missionType: (alarm.verification_type as any) ?? 'none',
          extraLoud: alarm.extra_loud ?? false,
          snoozeMinutes: mins,
          alarmDbId: alarm.id,
        });
      }
    } catch (e) { console.error('[Rise] snooze schedule failed', e); }

    updateLocalAlarm(alarm.id, { snooze_limit: Math.max(0, snoozesLeft - 1) });


    setSnoozesLeft(n => Math.max(0, n - 1));
    toast.success(`Snoozed for ${mins} minutes`);
    isCompletedRef.current = true;
    navigate('/rise', { replace: true });
  };

  const handleStatusSubmit = async (text: string) => {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const grpId = (alarm as any)?.groupId;
      if (!grpId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not authenticated'); return; }
      const today = format(new Date(), 'yyyy-MM-dd');
      const nowIso = new Date().toISOString();
      const { data: sessionRow } = await supabase.from('group_wake_sessions').select('id').eq('group_id', grpId).eq('session_date', today).maybeSingle();
      let sessionId = sessionRow?.id;
      if (!sessionId) {
        const { data: alarmRow } = await supabase.from('group_wake_alarms').select('id').eq('group_id', grpId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (alarmRow) {
          const { data: newSession } = await supabase.from('group_wake_sessions').insert({ group_alarm_id: alarmRow.id, group_id: grpId, session_date: today }).select('id').single();
          sessionId = newSession?.id;
        }
      }
      if (sessionId) {
        await supabase.from('group_wake_member_status').upsert({
          session_id: sessionId, group_id: grpId, user_id: user.id,
          status: 'mission_done', status_text: text,
          mission_completed_at: nowIso, status_updated_at: nowIso,
        }, { onConflict: 'session_id,user_id' });
      }
      toast.success('Status shared ☀️');
      setShowStatusModal(false);
      isCompletedRef.current = true;
      navigate('/rise', { replace: true });
    } catch { toast.error('Could not share status'); }
    finally { setStatusBusy(false); }
  };

  if (!alarm) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Sun className="h-12 w-12 text-amber-500 animate-spin mb-4" />
        <p>Loading alarm...</p>
      </div>
    );
  }

  const hours    = now.getHours();
  const minutes  = now.getMinutes();
  const ampm     = hours >= 12 ? 'PM' : 'AM';
  const displayH = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const dateStr  = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const missionType    = alarm.verification_type;
  const isValidMission = VALID_MISSIONS.includes(missionType);
  const cfg            = alarm.mission_config;

  if (phase === 'mission') {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-950">
        {missionType === 'math' && (
          <MathMission onComplete={handleMissionComplete} requiredSolves={cfg?.count ?? 3} perProblemSeconds={PER_PROBLEM_SECONDS[cfg?.difficulty ?? 'medium']} />
        )}
        {missionType === 'shake' && (
          <ShakeMission onComplete={handleMissionComplete} requiredShakes={(cfg?.count ?? 3) * (cfg?.difficulty === 'hard' ? 15 : cfg?.difficulty === 'easy' ? 5 : 10)} />
        )}
        {(missionType === 'qr' || missionType === 'barcode') && (
          <BarcodeMission onComplete={handleMissionComplete} targetBarcode={cfg?.targetBarcode || 'WAKE-UP'} />
        )}
        {missionType === 'photo' && (
          <PhotoMission onComplete={handleMissionComplete} registeredPlace={cfg?.photoLocation || 'your morning spot'} registeredPhotoUrl={cfg?.photoDataUrl} />
        )}
        {missionType === 'typing' && (
          <TypingMission onComplete={handleMissionComplete} phrase={cfg?.typingPhrase || 'I am ready for today'} requiredCount={cfg?.count ?? 1} />
        )}
        {(!isValidMission || missionType === 'none') && (
          <div className="flex flex-col h-full items-center justify-center p-6 text-white">
            <Sun className="h-20 w-20 text-amber-400 mb-6" />
            <h2 className="text-3xl font-bold mb-2">Good Morning</h2>
            <p className="text-white/60 mb-10 text-center max-w-xs">{alarm.intention || 'Have a great day!'}</p>
            <Button onClick={handleMissionComplete} className="h-14 px-12 bg-amber-500 hover:bg-amber-600 rounded-2xl text-lg font-semibold">
              I'm Awake ☀️
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[200] bg-gradient-to-b from-amber-600 via-orange-600 to-rose-700 text-white flex flex-col"
        style={alarm.wallpaper_url ? { backgroundImage: `url("${alarm.wallpaper_url}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {alarm.wallpaper_url && <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70 pointer-events-none" />}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />

        <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
          <Sun className="h-16 w-16 text-white/90 animate-pulse mb-6" />
          <p className="text-sm uppercase tracking-[0.2em] text-white/70 mb-2">{dateStr}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-8xl font-black tabular-nums tracking-tight">{displayH}:{minutes.toString().padStart(2,'0')}</span>
            <span className="text-2xl font-bold text-white/80">{ampm}</span>
          </div>
          {alarm.label     && <p className="mt-6 text-2xl font-bold text-white/95">{alarm.label}</p>}
          {alarm.intention && <p className="mt-3 text-base text-white/80 text-center max-w-xs italic">"{alarm.intention}"</p>}
        </div>

        <div className="p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] space-y-3 relative z-10">
          <Button onClick={() => setPhase('mission')} className="w-full h-16 bg-white text-amber-700 hover:bg-white/90 rounded-2xl text-lg font-bold shadow-2xl">
            <Sun className="h-5 w-5 mr-2" />
            {(!isValidMission || missionType === 'none') ? 'Dismiss Alarm' : 'Wake Up — Start Mission'}
          </Button>
          <Button onClick={handleSnooze} variant="ghost" disabled={snoozesLeft <= 0} className="w-full h-14 text-white/90 hover:bg-white/10 rounded-2xl text-base font-medium">
            <Bed className="h-5 w-5 mr-2" />
            Snooze {alarm.snooze_interval_minutes}m {snoozesLeft > 0 ? `(${snoozesLeft} left)` : '(none left)'}
          </Button>
        </div>
      </div>

      <WakeStatusModal open={showStatusModal} onClose={() => { setShowStatusModal(false); isCompletedRef.current = true; navigate('/rise', { replace: true }); }} onSubmit={handleStatusSubmit} />
      <LocationPrivacySheet open={showPrivacySheet} onOpenChange={(o) => { setShowPrivacySheet(o); if (!o) { isCompletedRef.current = true; navigate('/rise', { replace: true }); } }} />
    </>
  );
}

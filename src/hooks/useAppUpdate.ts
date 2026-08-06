/* import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CURRENT_APP_VERSION_CODE } from '@/constants/version';
import { isNative } from '@/lib/capacitor/platform';

interface UpdateState {
  showPrompt: boolean;
  showForceScreen: boolean;
  downloadUrl: string;
  isForceUpdate: boolean;
  releaseNotes: string | null;
  latestVersion: number;
}

export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>({
    showPrompt: false,
    showForceScreen: false,
    downloadUrl: '',
    isForceUpdate: false,
    releaseNotes: null,
    latestVersion: 0,
  });

  useEffect(() => {
    // Delay check slightly to let app stabilize
    const timer = setTimeout(() => checkForUpdate(), 2000);
    return () => clearTimeout(timer);
  }, []);

  const checkForUpdate = async () => {
    try {
      const { data, error } = await supabase
        .from('app_metadata')
        .select('latest_version_code, download_url, is_force_update, release_notes')
        .limit(1)
        .single();

      if (error || !data) return;

      const { latest_version_code, download_url, is_force_update, release_notes } = data;

      if (latest_version_code <= CURRENT_APP_VERSION_CODE) return;
      if (!download_url) return;

      // Check snooze (skip for force updates)
      if (!is_force_update) {
        const snoozeUntil = localStorage.getItem('update_snooze_until');
        if (snoozeUntil && Date.now() < Number(snoozeUntil)) return;
      }

      // Force update on native → full-screen block. Otherwise dialog.
      if (is_force_update && isNative) {
        setState({
          showPrompt: false,
          showForceScreen: true,
          downloadUrl: download_url,
          isForceUpdate: true,
          releaseNotes: release_notes ?? null,
          latestVersion: latest_version_code,
        });
      } else {
        setState({
          showPrompt: true,
          showForceScreen: false,
          downloadUrl: download_url,
          isForceUpdate: is_force_update,
          releaseNotes: release_notes ?? null,
          latestVersion: latest_version_code,
        });
      }
    } catch {
      // silently fail
    }
  };

  const dismiss = () => {
    if (!state.isForceUpdate) {
      setState((s) => ({ ...s, showPrompt: false }));
    }
  }; 

  return { ...state, dismiss };
}
 */ 
 export function useAppUpdate() {
  // OTA ফিচার ডিজেবল করা হয়েছে ক্র্যাশের জন্য
  return {
    showPrompt: false,
    showForceScreen: false,
    downloadUrl: '',
    isForceUpdate: false,
    releaseNotes: null,
    latestVersion: 0,
    dismiss: () => {},
  };
}
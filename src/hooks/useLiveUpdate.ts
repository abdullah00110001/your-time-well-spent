import { useEffect, useRef, useState } from 'react';
import { isNative } from '@/lib/capacitor/platform';
import { supabase } from '@/integrations/supabase/client';
import { CURRENT_APP_VERSION_CODE } from '@/constants/version';

/**
 * Capawesome Live Update integration (self-hosted OTA via Supabase Storage).
 *
 * Flow on native launch:
 *   1. Query the latest active bundle from `public.ota_bundles`
 *   2. If its version differs from the currently installed bundle, download it
 *      via @capawesome/capacitor-live-update and set it as the next bundle
 *   3. On the next app reload, the new bundle is active
 *
 * Web is a no-op. The Capawesome plugin is dynamically imported so missing
 * native code never crashes the app.
 */
export function useLiveUpdate(opts?: { onApplied?: () => void; onForce?: () => void }) {
  const checkedRef = useRef(false);
  const [applied, setApplied] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);

  useEffect(() => {
    if (!isNative || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        // 1) Look up the newest active bundle that matches our native versionCode
        const { data: bundles, error } = await supabase
          .from('ota_bundles' as any)
          .select('id, version, bundle_url, min_app_version_code')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error || !bundles || bundles.length === 0) return;
        const bundle = bundles[0] as any;
        if (
          bundle.min_app_version_code != null &&
          bundle.min_app_version_code > CURRENT_APP_VERSION_CODE
        ) {
          // Native app is too old to safely run this bundle
          setForceUpdate(true);
          opts?.onForce?.();
          return;
        }

        // 2) Resolve the Capawesome plugin at runtime
        const pkg = '@capawesome/capacitor-live-update';
        const mod: any = await import(/* @vite-ignore */ pkg).catch(() => null);
        const LiveUpdate = mod?.LiveUpdate;
        if (!LiveUpdate) return;

        // 3) Compare with the currently installed bundle and skip if already on it
        try {
          const current = await LiveUpdate.getBundle().catch(() => null);
          if (current?.bundleId === bundle.id) return;
        } catch {
          /* getBundle may not exist in older plugin versions — fall through */
        }

        // 4) Download + stage the new bundle
        await LiveUpdate.downloadBundle({
          bundleId: bundle.id,
          url: bundle.bundle_url,
        });
        await LiveUpdate.setNextBundle({ bundleId: bundle.id });

        setApplied(true);
        opts?.onApplied?.();
        // Reload into the new bundle shortly after — let UI breathe first
        setTimeout(() => LiveUpdate.reload?.().catch(() => {}), 800);
      } catch (err) {
        console.warn('[LiveUpdate] sync skipped:', err);
      }
    })();
  }, [opts]);

  return { applied, forceUpdate, setForceUpdate };
}

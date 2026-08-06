import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Download, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { CURRENT_APP_VERSION_CODE } from '@/constants/version';

export default function AppUpdateChecker() {
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    latestCode: number;
    releaseNotes: string | null;
    isForce: boolean;
  } | null>(null);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    const { data } = await supabase
      .from('app_metadata')
      .select('latest_version_code, release_notes, is_force_update')
      .limit(1)
      .maybeSingle();

    if (data && data.latest_version_code > CURRENT_APP_VERSION_CODE) {
      setUpdateInfo({
        latestCode: data.latest_version_code,
        releaseNotes: data.release_notes,
        isForce: data.is_force_update,
      });
    } else {
      setUpdateInfo(null);
    }

    setChecking(false);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-subtitle flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          App Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Version Code</p>
            <Badge variant="outline">{CURRENT_APP_VERSION_CODE}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={checkForUpdates} disabled={checking}>
            <RefreshCw className={`h-4 w-4 mr-1 ${checking ? 'animate-spin' : ''}`} />
            Check
          </Button>
        </div>

        {updateInfo ? (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-foreground">
                New version available (code {updateInfo.latestCode})
              </span>
              {updateInfo.isForce && (
                <Badge variant="destructive" className="text-[10px]">Required</Badge>
              )}
            </div>
            {updateInfo.releaseNotes && (
              <p className="text-xs text-muted-foreground">{updateInfo.releaseNotes}</p>
            )}
            <Button
              onClick={() => window.location.href = '/download'}
              className="w-full gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Go to Download Page
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl border bg-card">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">You're up to date!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

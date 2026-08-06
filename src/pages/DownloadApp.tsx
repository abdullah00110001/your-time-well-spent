import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Download, Loader2, Shield, Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DownloadApp() {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchDownloadInfo();
  }, []);

  const fetchDownloadInfo = async () => {
    let apkUrl: string | null = null;
    let update: any = null;

    // Get latest update info
    const { data: updateData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_updates')
      .maybeSingle();

    if (updateData?.value) {
      const val = updateData.value as any;
      const activeUpdates = (val.updates || []).filter((u: any) => u.is_active);
      if (activeUpdates.length > 0) {
        update = activeUpdates[0];
        setLatestUpdate(update);
      }
    }

    // Get APK download URL from storage (latest uploaded file)
    try {
      const { data: files } = await supabase.storage.from('app-releases').list('', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      // Find the first .apk file
      const apkFile = files?.find(f => f.name.endsWith('.apk'));
      if (apkFile) {
        const { data: urlData } = supabase.storage.from('app-releases').getPublicUrl(apkFile.name);
        apkUrl = urlData.publicUrl;
      }
    } catch {
      // Storage bucket may not exist yet
    }

    // Fallback: use admin-set download URL
    if (!apkUrl && update?.download_url) {
      apkUrl = update.download_url;
    }

    // Also check app_metadata table
    if (!apkUrl) {
      const { data: metaData } = await supabase
        .from('app_metadata')
        .select('download_url, latest_version_code, release_notes')
        .limit(1)
        .maybeSingle();
      if (metaData?.download_url) {
        apkUrl = metaData.download_url;
        if (!update && metaData.release_notes) {
          setLatestUpdate({ version: metaData.latest_version_code, description: metaData.release_notes });
        }
      }
    }

    setDownloadUrl(apkUrl);
    setLoading(false);
  };

  const handleDownload = () => {
    const url = downloadUrl || latestUpdate?.download_url;
    if (url) {
      setDownloading(true);
      window.open(url, '_blank');
      setTimeout(() => setDownloading(false), 3000);
    }
  };

  const features = [
    'Track daily habits & goals',
    'Islamic mode with Salah tracking',
    'Shield - Digital discipline',
    'Rise - Smart alarm system',
    'AI-powered insights',
    'Offline support',
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <img src="/lifeos-logo-light.png" alt="Life OS" className="h-8 w-8 rounded-xl" />
            <span className="font-bold text-foreground">Life OS</span>
          </div>
          <div className="w-16" />
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4 max-w-2xl mx-auto">
        {/* App Info */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 h-24 w-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xl shadow-primary/10">
            <img src="/lifeos-logo-light.png" alt="Life OS" className="h-16 w-16 rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Life OS</h1>
          <p className="text-muted-foreground">Your complete life tracking companion</p>
          {latestUpdate && (
            <Badge variant="outline" className="mt-3">v{latestUpdate.version}</Badge>
          )}
        </div>

        {/* Download Button */}
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-6 text-center">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            ) : (downloadUrl || latestUpdate?.download_url) ? (
              <>
                <Button
                  size="lg"
                  className="h-14 px-10 text-base shadow-xl shadow-primary/25 gap-2"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  {downloading ? 'Starting Download...' : 'Download APK'}
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  Android 8.0+ required • Enable "Install from unknown sources"
                </p>
              </>
            ) : (
              <div className="py-4">
                <p className="text-muted-foreground">Download not available yet. Check back soon!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* What's New */}
        {latestUpdate && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                What's New in v{latestUpdate.version}
              </h3>
              <p className="text-sm text-muted-foreground">{latestUpdate.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-4">App Features</h3>
            <div className="space-y-3">
              {features.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

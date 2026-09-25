import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { pruneActivityLog } from '@/hooks/useActivityLogger';
import { ChevronLeft, ChevronRight, Download, Loader2, ScrollText, Activity } from 'lucide-react';

interface LogRow {
  id: string;
  created_at: string;
  source: string;
  severity: string;
  reason: string;
  matched_text: string | null;
  context_label: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatStamp(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildLogFile(rows: LogRow[]) {
  return rows
    .map((r) => {
      let line = `[${formatStamp(r.created_at)}] [${r.severity}] ${r.reason}`;
      if (r.matched_text) line += ` — matched: "${r.matched_text}"`;
      if (r.context_label) line += ` (context: ${r.context_label})`;
      return line;
    })
    .join('\n');
}

export default function ActivityLog() {
  const { source } = useParams<{ source?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const activeSource = source ? decodeURIComponent(source) : null;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await pruneActivityLog();
      const { data } = await supabase
        .from('activity_log')
        .select('id, created_at, source, severity, reason, matched_text, context_label')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (!cancelled) {
        setRows((data as LogRow[]) ?? []);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const groups = useMemo(() => {
    const map = new Map<string, { source: string; count: number; latest: string }>();
    for (const r of rows) {
      const g = map.get(r.source);
      if (!g) map.set(r.source, { source: r.source, count: 1, latest: r.created_at });
      else {
        g.count += 1;
        if (r.created_at > g.latest) g.latest = r.created_at;
      }
    }
    return [...map.values()].sort((a, b) => (a.latest < b.latest ? 1 : -1));
  }, [rows]);

  const detailRows = useMemo(
    () => (activeSource ? rows.filter((r) => r.source === activeSource) : []),
    [rows, activeSource]
  );

  const handleDownload = () => {
    if (!activeSource) return;
    const blob = new Blob([buildLogFile(detailRows)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSource.replace(/[^a-z0-9_-]+/gi, '_')}.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto pb-24 lg:pb-8">
        <div className="mb-4 flex items-start gap-2">
          {activeSource && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/activity-log')} aria-label="Back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-headline font-bold tracking-tight">
              {activeSource ?? 'Activity log'}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">
              {activeSource ? `${detailRows.length} entries, newest first` : 'Your recent events, grouped by source'}
            </p>
          </div>
          {activeSource && detailRows.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" /> .log
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : activeSource ? (
          detailRows.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No entries for this source.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {detailRows.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{formatStamp(r.created_at)}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{r.severity}</span>
                    </div>
                    <p className="text-sm font-medium">{r.reason}</p>
                    {r.matched_text && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 font-mono text-xs text-destructive break-all">
                        {r.matched_text}
                      </div>
                    )}
                    {r.context_label && (
                      <p className="text-xs text-muted-foreground">{r.context_label}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <Card
                key={g.source}
                onClick={() => navigate(`/activity-log/${encodeURIComponent(g.source)}`)}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{g.source}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.count} {g.count === 1 ? 'entry' : 'entries'} · {formatStamp(g.latest)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

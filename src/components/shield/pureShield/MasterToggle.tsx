import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface MasterToggleProps {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  description?: string;
  loading?: boolean;
}

export function MasterToggle({ enabled, onToggle, description, loading }: MasterToggleProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-5 border transition-all duration-200',
        enabled
          ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_30px_-12px] shadow-emerald-500/30'
          : 'bg-card border-border/50',
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center transition-colors',
            enabled ? 'bg-emerald-500/15' : 'bg-muted',
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          ) : (
            <span
              className={cn(
                'h-3 w-3 rounded-full transition-colors',
                enabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40',
              )}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">
            {loading ? (enabled ? 'Stopping…' : 'Starting…') : enabled ? 'PureShield is Active' : 'PureShield is Off'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description ?? (enabled ? 'Filtering visual content in real-time' : 'Tap to enable filtering')}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={loading}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-emerald-500"
          aria-label="Toggle PureShield"
        />
      </div>
    </div>
  );
}

export default MasterToggle;


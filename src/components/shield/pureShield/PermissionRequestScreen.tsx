import { Shield, Layers, MonitorSmartphone, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PermissionRequestScreenProps {
  overlayGranted: boolean;
  projectionGranted: boolean;
  onRequestOverlay: () => void;
  onRequestProjection: () => void;
  onLearnMore?: () => void;
}

export function PermissionRequestScreen({
  overlayGranted,
  projectionGranted,
  onRequestOverlay,
  onRequestProjection,
  onLearnMore,
}: PermissionRequestScreenProps) {
  const allGranted = overlayGranted && projectionGranted;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-center py-2">
        <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/20 border border-primary/20 mb-3">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-semibold text-lg">PureShield</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Visual content filtering — on-device, privacy-safe
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <PermissionRow
            icon={Layers}
            title="Overlay Permission"
            description="Draw blur over other apps"
            granted={overlayGranted}
            onRequest={onRequestOverlay}
            divider
          />
          <PermissionRow
            icon={MonitorSmartphone}
            title="Screen Capture"
            description="Read what's on screen for face detection"
            granted={projectionGranted}
            onRequest={onRequestProjection}
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button
          className="w-full h-12"
          disabled={allGranted}
          onClick={() => {
            if (!overlayGranted) onRequestOverlay();
            else if (!projectionGranted) onRequestProjection();
          }}
        >
          {allGranted ? 'All Permissions Granted' : 'Grant Permissions'}
          {!allGranted && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
        {onLearnMore && (
          <Button variant="ghost" className="w-full" onClick={onLearnMore}>
            Learn More
          </Button>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  icon: any;
  title: string;
  description: string;
  granted: boolean;
  onRequest: () => void;
  divider?: boolean;
}

function PermissionRow({ icon: Icon, title, description, granted, onRequest, divider }: RowProps) {
  return (
    <div
      className={
        'flex items-center gap-4 p-4 cursor-pointer active:bg-muted/50 transition-colors ' +
        (divider ? 'border-b border-border/50' : '')
      }
      onClick={!granted ? onRequest : undefined}
    >
      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">{title}</h3>
          {granted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default PermissionRequestScreen;

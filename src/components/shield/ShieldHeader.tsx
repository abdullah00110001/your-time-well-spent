import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell, Power, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ShieldHeaderProps {
  isEnabled?: boolean;
  onToggle?: () => void | Promise<void>;
}

export function ShieldHeader({ isEnabled = true, onToggle }: ShieldHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-9 w-9 rounded-xl shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">Focus Shield</h1>
            <p className="text-xs text-muted-foreground">Digital Wellbeing</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
            {isEnabled ? 'Active' : 'Paused'}
          </Badge>
          {onToggle && (
            <Button variant="outline" size="icon" className="rounded-full" onClick={onToggle} aria-label="Toggle shield">
              <Power className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-full relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-destructive rounded-full" />
          </Button>
        </div>
      </div>
    </div>
  );
}

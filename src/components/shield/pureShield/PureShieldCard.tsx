import { Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

interface PureShieldCardProps {
  isActive: boolean;
  onClick: () => void;
}

export function PureShieldCard({ isActive, onClick }: PureShieldCardProps) {
  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="group flex items-center gap-4 p-4 cursor-pointer border-border/50 hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
    >
      <div className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/20 border border-primary/20">
        <Shield className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">PureShield</h3>
          <Badge
            variant="secondary"
            className={
              isActive
                ? 'text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                : 'text-[10px] bg-muted text-muted-foreground'
            }
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          On-device visual content filtering
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Card>
  );
}

export default PureShieldCard;

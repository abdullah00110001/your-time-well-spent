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
      className="group flex items-center gap-4 p-4 cursor-pointer hover:border-primary/50 transition-colors"
    >
      <div className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-primary/10">
        <Shield className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">PureShield</h3>
          <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          On-device visual content filtering
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
    </Card>
  );
}

export default PureShieldCard;

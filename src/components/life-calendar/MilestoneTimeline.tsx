import { format, parseISO } from 'date-fns';
import { type LifeMilestone } from '@/hooks/useLifeCalendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface MilestoneTimelineProps {
  milestones: LifeMilestone[];
  onDelete: (id: string) => void;
}

const typeIcons: Record<string, string> = {
  achievement: '🏆',
  graduation: '🎓',
  marriage: '💍',
  career: '💼',
  crisis: '⚡',
  turning_point: '🔄',
  business: '🚀',
  travel: '✈️',
  other: '📌',
};

export default function MilestoneTimeline({ milestones, onDelete }: MilestoneTimelineProps) {
  if (milestones.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No milestones yet. Add your first life event!</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {milestones.map((m) => (
          <div key={m.id} className="relative">
            {/* Dot */}
            <div
              className="absolute -left-4 top-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center text-[8px]"
              style={{ backgroundColor: m.color }}
            >
              {typeIcons[m.milestone_type] || m.icon}
            </div>

            <div className="bg-card rounded-xl border p-3 ml-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(m.milestone_date), 'MMM d, yyyy')}
                  </p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {m.milestone_type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onDelete(m.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

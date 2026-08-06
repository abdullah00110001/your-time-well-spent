import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, ArrowRight, AlertCircle } from 'lucide-react';

interface GoalAdjustment {
  goalId: string;
  goalTitle: string;
  currentTarget: number;
  suggestedTarget: number;
  failureRate: number;
  reason: string;
}

interface GoalAdjustmentCardProps {
  adjustments: GoalAdjustment[];
  onApprove?: (goalId: string, newTarget: number) => void;
}

export default function GoalAdjustmentCard({ adjustments, onApprove }: GoalAdjustmentCardProps) {
  if (adjustments.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Goal Adjustment Suggestions
        </CardTitle>
        <CardDescription>
          Based on your patterns, consider these realistic adjustments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {adjustments.map((adjustment) => (
          <div 
            key={adjustment.goalId} 
            className="p-3 rounded-lg bg-background border"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium truncate">{adjustment.goalTitle}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{adjustment.reason}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{adjustment.currentTarget}x/week</Badge>
                  <ArrowRight className="h-3 w-3" />
                  <Badge variant="default">{adjustment.suggestedTarget}x/week</Badge>
                </div>
              </div>
              <Badge variant="outline" className="text-red-500 border-red-300 shrink-0">
                {adjustment.failureRate}% miss rate
              </Badge>
            </div>
            {onApprove && (
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full mt-3"
                onClick={() => onApprove(adjustment.goalId, adjustment.suggestedTarget)}
              >
                Accept Adjustment
              </Button>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-center pt-2">
          Small, achievable goals build lasting habits
        </p>
      </CardContent>
    </Card>
  );
}

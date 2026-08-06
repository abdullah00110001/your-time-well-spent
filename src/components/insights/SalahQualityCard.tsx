import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SalahQualityProps {
  totalCompleted: number;
  onTimeCount: number;
  avgKhushu: number;
  consistencyScore: number;
  qualityScore: number;
}

export default function SalahQualityCard({
  totalCompleted,
  onTimeCount,
  avgKhushu,
  consistencyScore,
  qualityScore,
}: SalahQualityProps) {
  const getQualityColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getKhushuLabel = (level: number) => {
    if (level >= 4) return 'Excellent';
    if (level >= 3) return 'Good';
    if (level >= 2) return 'Fair';
    return 'Needs Work';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          🕌 Salah Quality
        </CardTitle>
        <CardDescription>Your prayer consistency and quality</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quality Score */}
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Overall Quality Score</p>
          <p className={cn("text-4xl font-bold", getQualityColor(qualityScore))}>{qualityScore}</p>
          <Progress value={qualityScore} className="mt-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-primary/5 text-center">
            <p className="text-2xl font-bold text-primary">{consistencyScore}%</p>
            <p className="text-xs text-muted-foreground">Consistency</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
            <p className="text-2xl font-bold text-emerald-600">{onTimeCount}</p>
            <p className="text-xs text-muted-foreground">On Time</p>
          </div>
        </div>

        {/* Khushu Level */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="text-sm font-medium">Average Khushu</p>
            <p className="text-xs text-muted-foreground">{getKhushuLabel(avgKhushu)}</p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  level <= Math.round(avgKhushu)
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Completed {totalCompleted} prayers • {onTimeCount} on time
        </p>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Activity, Smartphone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoodCorrelationProps {
  lowMoodHighDevice: boolean;
  highMoodHighProductivity: boolean;
  insights: string[];
}

export default function MoodProductivityCorrelation({ 
  lowMoodHighDevice, 
  highMoodHighProductivity, 
  insights 
}: MoodCorrelationProps) {
  const hasData = lowMoodHighDevice || highMoodHighProductivity || insights.length > 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Mood ↔ Productivity
        </CardTitle>
        <CardDescription className="text-xs">Correlations from your data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Not enough data yet to show correlations
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Keep logging for insights!
            </p>
          </div>
        ) : (
          <>
            {/* Correlation Badges */}
            <div className="flex flex-wrap gap-2">
              {lowMoodHighDevice && (
                <Badge variant="outline" className="border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  <TrendingDown className="h-3 w-3" />
                  <span className="text-xs">Low Mood + High Device</span>
                </Badge>
              )}
              {highMoodHighProductivity && (
                <Badge variant="outline" className="border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs">High Mood = Productive</span>
                </Badge>
              )}
            </div>

            {/* Insights List */}
            {insights.length > 0 && (
              <div className="space-y-2">
                {insights.map((insight, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-start gap-2 p-2.5 rounded-lg text-xs transition-colors",
                      insight.includes('Low') || insight.includes('low') 
                        ? "bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900"
                        : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900"
                    )}
                  >
                    {insight.includes('Low') || insight.includes('low') ? (
                      <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{insight}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

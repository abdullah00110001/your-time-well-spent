import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, AlertCircle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MirrorModeProps {
  dueDate: string | null;
  lastGenerated: string | null;
  summary: string | null;
  traits: string[];
  improvements: string[];
  strengths: string[];
}

export default function MirrorMode({ 
  dueDate, 
  lastGenerated, 
  summary, 
  traits, 
  improvements, 
  strengths 
}: MirrorModeProps) {
  // If no summary, show countdown
  if (!summary && dueDate) {
    const daysUntil = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="py-6 text-center">
          <Eye className="h-8 w-8 text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">Mirror Mode</p>
          <p className="text-2xl font-bold text-primary">{daysUntil} days</p>
          <p className="text-xs text-muted-foreground mt-1">
            until your 30-day self-truth summary
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Mirror Mode
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            30-Day Reflection
          </Badge>
        </div>
        <CardDescription>
          This is the person you are becoming
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="p-4 rounded-lg bg-background/50 border">
          <p className="text-sm leading-relaxed italic">"{summary}"</p>
        </div>

        {/* Traits */}
        {traits.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {traits.map((trait, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {trait}
              </Badge>
            ))}
          </div>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <Sparkles className="h-4 w-4" />
              Strengths
            </div>
            <ul className="space-y-1">
              {strengths.map((strength, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <TrendingUp className="h-3 w-3 mt-1 text-emerald-500 shrink-0" />
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {improvements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Growth Areas
            </div>
            <ul className="space-y-1">
              {improvements.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastGenerated && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t">
            Generated on {new Date(lastGenerated).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause,
  Coffee
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShieldFocusTimerProps {
  isSessionActive: boolean;
  onStartBreak: (minutes: number) => void;
  disabled?: boolean;
}

export function ShieldFocusTimer({ 
  isSessionActive, 
  onStartBreak,
  disabled 
}: ShieldFocusTimerProps) {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  const breakDurations = [
    { value: 5, label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hour' },
  ];

  const handleStartBreak = () => {
    if (selectedDuration) {
      onStartBreak(selectedDuration);
      setSelectedDuration(null);
    }
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all',
      isSessionActive && 'ring-2 ring-emerald-500/30'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Take a Break</h3>
          </div>
          {isSessionActive && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
              <Pause className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Temporarily pause blocking for a quick break
        </p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {breakDurations.map((duration) => (
            <Button
              key={duration.value}
              variant={selectedDuration === duration.value ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-10',
                selectedDuration === duration.value && 'bg-primary text-primary-foreground'
              )}
              onClick={() => setSelectedDuration(duration.value)}
              disabled={disabled}
            >
              {duration.label}
            </Button>
          ))}
        </div>

        <Button 
          className="w-full" 
          disabled={!selectedDuration || disabled}
          onClick={handleStartBreak}
        >
          <Play className="h-4 w-4 mr-2" />
          Start Break
        </Button>
      </CardContent>
    </Card>
  );
}

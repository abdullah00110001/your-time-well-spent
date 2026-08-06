import { motion } from 'framer-motion';
import { Battery, Clock, Calendar } from 'lucide-react';

interface HayatBatteryProps {
  percentUsed: number;
  weeksLived: number;
  weeksRemaining: number;
  totalWeeks: number;
  currentAge: number;
}

export default function HayatBattery({ percentUsed, weeksLived, weeksRemaining, totalWeeks, currentAge }: HayatBatteryProps) {
  const percentRemaining = 100 - percentUsed;
  
  // Battery color based on remaining
  const batteryColor = percentRemaining > 60
    ? 'hsl(var(--success))'
    : percentRemaining > 30
      ? 'hsl(var(--warning))'
      : 'hsl(var(--destructive))';

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Battery Visual */}
      <div className="relative">
        {/* Battery cap */}
        <div className="w-8 h-3 bg-muted-foreground/30 rounded-t-sm mx-auto" />
        
        {/* Battery body */}
        <div className="w-32 h-56 border-4 border-muted-foreground/30 rounded-2xl overflow-hidden relative">
          {/* Fill level */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${percentRemaining}%` }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute bottom-0 left-0 right-0 rounded-b-xl"
            style={{ backgroundColor: batteryColor }}
          />
          
          {/* Percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-foreground drop-shadow-lg">
              {Math.round(percentRemaining)}%
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
        <div className="text-center p-3 bg-card rounded-xl border">
          <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold text-foreground">{Math.floor(currentAge)}</p>
          <p className="text-[10px] text-muted-foreground">Years Old</p>
        </div>
        <div className="text-center p-3 bg-card rounded-xl border">
          <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold text-foreground">{weeksLived.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Weeks Lived</p>
        </div>
        <div className="text-center p-3 bg-card rounded-xl border">
          <Battery className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold text-foreground">{weeksRemaining.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Weeks Left</p>
        </div>
      </div>

      {/* Life bar */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Born</span>
          <span>Now</span>
          <span>End</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentUsed}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: batteryColor }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          {totalWeeks.toLocaleString()} total weeks
        </p>
      </div>
    </div>
  );
}

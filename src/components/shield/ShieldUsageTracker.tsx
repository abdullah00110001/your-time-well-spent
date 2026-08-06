import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Clock, 
  Smartphone, 
  TrendingUp, 
  TrendingDown,
  Unlock,
  Calendar,
  Target,
  AlertCircle,
  Moon,
  Coffee
} from 'lucide-react';

interface AppUsage {
  name: string;
  icon: string;
  minutes: number;
  limit: number;
  category: string;
}

interface ShieldUsageTrackerProps {
  totalScreenTime: number;
  dailyLimit: number;
  onLimitChange: (limit: number) => void;
}

export function ShieldUsageTracker({ totalScreenTime, dailyLimit, onLimitChange }: ShieldUsageTrackerProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [bedtimeEnabled, setBedtimeEnabled] = useState(false);
  const [focusTimerEnabled, setFocusTimerEnabled] = useState(false);

  // Mock data - in real app would come from actual tracking
  const appUsageData: AppUsage[] = [
    { name: 'Instagram', icon: '📷', minutes: 45, limit: 30, category: 'Social' },
    { name: 'YouTube', icon: '▶️', minutes: 62, limit: 60, category: 'Video' },
    { name: 'WhatsApp', icon: '💬', minutes: 28, limit: 120, category: 'Messaging' },
    { name: 'TikTok', icon: '🎵', minutes: 38, limit: 15, category: 'Social' },
    { name: 'Twitter/X', icon: '🐦', minutes: 22, limit: 30, category: 'Social' },
    { name: 'Reddit', icon: '🤖', minutes: 18, limit: 20, category: 'Social' },
  ];

  const unlockCount = 47;
  const avgUnlockTime = '3m 24s';
  const percentUsed = Math.min((totalScreenTime / dailyLimit) * 100, 100);

  const weeklyData = [
    { day: 'Mon', minutes: 180 },
    { day: 'Tue', minutes: 210 },
    { day: 'Wed', minutes: 165 },
    { day: 'Thu', minutes: 240 },
    { day: 'Fri', minutes: 195 },
    { day: 'Sat', minutes: 280 },
    { day: 'Sun', minutes: totalScreenTime },
  ];

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-4">
      {/* Total Screen Time Card */}
      <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-1">Today's Screen Time</p>
            <p className="text-4xl font-bold">{formatTime(totalScreenTime)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {percentUsed < 100 
                ? `${formatTime(dailyLimit - totalScreenTime)} remaining`
                : '⚠️ Limit exceeded!'
              }
            </p>
          </div>
          <Progress 
            value={percentUsed} 
            className={`h-3 ${percentUsed >= 100 ? 'bg-destructive/20' : ''}`}
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0h</span>
            <span>Limit: {formatTime(dailyLimit)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily Limit Setter */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Daily Screen Time Limit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Slider
              value={[dailyLimit]}
              onValueChange={([value]) => onLimitChange(value)}
              max={480}
              min={30}
              step={15}
              className="flex-1"
            />
            <Badge variant="outline" className="min-w-[60px] justify-center">
              {formatTime(dailyLimit)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Unlock className="h-6 w-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">{unlockCount}</p>
            <p className="text-xs text-muted-foreground">Screen Unlocks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{avgUnlockTime}</p>
            <p className="text-xs text-muted-foreground">Avg Session</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Usage Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-32 gap-1">
            {weeklyData.map((day, i) => {
              const maxMinutes = Math.max(...weeklyData.map(d => d.minutes));
              const height = (day.minutes / maxMinutes) * 100;
              const isToday = i === weeklyData.length - 1;
              const isOverLimit = day.minutes > dailyLimit;

              return (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className={`w-full rounded-t-lg transition-all ${
                      isOverLimit 
                        ? 'bg-destructive' 
                        : isToday 
                          ? 'bg-primary' 
                          : 'bg-primary/40'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <p className={`text-xs ${isToday ? 'font-bold' : 'text-muted-foreground'}`}>
                    {day.day}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-emerald-500" />
              12% less than last week
            </span>
          </div>
        </CardContent>
      </Card>

      {/* App Usage Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            App Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appUsageData.map((app) => {
            const isOverLimit = app.minutes > app.limit;
            const usagePercent = Math.min((app.minutes / app.limit) * 100, 100);

            return (
              <div key={app.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{app.icon}</span>
                    <span className="text-sm font-medium">{app.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverLimit && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`text-sm ${isOverLimit ? 'text-destructive font-bold' : ''}`}>
                      {formatTime(app.minutes)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {formatTime(app.limit)}
                    </span>
                  </div>
                </div>
                <Progress 
                  value={usagePercent} 
                  className={`h-1.5 ${isOverLimit ? 'bg-destructive/20' : ''}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Focus Tools */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Focus Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="font-medium text-sm">Bedtime Mode</p>
                <p className="text-xs text-muted-foreground">10:00 PM - 6:00 AM</p>
              </div>
            </div>
            <Switch 
              checked={bedtimeEnabled}
              onCheckedChange={setBedtimeEnabled}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              <Coffee className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-sm">Focus Timer</p>
                <p className="text-xs text-muted-foreground">Pomodoro-style blocks</p>
              </div>
            </div>
            <Switch 
              checked={focusTimerEnabled}
              onCheckedChange={setFocusTimerEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timeline Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { time: '09:15 AM', app: 'Instagram', icon: '📷', duration: '12m' },
            { time: '10:30 AM', app: 'YouTube', icon: '▶️', duration: '28m' },
            { time: '12:45 PM', app: 'WhatsApp', icon: '💬', duration: '8m' },
            { time: '02:00 PM', app: 'TikTok', icon: '🎵', duration: '15m' },
          ].map((activity, i) => (
            <div 
              key={i}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">{activity.time}</span>
                <span className="text-lg">{activity.icon}</span>
                <span className="text-sm">{activity.app}</span>
              </div>
              <Badge variant="secondary" className="text-xs">{activity.duration}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

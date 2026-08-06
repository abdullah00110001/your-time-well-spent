import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Flame,
  Sunrise,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface RiseStreak {
  current_streak: number;
  longest_streak: number;
  total_on_time_wakes: number;
  total_alarms: number;
  is_recovery_mode: boolean;
}

interface RiseAnalyticsProps {
  streak: RiseStreak | null;
}

export function RiseAnalytics({ streak }: RiseAnalyticsProps) {
  const successRate = streak 
    ? (streak.total_alarms > 0 
        ? Math.round((streak.total_on_time_wakes / streak.total_alarms) * 100) 
        : 0)
    : 0;

  const weeklyData = [
    { day: 'Mon', woke: true, time: '4:32', late: 2 },
    { day: 'Tue', woke: true, time: '4:30', late: 0 },
    { day: 'Wed', woke: false, time: '-', late: 0 },
    { day: 'Thu', woke: true, time: '4:35', late: 5 },
    { day: 'Fri', woke: true, time: '4:28', late: 0 },
    { day: 'Sat', woke: true, time: '5:00', late: 30 },
    { day: 'Sun', woke: true, time: '4:30', late: 0 }
  ];

  return (
    <div className="space-y-4">
      {/* Streak Card */}
      <Card className="bg-gradient-to-br from-orange-600/30 to-amber-600/30 border-orange-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">{streak?.current_streak || 0}</span>
                <span className="text-lg text-muted-foreground">days</span>
              </div>
            </div>
            <div className="h-16 w-16 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Flame className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          
          <div className="mt-4 flex gap-4 text-center">
            <div className="flex-1 p-2 bg-background/50 rounded-lg">
              <p className="text-lg font-bold">{streak?.longest_streak || 0}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </div>
            <div className="flex-1 p-2 bg-background/50 rounded-lg">
              <p className="text-lg font-bold">{streak?.total_on_time_wakes || 0}</p>
              <p className="text-xs text-muted-foreground">On-Time Wakes</p>
            </div>
            <div className="flex-1 p-2 bg-background/50 rounded-lg">
              <p className="text-lg font-bold">{successRate}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sunrise className="h-4 w-4" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weeklyData.map((day) => (
              <div 
                key={day.day}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {day.woke ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <span className="font-medium">{day.day}</span>
                </div>
                <div className="flex items-center gap-2">
                  {day.woke && (
                    <>
                      <span className="text-sm text-muted-foreground">{day.time}</span>
                      {day.late > 0 && (
                        <span className="text-xs text-amber-500">+{day.late}m</span>
                      )}
                    </>
                  )}
                  {!day.woke && (
                    <span className="text-sm text-destructive">Missed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Wake Time Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Average Wake Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-4xl font-bold">4:35</p>
            <p className="text-sm text-muted-foreground">AM average this week</p>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Earliest</span>
              <span className="font-medium">4:28 AM</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Latest</span>
              <span className="font-medium">5:00 AM</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Most consistent</span>
              <span className="font-medium">4:30 AM</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            "You woke <span className="font-bold text-foreground">5 out of 7</span> days on time this week. 
            That's <span className="font-bold text-primary">+2</span> better than last week. Keep rising!"
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
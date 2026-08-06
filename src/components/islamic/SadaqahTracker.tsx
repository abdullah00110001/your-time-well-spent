import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Heart, Users, Home, BookOpen, Plus, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface ServiceLog {
  date: string;
  hours: number;
  type: string;
  moodBefore: number;
  moodAfter: number;
}

interface SadaqahTrackerProps {
  totalHours: number;
  serviceLogs: ServiceLog[];
  onLogService: (data: { type: string; hours: number; moodBefore: number; moodAfter: number }) => void;
}

export default function SadaqahTracker({ totalHours, serviceLogs, onLogService }: SadaqahTrackerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [serviceType, setServiceType] = useState('');
  const [hours, setHours] = useState('');
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const { mode, labels } = useAppMode();

  const primaryColor = mode === 'islamic' ? 'rose' : 'blue';

  const serviceTypes = [
    { value: 'family', label: 'Family Service', icon: Home },
    { value: 'community', label: 'Community Work', icon: Users },
    { value: 'teaching', label: 'Teaching/Mentoring', icon: BookOpen },
    { value: 'charity', label: mode === 'islamic' ? 'Charity Work' : 'Volunteering', icon: Heart },
  ];

  const moodImpact = serviceLogs.length > 0
    ? serviceLogs.reduce((acc, log) => acc + (log.moodAfter - log.moodBefore), 0) / serviceLogs.length
    : 0;

  const handleSubmit = () => {
    if (serviceType && hours) {
      onLogService({
        type: serviceType,
        hours: parseFloat(hours),
        moodBefore,
        moodAfter,
      });
      setIsOpen(false);
      setServiceType('');
      setHours('');
      setMoodBefore(5);
      setMoodAfter(5);
    }
  };

  const chartData = serviceLogs.slice(-7).map((log, idx) => ({
    day: `Day ${idx + 1}`,
    moodBefore: log.moodBefore,
    moodAfter: log.moodAfter,
    hours: log.hours,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className={cn("h-4 w-4", mode === 'islamic' ? "text-rose-500" : "text-blue-500")} />
            {labels.serviceTracker.title}
          </CardTitle>
          <Badge variant="outline" className={cn(
            "text-xs",
            mode === 'islamic' 
              ? "border-rose-300 text-rose-600" 
              : "border-blue-300 text-blue-600"
          )}>
            {totalHours.toFixed(1)} hours
          </Badge>
        </div>
        <CardDescription>{labels.serviceTracker.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            "p-3 rounded-lg text-center",
            mode === 'islamic' 
              ? "bg-rose-50 dark:bg-rose-950/30" 
              : "bg-blue-50 dark:bg-blue-950/30"
          )}>
            <p className={cn(
              "text-2xl font-bold",
              mode === 'islamic' 
                ? "text-rose-700 dark:text-rose-300" 
                : "text-blue-700 dark:text-blue-300"
            )}>{totalHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{labels.serviceTracker.hoursLabel}</p>
          </div>
          <div className={cn(
            "p-3 rounded-lg text-center",
            moodImpact > 0 
              ? mode === 'islamic'
                ? "bg-emerald-50 dark:bg-emerald-950/30"
                : "bg-green-50 dark:bg-green-950/30"
              : "bg-muted"
          )}>
            <p className={cn(
              "text-2xl font-bold",
              moodImpact > 0 
                ? mode === 'islamic'
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-green-700 dark:text-green-300"
                : "text-muted-foreground"
            )}>
              {moodImpact > 0 ? '+' : ''}{moodImpact.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">{labels.serviceTracker.moodBoost}</p>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="h-32">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Mood Before & After Service
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    fontSize: 12,
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="moodBefore" 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeWidth={2}
                  name="Before"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="moodAfter" 
                  stroke={mode === 'islamic' ? "#10b981" : "#3b82f6"}
                  strokeWidth={2}
                  name="After"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {moodImpact > 0 && (
          <div className={cn(
            "p-3 rounded-lg border",
            mode === 'islamic'
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
          )}>
            <div className={cn(
              "flex items-center gap-2",
              mode === 'islamic' ? "text-emerald-700 dark:text-emerald-300" : "text-blue-700 dark:text-blue-300"
            )}>
              <TrendingUp className="h-4 w-4" />
              <p className="text-sm font-medium">
                Serving others improves your mood by {(moodImpact / 10 * 100).toFixed(0)}%
              </p>
            </div>
            <p className={cn(
              "text-xs mt-1 italic",
              mode === 'islamic' ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
            )}>
              {mode === 'islamic' 
                ? '"The best of people are those who are most beneficial to people." — Hadith'
                : '"We make a living by what we get, but we make a life by what we give." — Churchill'}
            </p>
          </div>
        )}

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Log Service Time
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log {mode === 'islamic' ? 'Service (Khidmat)' : 'Contribution'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type of Service</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map(type => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Hours Spent</Label>
                <Input 
                  type="number" 
                  step="0.5" 
                  min="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g., 1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mood Before (1-10)</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={moodBefore}
                    onChange={(e) => setMoodBefore(parseInt(e.target.value) || 5)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mood After (1-10)</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={moodAfter}
                    onChange={(e) => setMoodAfter(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full" disabled={!serviceType || !hours}>
                Save Service Log
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-4 gap-2">
          {serviceTypes.map(type => {
            const Icon = type.icon;
            const typeHours = serviceLogs
              .filter(log => log.type === type.value)
              .reduce((acc, log) => acc + log.hours, 0);
            return (
              <div key={type.value} className="text-center p-2 rounded-lg bg-muted/30">
                <Icon className={cn(
                  "h-4 w-4 mx-auto mb-1",
                  mode === 'islamic' ? "text-rose-500" : "text-blue-500"
                )} />
                <p className="text-xs font-medium">{typeHours.toFixed(1)}h</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

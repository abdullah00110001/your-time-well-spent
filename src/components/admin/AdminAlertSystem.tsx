import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, Bell, CheckCircle2, X,
  BookOpen, Smartphone, Moon
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface Alert {
  id: string;
  userId: string;
  userName: string;
  type: 'missed_salah' | 'high_device' | 'no_quran' | 'low_energy' | 'burnout_risk';
  message: string;
  severity: 'low' | 'medium' | 'high';
  date: string;
}

interface AdminAlertSystemProps {
  onUserClick?: (userId: string, date: string) => void;
}

export default function AdminAlertSystem({ onUserClick }: AdminAlertSystemProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyzeAlerts();
  }, []);

  const analyzeAlerts = async () => {
    setLoading(true);
    const generatedAlerts: Alert[] = [];
    const last7Days = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    try {
      // Fetch all users and their recent entries
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const { data: entries } = await supabase
        .from('daily_entries')
        .select('*')
        .gte('date', last7Days);

      if (!profiles || !entries) {
        setLoading(false);
        return;
      }

      // Group entries by user
      const entriesByUser = new Map<string, any[]>();
      entries.forEach(entry => {
        const existing = entriesByUser.get(entry.user_id) || [];
        existing.push(entry);
        entriesByUser.set(entry.user_id, existing);
      });

      profiles.forEach(profile => {
        const userEntries = entriesByUser.get(profile.user_id) || [];
        const userName = profile.full_name || 'Unknown User';

        // Check for missed salah pattern (3+ days)
        let missedSalahDays = 0;
        userEntries.forEach(entry => {
          const salahCount = [
            entry.fajr_completed, entry.dhuhr_completed, entry.asr_completed,
            entry.maghrib_completed, entry.isha_completed
          ].filter(Boolean).length;
          if (salahCount < 3) missedSalahDays++;
        });
        
        if (missedSalahDays >= 3) {
          generatedAlerts.push({
            id: `salah-${profile.user_id}`,
            userId: profile.user_id,
            userName,
            type: 'missed_salah',
            message: `Missed 3+ prayers on ${missedSalahDays} days this week`,
            severity: 'high',
            date: format(new Date(), 'yyyy-MM-dd'),
          });
        }

        // Check for high device usage
        const highDeviceDays = userEntries.filter(e => 
          (e.device_time_minutes || 0) > (e.focused_study_minutes || 0) + (e.revision_minutes || 0)
        ).length;
        
        if (highDeviceDays >= 4) {
          generatedAlerts.push({
            id: `device-${profile.user_id}`,
            userId: profile.user_id,
            userName,
            type: 'high_device',
            message: `Device time > Study time for ${highDeviceDays} days`,
            severity: 'medium',
            date: format(new Date(), 'yyyy-MM-dd'),
          });
        }

        // Check for no Quran
        const noQuranDays = userEntries.filter(e => !e.quran_read).length;
        if (noQuranDays >= 5 && userEntries.length >= 5) {
          generatedAlerts.push({
            id: `quran-${profile.user_id}`,
            userId: profile.user_id,
            userName,
            type: 'no_quran',
            message: `No Qur'an engagement for ${noQuranDays} days`,
            severity: 'medium',
            date: format(new Date(), 'yyyy-MM-dd'),
          });
        }

        // Check for burnout risk
        const burnoutDays = userEntries.filter(e => 
          (e.energy_level || 3) <= 2 && (e.sleep_quality || 3) <= 2
        ).length;
        
        if (burnoutDays >= 3) {
          generatedAlerts.push({
            id: `burnout-${profile.user_id}`,
            userId: profile.user_id,
            userName,
            type: 'burnout_risk',
            message: `Signs of burnout: ${burnoutDays} days with low energy & sleep`,
            severity: 'high',
            date: format(new Date(), 'yyyy-MM-dd'),
          });
        }
      });

      // Sort by severity
      generatedAlerts.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      setAlerts(generatedAlerts);
    } catch (error) {
      console.error('Error analyzing alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'missed_salah': return <Moon className="h-4 w-4" />;
      case 'high_device': return <Smartphone className="h-4 w-4" />;
      case 'no_quran': return <BookOpen className="h-4 w-4" />;
      case 'burnout_risk': return <AlertTriangle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    toast.success('Alert dismissed');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            User Alerts
          </span>
          {alerts.length > 0 && (
            <Badge variant="destructive">{alerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
            <p>No critical alerts at this time</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {alerts.map(alert => (
              <div 
                key={alert.id}
                className="flex items-start justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <button 
                  className="flex items-start gap-3 text-left flex-1"
                  onClick={() => onUserClick?.(alert.userId, alert.date)}
                >
                  <div className={`mt-0.5 ${
                    alert.severity === 'high' ? 'text-destructive' : 
                    alert.severity === 'medium' ? 'text-amber-500' : 'text-muted-foreground'
                  }`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{alert.userName}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  <Badge variant={getSeverityColor(alert.severity)} className="ml-2">
                    {alert.severity}
                  </Badge>
                </button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(alert.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

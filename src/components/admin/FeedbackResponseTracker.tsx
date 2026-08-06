import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Eye,
  Loader2,
  MessageSquare
} from 'lucide-react';
import { format, subDays, differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';

interface FeedbackStats {
  total: number;
  read: number;
  unread: number;
  avgResponseTime: number;
  byType: { type: string; count: number; readRate: number }[];
  recentActivity: { date: string; sent: number; read: number }[];
}

export default function FeedbackResponseTracker() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

      // Fetch all feedback from last 30 days
      const { data: feedback } = await supabase
        .from('admin_feedback')
        .select('*')
        .gte('created_at', format(subDays(new Date(), 30), 'yyyy-MM-dd'));

      if (!feedback) {
        setStats({
          total: 0,
          read: 0,
          unread: 0,
          avgResponseTime: 0,
          byType: [],
          recentActivity: []
        });
        setLoading(false);
        return;
      }

      const total = feedback.length;
      const read = feedback.filter(f => f.read_at).length;
      const unread = total - read;

      // Calculate average response time (hours)
      const responseTimes = feedback
        .filter(f => f.read_at)
        .map(f => differenceInHours(new Date(f.read_at!), new Date(f.created_at)));
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // Group by type
      const typeMap = new Map<string, { count: number; read: number }>();
      feedback.forEach(f => {
        const current = typeMap.get(f.feedback_type) || { count: 0, read: 0 };
        current.count++;
        if (f.read_at) current.read++;
        typeMap.set(f.feedback_type, current);
      });

      const byType = Array.from(typeMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        readRate: Math.round((data.read / data.count) * 100)
      }));

      // Daily activity for last 7 days
      const recentActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const dayFeedback = feedback.filter(f => f.created_at.startsWith(date));
        recentActivity.push({
          date: format(subDays(new Date(), i), 'EEE'),
          sent: dayFeedback.length,
          read: dayFeedback.filter(f => f.read_at).length
        });
      }

      setStats({
        total,
        read,
        unread,
        avgResponseTime,
        byType,
        recentActivity
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching feedback stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const readRate = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-subtitle flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Feedback Analytics
        </CardTitle>
        <CardDescription className="text-caption">
          Track engagement with your feedback messages
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <MessageSquare className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-title font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Sent</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Eye className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-title font-bold">{stats.read}</p>
            <p className="text-xs text-muted-foreground">Read</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Clock className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-title font-bold">{stats.unread}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-title font-bold">{stats.avgResponseTime}h</p>
            <p className="text-xs text-muted-foreground">Avg Time</p>
          </div>
        </div>

        {/* Read Rate Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-muted-foreground">Overall Read Rate</span>
            <span className="text-body font-semibold">{readRate}%</span>
          </div>
          <Progress value={readRate} className="h-2" />
        </div>

        {/* By Type Breakdown */}
        {stats.byType.length > 0 && (
          <div>
            <h4 className="text-caption font-medium text-muted-foreground mb-3">
              Performance by Type
            </h4>
            <div className="space-y-2">
              {stats.byType.map(item => (
                <div key={item.type} className="flex items-center gap-3">
                  <Badge variant="outline" className="capitalize w-28 justify-center">
                    {item.type}
                  </Badge>
                  <div className="flex-1">
                    <Progress value={item.readRate} className="h-1.5" />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {item.count} sent • {item.readRate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Activity Mini Chart */}
        {stats.recentActivity.length > 0 && (
          <div>
            <h4 className="text-caption font-medium text-muted-foreground mb-3">
              Last 7 Days Activity
            </h4>
            <div className="flex items-end justify-between gap-1 h-16">
              {stats.recentActivity.map((day, i) => {
                const maxVal = Math.max(...stats.recentActivity.map(d => d.sent)) || 1;
                const height = (day.sent / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={cn(
                        "w-full rounded-t transition-all",
                        day.sent > 0 ? "bg-primary" : "bg-muted"
                      )}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${day.sent} sent, ${day.read} read`}
                    />
                    <span className="text-xs text-muted-foreground">{day.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats.total === 0 && (
          <div className="text-center py-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-caption text-muted-foreground">
              No feedback sent yet. Start engaging with your users!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

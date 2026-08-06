import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Star,
  Clock,
  Moon,
  Sun,
  Loader2,
  Send
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface UserSegment {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  count: number;
  users: { user_id: string; full_name: string | null }[];
}

export default function UserSegments() {
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const threeAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd');

      // Fetch all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, app_mode');

      // Fetch recent entries
      const { data: weekEntries } = await supabase
        .from('daily_entries')
        .select('user_id, date, discipline_level')
        .gte('date', weekAgo);

      // Fetch today's entries
      const { data: todayEntries } = await supabase
        .from('daily_entries')
        .select('user_id')
        .eq('date', today);

      // Fetch recent entries (last 3 days)
      const { data: recentEntries } = await supabase
        .from('daily_entries')
        .select('user_id')
        .gte('date', threeAgo);

      const activeToday = new Set(todayEntries?.map(e => e.user_id));
      const activeRecent = new Set(recentEntries?.map(e => e.user_id));

      // Calculate user activity and discipline
      const userStats = new Map<string, { entries: number; avgDiscipline: number }>();
      weekEntries?.forEach(entry => {
        const current = userStats.get(entry.user_id) || { entries: 0, avgDiscipline: 0 };
        current.entries++;
        if (entry.discipline_level) {
          current.avgDiscipline = (current.avgDiscipline * (current.entries - 1) + entry.discipline_level) / current.entries;
        }
        userStats.set(entry.user_id, current);
      });

      // Build segments
      const segmentData: UserSegment[] = [
        {
          id: 'power-users',
          name: 'Power Users',
          description: 'Logged 5+ days this week with high discipline',
          icon: Star,
          color: 'text-yellow-500',
          count: 0,
          users: []
        },
        {
          id: 'consistent',
          name: 'Consistent Users',
          description: 'Active 3-4 days this week',
          icon: TrendingUp,
          color: 'text-green-500',
          count: 0,
          users: []
        },
        {
          id: 'at-risk',
          name: 'At-Risk',
          description: 'Inactive for 3+ days',
          icon: AlertTriangle,
          color: 'text-destructive',
          count: 0,
          users: []
        },
        {
          id: 'new-users',
          name: 'New Users',
          description: 'Less than 3 entries total',
          icon: Clock,
          color: 'text-blue-500',
          count: 0,
          users: []
        },
        {
          id: 'declining',
          name: 'Declining',
          description: 'Lower activity than last week',
          icon: TrendingDown,
          color: 'text-orange-500',
          count: 0,
          users: []
        },
        {
          id: 'islamic-mode',
          name: 'Islamic Mode',
          description: 'Users with Islamic mode enabled',
          icon: Moon,
          color: 'text-primary',
          count: 0,
          users: []
        },
        {
          id: 'regular-mode',
          name: 'Regular Mode',
          description: 'Users with regular mode',
          icon: Sun,
          color: 'text-secondary',
          count: 0,
          users: []
        }
      ];

      // Categorize users
      profiles?.forEach(profile => {
        const stats = userStats.get(profile.user_id);
        const isActiveRecent = activeRecent.has(profile.user_id);

        // Power users
        if (stats && stats.entries >= 5 && stats.avgDiscipline >= 7) {
          segmentData[0].count++;
          segmentData[0].users.push({ user_id: profile.user_id, full_name: profile.full_name });
        }
        // Consistent users
        else if (stats && stats.entries >= 3) {
          segmentData[1].count++;
          segmentData[1].users.push({ user_id: profile.user_id, full_name: profile.full_name });
        }
        // At-risk
        else if (!isActiveRecent) {
          segmentData[2].count++;
          segmentData[2].users.push({ user_id: profile.user_id, full_name: profile.full_name });
        }
        // New users
        else if (stats && stats.entries < 3) {
          segmentData[3].count++;
          segmentData[3].users.push({ user_id: profile.user_id, full_name: profile.full_name });
        }

        // Mode-based segments
        if (profile.app_mode === 'islamic') {
          segmentData[5].count++;
          segmentData[5].users.push({ user_id: profile.user_id, full_name: profile.full_name });
        } else {
          segmentData[6].count++;
          segmentData[6].users.push({ user_id: profile.user_id, full_name: profile.full_name });
        }
      });

      setSegments(segmentData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching segments:', error);
      toast.error('Failed to load user segments');
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

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-subtitle flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          User Segments
        </CardTitle>
        <CardDescription className="text-caption">
          Automatically grouped users based on activity patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => {
            const Icon = segment.icon;
            return (
              <div
                key={segment.id}
                className="p-4 rounded-xl border bg-card hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center",
                      segment.id === 'at-risk' ? 'bg-destructive/10' : 'bg-muted'
                    )}>
                      <Icon className={cn("h-4 w-4", segment.color)} />
                    </div>
                    <div>
                      <h3 className="font-medium text-body">{segment.name}</h3>
                      <p className="text-xs text-muted-foreground">{segment.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-sm font-semibold">
                    {segment.count} users
                  </Badge>
                  
                  {segment.count > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 gap-1"
                      asChild
                    >
                      <Link to={`/admin/notifications?segment=${segment.id}`}>
                        <Send className="h-3 w-3" />
                        Message
                      </Link>
                    </Button>
                  )}
                </div>

                {/* Preview of users */}
                {segment.users.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex flex-wrap gap-1">
                      {segment.users.slice(0, 3).map(user => (
                        <Badge 
                          key={user.user_id} 
                          variant="outline" 
                          className="text-xs"
                        >
                          {user.full_name || `User ${user.user_id.slice(0, 6)}`}
                        </Badge>
                      ))}
                      {segment.users.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{segment.users.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

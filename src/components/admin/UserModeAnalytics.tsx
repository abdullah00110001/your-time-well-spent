import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Moon, Sun, Users, PieChart, MessageSquare } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface UserModeData {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  app_mode: string;
  created_at: string;
}

interface UserModeAnalyticsProps {
  onSendFeedback: (userId: string, userName: string, mode: string) => void;
}

export default function UserModeAnalytics({ onSendFeedback }: UserModeAnalyticsProps) {
  const [users, setUsers] = useState<UserModeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserModes();
  }, []);

  const fetchUserModes = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, app_mode, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const islamicUsers = users.filter(u => u.app_mode === 'islamic' || !u.app_mode);
  const regularUsers = users.filter(u => u.app_mode === 'regular');

  const pieData = [
    { name: 'Islamic Mode', value: islamicUsers.length, color: '#10b981' },
    { name: 'Regular Mode', value: regularUsers.length, color: '#3b82f6' },
  ];

  const COLORS = ['#10b981', '#3b82f6'];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading user modes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Mode Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Mode Distribution
          </CardTitle>
          <CardDescription>
            How users have configured their experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center">
              <Moon className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{islamicUsers.length}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Islamic Mode</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
              <Sun className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{regularUsers.length}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Regular Mode</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users by Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users by Mode
          </CardTitle>
          <CardDescription>
            Send mode-adaptive feedback to users
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[400px] overflow-y-auto">
          <div className="space-y-2">
            {users.map((user) => {
              const isIslamic = user.app_mode === 'islamic' || !user.app_mode;
              return (
                <div
                  key={user.user_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isIslamic 
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' 
                      : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{(user.full_name || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {user.full_name || 'Unknown User'}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={isIslamic 
                      ? 'border-emerald-500 text-emerald-600' 
                      : 'border-blue-500 text-blue-600'
                    }
                  >
                    {isIslamic ? (
                      <><Moon className="h-3 w-3 mr-1" /> Islamic</>
                    ) : (
                      <><Sun className="h-3 w-3 mr-1" /> Regular</>
                    )}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onSendFeedback(user.user_id, user.full_name || 'User', user.app_mode || 'islamic')}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

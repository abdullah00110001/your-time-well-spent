import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  Loader2, 
  User,
  MessageSquare,
  ChevronRight,
  Clock,
  TrendingDown,
  Send,
  Users,
  Moon,
  Sun
} from 'lucide-react';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import BatchEncouragementModal from '@/components/admin/BatchEncouragementModal';

interface AtRiskUser {
  user_id: string;
  full_name: string | null;
  app_mode: string | null;
  days_inactive: number;
  last_entry_date: string | null;
  last_score: number | null;
  declining: boolean;
}

export default function AtRiskUsers() {
  const [users, setUsers] = useState<AtRiskUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    fetchAtRiskUsers();
  }, []);

  const fetchAtRiskUsers = async () => {
    try {
      const today = new Date();
      const threeAgo = format(subDays(today, 3), 'yyyy-MM-dd');

      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, app_mode');

      // Get recent entries (last 3 days)
      const { data: recentEntries } = await supabase
        .from('daily_entries')
        .select('user_id, date')
        .gte('date', threeAgo);

      const activeUserIds = new Set(recentEntries?.map(e => e.user_id));
      const atRiskList: AtRiskUser[] = [];

      for (const profile of profiles || []) {
        if (!activeUserIds.has(profile.user_id)) {
          // Get last entry for this user
          const { data: lastEntry } = await supabase
            .from('daily_entries')
            .select('date, weighted_daily_score')
            .eq('user_id', profile.user_id)
            .order('date', { ascending: false })
            .limit(1)
            .single();

          // Calculate days inactive properly
          let daysInactive: number;
          if (lastEntry?.date) {
            const lastDate = parseISO(lastEntry.date);
            daysInactive = differenceInDays(today, lastDate);
          } else {
            // User has never logged - calculate from account creation
            const { data: profileData } = await supabase
              .from('profiles')
              .select('created_at')
              .eq('user_id', profile.user_id)
              .single();
            
            if (profileData?.created_at) {
              daysInactive = differenceInDays(today, new Date(profileData.created_at));
            } else {
              daysInactive = 0; // New user
            }
          }

          if (daysInactive >= 3) {
            // Check for declining trend
            const twoWeeksAgo = format(subDays(today, 14), 'yyyy-MM-dd');
            const { data: recentScores } = await supabase
              .from('daily_entries')
              .select('weighted_daily_score')
              .eq('user_id', profile.user_id)
              .gte('date', twoWeeksAgo)
              .order('date', { ascending: true });

            let declining = false;
            if (recentScores && recentScores.length >= 5) {
              const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
              const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
              const avgFirst = firstHalf.reduce((s, e) => s + (e.weighted_daily_score || 0), 0) / firstHalf.length;
              const avgSecond = secondHalf.reduce((s, e) => s + (e.weighted_daily_score || 0), 0) / secondHalf.length;
              declining = avgSecond < avgFirst * 0.8;
            }

            atRiskList.push({
              user_id: profile.user_id,
              full_name: profile.full_name,
              app_mode: profile.app_mode,
              days_inactive: daysInactive,
              last_entry_date: lastEntry?.date || null,
              last_score: lastEntry?.weighted_daily_score || null,
              declining
            });
          }
        }
      }

      // Sort by days inactive (highest first)
      atRiskList.sort((a, b) => b.days_inactive - a.days_inactive);
      setUsers(atRiskList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching at-risk users:', error);
      setLoading(false);
    }
  };

  const getSeverity = (days: number) => {
    if (days >= 14) return { label: 'Critical', color: 'bg-destructive text-destructive-foreground' };
    if (days >= 7) return { label: 'High', color: 'bg-orange-500 text-white' };
    return { label: 'Medium', color: 'bg-yellow-500 text-white' };
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.user_id)));
    }
  };

  const getSelectedUsersList = () => {
    return users.filter(u => selectedUsers.has(u.user_id));
  };

  const formatLastActive = (date: string | null) => {
    if (!date) return 'Never';
    try {
      return format(parseISO(date), 'MMM d, yyyy');
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">At-Risk Users</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Users who haven't logged data for 3+ days
                </p>
              </div>
            </div>
          </div>
          
          {selectedUsers.size > 0 && (
            <Button onClick={() => setShowBatchModal(true)} className="w-full sm:w-auto">
              <Send className="h-4 w-4 mr-2" />
              Send to {selectedUsers.size} Selected
            </Button>
          )}
        </div>

        {/* Stats - Responsive Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-3xl font-bold text-destructive">{users.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Total At-Risk</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-3xl font-bold text-orange-500">
                {users.filter(u => u.days_inactive >= 7).length}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">7+ Days</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-3xl font-bold text-red-600">
                {users.filter(u => u.declining).length}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Declining</p>
            </CardContent>
          </Card>
        </div>

        {/* User List */}
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base truncate">At-Risk User List</CardTitle>
                <CardDescription className="text-xs hidden sm:block">
                  Sorted by days inactive (highest first)
                </CardDescription>
              </div>
              {users.length > 0 && (
                <Button variant="outline" size="sm" onClick={toggleSelectAll} className="shrink-0 text-xs h-8">
                  <Users className="h-3 w-3 mr-1" />
                  {selectedUsers.size === users.length ? 'Deselect' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            {users.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <User className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">All Users Active!</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Great news! No users have been inactive for 3+ days.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => {
                  const severity = getSeverity(user.days_inactive);
                  const isSelected = selectedUsers.has(user.user_id);
                  return (
                    <div 
                      key={user.user_id} 
                      className={`p-3 rounded-xl border bg-card transition-colors ${
                        isSelected ? 'border-primary/50 bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectUser(user.user_id)}
                          className="shrink-0 mt-1"
                        />
                        
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          severity.label === 'Critical' ? 'bg-red-500/10' : 
                          severity.label === 'High' ? 'bg-orange-500/10' : 'bg-yellow-500/10'
                        }`}>
                          <AlertTriangle className={`h-5 w-5 ${
                            severity.label === 'Critical' ? 'text-red-500' : 
                            severity.label === 'High' ? 'text-orange-500' : 'text-yellow-500'
                          }`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {user.full_name || `User ${user.user_id.slice(0, 6)}`}
                            </p>
                            <Badge className={`${severity.color} text-xs px-2 py-0.5 shrink-0`}>
                              {user.days_inactive} days
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Last: {formatLastActive(user.last_entry_date)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                              {user.app_mode === 'islamic' ? (
                                <Moon className="h-3 w-3" />
                              ) : (
                                <Sun className="h-3 w-3" />
                              )}
                              {user.app_mode || 'regular'}
                            </span>
                            {user.declining && (
                              <Badge variant="outline" className="text-red-500 border-red-500 text-[10px] px-1.5 py-0">
                                <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                                Declining
                              </Badge>
                            )}
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex gap-2 mt-2">
                            <Button variant="outline" size="sm" asChild className="h-7 text-xs flex-1 sm:flex-none">
                              <Link to={`/admin/feedback?user=${user.user_id}`}>
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Send
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                              <Link to={`/admin/users?id=${user.user_id}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Batch Encouragement Modal */}
      <BatchEncouragementModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        users={getSelectedUsersList()}
        onSuccess={() => {
          setSelectedUsers(new Set());
          fetchAtRiskUsers();
        }}
      />
    </AdminLayout>
  );
}

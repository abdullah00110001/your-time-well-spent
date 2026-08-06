import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trophy, Clock, Flame, Target, Medal, Crown, Award, Lock, Globe, Eye, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface LeaderboardUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_hours?: number;
  streak?: number;
  goals_completed?: number;
  habits_completed?: number;
}

export default function Leaderboard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timeLeaders, setTimeLeaders] = useState<LeaderboardUser[]>([]);
  const [streakLeaders, setStreakLeaders] = useState<LeaderboardUser[]>([]);
  const [goalsLeaders, setGoalsLeaders] = useState<LeaderboardUser[]>([]);
  const [habitsLeaders, setHabitsLeaders] = useState<LeaderboardUser[]>([]);

  useEffect(() => {
    fetchData();
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setIsAdmin(data === true);
  };

  const fetchData = async () => {
    setLoading(true);

    // Fetch visibility setting
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "leaderboard_visibility")
      .single();
    
    if (settings) {
      setIsPublic((settings.value as { public: boolean })?.public ?? true);
    }

    // Fetch all profiles
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
    
    if (!profiles) {
      setLoading(false);
      return;
    }

    // Fetch time entries for all users
    const { data: timeEntries } = await supabase.from("time_entries").select("user_id, hours");
    
    // Calculate total hours per user
    const hoursByUser = new Map<string, number>();
    timeEntries?.forEach(entry => {
      const current = hoursByUser.get(entry.user_id) || 0;
      hoursByUser.set(entry.user_id, current + Number(entry.hours));
    });

    const timeLeaderData = profiles
      .map(p => ({
        ...p,
        total_hours: hoursByUser.get(p.user_id) || 0,
      }))
      .filter(p => p.total_hours > 0)
      .sort((a, b) => b.total_hours - a.total_hours);

    setTimeLeaders(timeLeaderData);

    // Fetch habit entries for streak calculation
    const { data: habitEntries } = await supabase
      .from("habit_entries")
      .select("user_id, date, completed")
      .eq("completed", true)
      .order("date", { ascending: false });

    // Calculate streaks
    const streaksByUser = new Map<string, number>();
    const userDates = new Map<string, Set<string>>();
    
    habitEntries?.forEach(entry => {
      if (!userDates.has(entry.user_id)) {
        userDates.set(entry.user_id, new Set());
      }
      userDates.get(entry.user_id)?.add(entry.date);
    });

    userDates.forEach((dates, userId) => {
      const sortedDates = Array.from(dates).sort().reverse();
      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < sortedDates.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = expectedDate.toISOString().split("T")[0];
        
        if (sortedDates.includes(expectedStr)) {
          streak++;
        } else {
          break;
        }
      }
      streaksByUser.set(userId, streak);
    });

    const streakLeaderData = profiles
      .map(p => ({
        ...p,
        streak: streaksByUser.get(p.user_id) || 0,
      }))
      .filter(p => p.streak > 0)
      .sort((a, b) => (b.streak || 0) - (a.streak || 0));

    setStreakLeaders(streakLeaderData);

    // Fetch goals completion
    const { data: goals } = await supabase.from("goals").select("user_id");
    const goalsByUser = new Map<string, number>();
    goals?.forEach(g => {
      goalsByUser.set(g.user_id, (goalsByUser.get(g.user_id) || 0) + 1);
    });

    const goalsLeaderData = profiles
      .map(p => ({
        ...p,
        goals_completed: goalsByUser.get(p.user_id) || 0,
      }))
      .filter(p => p.goals_completed && p.goals_completed > 0)
      .sort((a, b) => (b.goals_completed || 0) - (a.goals_completed || 0));

    setGoalsLeaders(goalsLeaderData);

    // Habits completed count
    const habitsByUser = new Map<string, number>();
    habitEntries?.forEach(entry => {
      if (entry.completed) {
        habitsByUser.set(entry.user_id, (habitsByUser.get(entry.user_id) || 0) + 1);
      }
    });

    const habitsLeaderData = profiles
      .map(p => ({
        ...p,
        habits_completed: habitsByUser.get(p.user_id) || 0,
      }))
      .filter(p => p.habits_completed && p.habits_completed > 0)
      .sort((a, b) => (b.habits_completed || 0) - (a.habits_completed || 0));

    setHabitsLeaders(habitsLeaderData);

    setLoading(false);
  };

  const toggleVisibility = async () => {
    const newValue = !isPublic;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ 
        key: "leaderboard_visibility",
        value: { public: newValue } 
      }, { onConflict: 'key' });

    if (error) {
      toast.error(language === "bn" ? "আপডেট করতে সমস্যা হয়েছে" : "Failed to update");
    } else {
      setIsPublic(newValue);
      toast.success(
        newValue 
          ? (language === "bn" ? "লিডারবোর্ড পাবলিক করা হয়েছে" : "Leaderboard is now public")
          : (language === "bn" ? "লিডারবোর্ড প্রাইভেট করা হয়েছে" : "Leaderboard is now private")
      );
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center font-medium text-muted-foreground text-sm">{index + 1}</span>;
  };

  const getRankBg = (index: number) => {
    if (index === 0) return "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30";
    if (index === 1) return "bg-gradient-to-r from-gray-500/10 to-slate-500/10 border-gray-500/30";
    if (index === 2) return "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30";
    return "bg-muted/30 border-border";
  };

  const LeaderList = ({ 
    leaders, 
    valueKey, 
    suffix 
  }: { 
    leaders: LeaderboardUser[]; 
    valueKey: keyof LeaderboardUser; 
    suffix: string;
  }) => (
    <div className="space-y-2">
      {leaders.length === 0 ? (
        <div className="text-muted-foreground text-center py-8 text-sm">
          <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{language === "bn" ? "কোনো ডাটা নেই" : "No data yet"}</p>
        </div>
      ) : (
        leaders.slice(0, 10).map((leader, index) => (
          <div
            key={leader.user_id}
            className={cn(
              "flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all hover:scale-[1.01]",
              getRankBg(index),
              leader.user_id === user?.id && "ring-2 ring-primary ring-offset-1"
            )}
          >
            <div className="flex items-center justify-center w-6 sm:w-8 shrink-0">
              {getRankIcon(index)}
            </div>
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
              <AvatarImage src={leader.avatar_url || undefined} />
              <AvatarFallback className="text-xs sm:text-sm">
                {(leader.full_name || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm sm:text-base truncate">
                {leader.full_name || (language === "bn" ? "অজানা" : "Unknown")}
                {leader.user_id === user?.id && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                    {language === "bn" ? "আপনি" : "You"}
                  </Badge>
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-bold text-base sm:text-lg">
                {typeof leader[valueKey] === "number" ? 
                  valueKey === "total_hours" ? Number(leader[valueKey]).toFixed(1) : leader[valueKey]
                  : 0}
              </span>
              <span className="text-[10px] sm:text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // If leaderboard is private and user is not admin
  if (!isPublic && !isAdmin) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <Card className="max-w-md mx-auto text-center p-8">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {language === "bn" ? "লিডারবোর্ড প্রাইভেট" : "Leaderboard is Private"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {language === "bn" 
                ? "অ্যাডমিন লিডারবোর্ড প্রাইভেট করেছেন। পরে আবার দেখুন।" 
                : "The admin has made the leaderboard private. Check back later."}
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <Trophy className="h-7 w-7 text-yellow-500" />
                {language === "bn" ? "লিডারবোর্ড" : "Leaderboard"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {isPublic ? (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Globe className="h-3 w-3" />
                    {language === "bn" ? "পাবলিক" : "Public"}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Lock className="h-3 w-3" />
                    {language === "bn" ? "প্রাইভেট" : "Private"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Admin Toggle */}
            {isAdmin && (
              <Card className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {isPublic ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    <Label htmlFor="visibility" className="text-sm cursor-pointer">
                      {language === "bn" ? "পাবলিক" : "Public"}
                    </Label>
                  </div>
                  <Switch
                    id="visibility"
                    checked={isPublic}
                    onCheckedChange={toggleVisibility}
                  />
                </div>
              </Card>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : (
          <Tabs defaultValue="time" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1">
              <TabsTrigger value="time" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 text-xs sm:text-sm">
                <Clock className="h-4 w-4" />
                <span className="hidden xs:inline">{language === "bn" ? "সময়" : "Time"}</span>
              </TabsTrigger>
              <TabsTrigger value="streak" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 text-xs sm:text-sm">
                <Flame className="h-4 w-4" />
                <span className="hidden xs:inline">{language === "bn" ? "স্ট্রিক" : "Streak"}</span>
              </TabsTrigger>
              <TabsTrigger value="goals" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 text-xs sm:text-sm">
                <Target className="h-4 w-4" />
                <span className="hidden xs:inline">{language === "bn" ? "গোল" : "Goals"}</span>
              </TabsTrigger>
              <TabsTrigger value="habits" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 text-xs sm:text-sm">
                <Trophy className="h-4 w-4" />
                <span className="hidden xs:inline">{language === "bn" ? "হ্যাবিট" : "Habits"}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="time">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5" />
                    {language === "bn" ? "টোটাল টাইম" : "Total Time"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LeaderList 
                    leaders={timeLeaders} 
                    valueKey="total_hours" 
                    suffix={language === "bn" ? "ঘ" : "h"} 
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="streak">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Flame className="h-5 w-5 text-orange-500" />
                    {language === "bn" ? "স্ট্রিক কাউন্ট" : "Streak Count"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LeaderList 
                    leaders={streakLeaders} 
                    valueKey="streak" 
                    suffix={language === "bn" ? "দিন" : "d"} 
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="goals">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-blue-500" />
                    {language === "bn" ? "গোল সংখ্যা" : "Goals Created"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LeaderList 
                    leaders={goalsLeaders} 
                    valueKey="goals_completed" 
                    suffix="" 
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="habits">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="h-5 w-5 text-green-500" />
                    {language === "bn" ? "হ্যাবিট কমপ্লিট" : "Habits Completed"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LeaderList 
                    leaders={habitsLeaders} 
                    valueKey="habits_completed" 
                    suffix="" 
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

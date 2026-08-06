import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Shield, Users, BarChart3, Settings2, Loader2, UserCog,
  Target, CheckSquare, Clock, BookOpen, Image, Flame,
  TrendingUp, Brain, AlertTriangle, Calendar, Eye
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import ProductivityHeatmap from "@/components/admin/ProductivityHeatmap";
import UserDayInspector from "@/components/admin/UserDayInspector";
import AdminAlertSystem from "@/components/admin/AdminAlertSystem";
import ImanDunyaGraphs from "@/components/admin/ImanDunyaGraphs";
import UserModeAnalytics from "@/components/admin/UserModeAnalytics";
import AdaptiveFeedbackModal from "@/components/admin/AdaptiveFeedbackModal";

interface UserProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string;
  deenScore?: number;
  disciplineScore?: number;
}

interface GlobalStats {
  totalUsers: number;
  totalGoals: number;
  totalHabits: number;
  totalHabitEntries: number;
  totalTimeHours: number;
  totalKnowledgeItems: number;
  totalHighlights: number;
  totalSmallWins: number;
}

interface AppSetting {
  key: string;
  value: { public?: boolean; [key: string]: unknown };
}

interface HeatmapData {
  date: string;
  value: number;
  studyMinutes: number;
  salahCount: number;
  deviceMinutes: number;
}

interface ChartData {
  date: string;
  study: number;
  device: number;
  salah: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<GlobalStats>({
    totalUsers: 0, totalGoals: 0, totalHabits: 0, totalHabitEntries: 0,
    totalTimeHours: 0, totalKnowledgeItems: 0, totalHighlights: 0, totalSmallWins: 0,
  });
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [inspectorData, setInspectorData] = useState<any>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    userMode: string;
  }>({ isOpen: false, userId: '', userName: '', userMode: 'islamic' });

  useEffect(() => {
    checkAdminAndFetch();
  }, [user]);

  const checkAdminAndFetch = async () => {
    if (!user) return;

    const { data: isAdminData } = await supabase.rpc("has_role", { 
      _user_id: user.id, 
      _role: "admin" 
    });

    if (!isAdminData) {
      toast.error(language === "bn" ? "অনুমতি নেই" : "Access denied");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    await Promise.all([
      fetchUsers(), 
      fetchStats(), 
      fetchSettings(),
      fetchHeatmapData(),
      fetchChartData()
    ]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, created_at")
      .order("created_at", { ascending: false });

    if (!profiles) return;

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

    // Fetch user scores
    const { data: scores } = await supabase
      .from("user_scores")
      .select("user_id, deen_score, discipline_score")
      .order("date", { ascending: false });

    const scoreMap = new Map<string, { deen: number; discipline: number }>();
    scores?.forEach(s => {
      if (!scoreMap.has(s.user_id)) {
        scoreMap.set(s.user_id, { deen: s.deen_score || 0, discipline: s.discipline_score || 0 });
      }
    });

    const usersWithRoles = profiles.map(p => ({
      ...p,
      role: roleMap.get(p.user_id) || "user",
      deenScore: scoreMap.get(p.user_id)?.deen || 0,
      disciplineScore: scoreMap.get(p.user_id)?.discipline || 0,
    }));

    setUsers(usersWithRoles);
  };

  const fetchStats = async () => {
    const [
      { count: usersCount },
      { count: goalsCount },
      { count: habitsCount },
      { count: habitEntriesCount },
      { data: timeData },
      { count: knowledgeCount },
      { count: highlightsCount },
      { count: winsCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("goals").select("*", { count: "exact", head: true }),
      supabase.from("habits").select("*", { count: "exact", head: true }),
      supabase.from("habit_entries").select("*", { count: "exact", head: true }).eq("completed", true),
      supabase.from("time_entries").select("hours"),
      supabase.from("knowledge_items").select("*", { count: "exact", head: true }),
      supabase.from("monthly_highlights").select("*", { count: "exact", head: true }),
      supabase.from("small_wins").select("*", { count: "exact", head: true }),
    ]);

    const totalHours = timeData?.reduce((sum, entry) => sum + Number(entry.hours), 0) || 0;

    setStats({
      totalUsers: usersCount || 0,
      totalGoals: goalsCount || 0,
      totalHabits: habitsCount || 0,
      totalHabitEntries: habitEntriesCount || 0,
      totalTimeHours: totalHours,
      totalKnowledgeItems: knowledgeCount || 0,
      totalHighlights: highlightsCount || 0,
      totalSmallWins: winsCount || 0,
    });
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) setSettings(data as AppSetting[]);
  };

  const fetchHeatmapData = async (userId?: string) => {
    const last365Days = format(subDays(new Date(), 364), 'yyyy-MM-dd');
    
    let query = supabase
      .from("daily_entries")
      .select("date, focused_study_minutes, revision_minutes, fajr_completed, dhuhr_completed, asr_completed, maghrib_completed, isha_completed, device_time_minutes")
      .gte("date", last365Days);
    
    if (userId) query = query.eq("user_id", userId);

    const { data } = await query;
    if (!data) return;

    const heatmap: HeatmapData[] = data.map(entry => {
      const studyMinutes = (entry.focused_study_minutes || 0) + (entry.revision_minutes || 0);
      const salahCount = [
        entry.fajr_completed, entry.dhuhr_completed, entry.asr_completed,
        entry.maghrib_completed, entry.isha_completed
      ].filter(Boolean).length;
      const deviceMinutes = entry.device_time_minutes || 0;
      
      // Calculate productivity score (0-100)
      const studyScore = Math.min(50, studyMinutes / 3);
      const salahScore = salahCount * 8;
      const devicePenalty = Math.min(20, deviceMinutes / 15);
      const value = Math.round(Math.max(0, Math.min(100, studyScore + salahScore - devicePenalty)));

      return { date: entry.date, value, studyMinutes, salahCount, deviceMinutes };
    });

    setHeatmapData(heatmap);
  };

  const fetchChartData = async (userId?: string) => {
    const last30Days = format(subDays(new Date(), 29), 'yyyy-MM-dd');
    
    let query = supabase
      .from("daily_entries")
      .select("date, focused_study_minutes, revision_minutes, device_time_minutes, fajr_completed, dhuhr_completed, asr_completed, maghrib_completed, isha_completed")
      .gte("date", last30Days)
      .order("date", { ascending: true });
    
    if (userId) query = query.eq("user_id", userId);

    const { data } = await query;
    if (!data) return;

    // Aggregate by date
    const dateMap = new Map<string, { study: number; device: number; salah: number; count: number }>();
    
    data.forEach(entry => {
      const existing = dateMap.get(entry.date) || { study: 0, device: 0, salah: 0, count: 0 };
      const salahCount = [
        entry.fajr_completed, entry.dhuhr_completed, entry.asr_completed,
        entry.maghrib_completed, entry.isha_completed
      ].filter(Boolean).length;

      dateMap.set(entry.date, {
        study: existing.study + (entry.focused_study_minutes || 0) + (entry.revision_minutes || 0),
        device: existing.device + (entry.device_time_minutes || 0),
        salah: existing.salah + salahCount,
        count: existing.count + 1,
      });
    });

    const chart: ChartData[] = Array.from(dateMap.entries()).map(([date, values]) => ({
      date: format(new Date(date), 'MMM d'),
      study: Math.round(values.study / values.count / 60 * 10) / 10,
      device: Math.round(values.device / values.count / 60 * 10) / 10,
      salah: Math.round(values.salah / values.count * 10) / 10,
    }));

    setChartData(chart);
  };

  const openUserInspector = async (userId: string, date: string) => {
    const { data: entry } = await supabase
      .from("daily_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    const { data: muhasaba } = await supabase
      .from("night_muhasaba")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    if (entry) {
      setInspectorData({
        entry,
        muhasaba,
        userName: profile?.full_name || "Unknown User",
        userId,
      });
    } else {
      toast.error("No entry found for this date");
    }
  };

  const handleDayClick = (date: string) => {
    if (selectedUserId) {
      openUserInspector(selectedUserId, date);
    }
  };

  const handleUserSelect = async (userId: string) => {
    setSelectedUserId(userId);
    await Promise.all([fetchHeatmapData(userId), fetchChartData(userId)]);
  };

  const updateUserRole = async (userId: string, newRole: "admin" | "moderator" | "user") => {
    setSavingRole(userId);
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update role");
    } else {
      toast.success("Role updated");
      setUsers(users.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    }
    setSavingRole(null);
  };

  const toggleSetting = async (key: string, currentValue: boolean) => {
    const { error } = await supabase
      .from("app_settings")
      .update({ value: { public: !currentValue } })
      .eq("key", key);

    if (error) {
      toast.error("Failed to update setting");
    } else {
      toast.success("Setting updated");
      setSettings(settings.map(s => 
        s.key === key ? { ...s, value: { ...s.value, public: !currentValue } } : s
      ));
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "moderator": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) return null;

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Total Goals", value: stats.totalGoals, icon: Target, color: "text-green-500" },
    { label: "Total Habits", value: stats.totalHabits, icon: CheckSquare, color: "text-purple-500" },
    { label: "Habit Entries", value: stats.totalHabitEntries, icon: Flame, color: "text-orange-500" },
    { label: "Total Hours", value: stats.totalTimeHours.toFixed(0), icon: Clock, color: "text-cyan-500" },
    { label: "Knowledge Items", value: stats.totalKnowledgeItems, icon: BookOpen, color: "text-pink-500" },
    { label: "Highlights", value: stats.totalHighlights, icon: Image, color: "text-yellow-500" },
    { label: "Small Wins", value: stats.totalSmallWins, icon: TrendingUp, color: "text-emerald-500" },
  ];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              Admin Command Center
            </h1>
            <p className="text-muted-foreground mt-1">Full visibility and control</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm py-2.5">
              <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="text-xs sm:text-sm py-2.5">
              <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Heatmap</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs sm:text-sm py-2.5">
              <Brain className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm py-2.5">
              <Users className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm py-2.5">
              <Settings2 className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                    <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Study vs Device Time (Last 30 Days)</CardTitle>
                  <CardDescription>Average hours per user</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="study" stroke="hsl(var(--primary))" strokeWidth={2} name="Study (h)" />
                        <Line type="monotone" dataKey="device" stroke="hsl(var(--destructive))" strokeWidth={2} name="Device (h)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Salah Completion</CardTitle>
                  <CardDescription>Prayers per day (out of 5)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis domain={[0, 5]} className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="salah" fill="hsl(142 76% 36%)" name="Salah" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Heatmap Tab */}
          <TabsContent value="heatmap" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">365-Day Productivity Heatmap</h2>
                <p className="text-sm text-muted-foreground">Click on any day to inspect details</p>
              </div>
              <Select value={selectedUserId || "all"} onValueChange={(v) => handleUserSelect(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-4 overflow-x-auto">
                <ProductivityHeatmap 
                  data={heatmapData} 
                  onDayClick={handleDayClick}
                />
              </CardContent>
            </Card>

            {/* Day Inspector */}
            {inspectorData && (
              <UserDayInspector
                entry={inspectorData.entry}
                muhasaba={inspectorData.muhasaba}
                userName={inspectorData.userName}
                adminId={user?.id || ""}
                onClose={() => setInspectorData(null)}
                onRefresh={() => openUserInspector(inspectorData.userId, inspectorData.entry.date)}
              />
            )}
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            {/* User Mode Analytics */}
            <UserModeAnalytics 
              onSendFeedback={(userId, userName, mode) => 
                setFeedbackModal({ isOpen: true, userId, userName, userMode: mode })
              }
            />

            {/* Iman & Dunya Graphs */}
            <ImanDunyaGraphs 
              selectedUserId={selectedUserId}
              onUserAlert={openUserInspector}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <AdminAlertSystem onUserClick={openUserInspector} />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    User Leaderboard
                  </CardTitle>
                  <CardDescription>Top performers by Deen & Discipline scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {users
                      .sort((a, b) => ((b.deenScore || 0) + (b.disciplineScore || 0)) - ((a.deenScore || 0) + (a.disciplineScore || 0)))
                      .slice(0, 5)
                      .map((u, i) => (
                        <div key={u.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}</span>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback>{(u.full_name || "U")[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{u.full_name || "Unknown"}</p>
                            <div className="flex gap-2 text-xs">
                              <span className="text-emerald-600">Deen: {u.deenScore}</span>
                              <span className="text-primary">Discipline: {u.disciplineScore}</span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleUserSelect(u.user_id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>Manage user roles and view scores</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-3 p-4">
                  {users.map((userProfile) => (
                    <Card key={userProfile.user_id} className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={userProfile.avatar_url || undefined} />
                          <AvatarFallback>{(userProfile.full_name || "U")[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{userProfile.full_name || "Unknown"}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>Deen: {userProfile.deenScore}</span>
                            <span>Disc: {userProfile.disciplineScore}</span>
                          </div>
                        </div>
                        <Badge variant={getRoleBadgeVariant(userProfile.role)}>
                          {userProfile.role}
                        </Badge>
                      </div>
                      <Select
                        value={userProfile.role}
                        onValueChange={(value) => updateUserRole(userProfile.user_id, value as any)}
                        disabled={savingRole === userProfile.user_id || userProfile.user_id === user?.id}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Deen Score</TableHead>
                        <TableHead>Discipline</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((userProfile) => (
                        <TableRow key={userProfile.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={userProfile.avatar_url || undefined} />
                                <AvatarFallback>{(userProfile.full_name || "U")[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{userProfile.full_name || "Unknown"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-emerald-600">
                              {userProfile.deenScore}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-primary">
                              {userProfile.disciplineScore}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(userProfile.role)}>
                              {userProfile.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={userProfile.role}
                              onValueChange={(value) => updateUserRole(userProfile.user_id, value as any)}
                              disabled={savingRole === userProfile.user_id || userProfile.user_id === user?.id}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="moderator">Moderator</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  App Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium">{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="text-sm text-muted-foreground">
                        Currently: {setting.value.public ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <Switch
                      checked={!!setting.value.public}
                      onCheckedChange={() => toggleSetting(setting.key, !!setting.value.public)}
                    />
                  </div>
                ))}
                {settings.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No settings configured</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Adaptive Feedback Modal */}
        <AdaptiveFeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
          userId={feedbackModal.userId}
          userName={feedbackModal.userName}
          userMode={feedbackModal.userMode}
        />
      </div>
    </AppLayout>
  );
}

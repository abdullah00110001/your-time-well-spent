import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminUserManagement from '@/components/admin/panel/AdminUserManagement';
import AdminRoleManagement from '@/components/admin/panel/AdminRoleManagement';
import AdminFeatureControl from '@/components/admin/panel/AdminFeatureControl';
import AdminAlarmControl from '@/components/admin/panel/AdminAlarmControl';
import AdminShieldControl from '@/components/admin/panel/AdminShieldControl';
import AdminGroupControl from '@/components/admin/panel/AdminGroupControl';
import AdminBehaviorRules from '@/components/admin/panel/AdminBehaviorRules';
import AdminAIControl from '@/components/admin/panel/AdminAIControl';
import AdminPayments from '@/components/admin/panel/AdminPayments';
import AdminEntitlements from '@/components/admin/panel/AdminEntitlements';
import AdminRevenue from '@/components/admin/panel/AdminRevenue';
import AdminAnalytics from '@/components/admin/panel/AdminAnalytics';
import AdminDeviceIntelligence from '@/components/admin/panel/AdminDeviceIntelligence';
import AdminAuditLogs from '@/components/admin/panel/AdminAuditLogs';
import AdminSystemHealth from '@/components/admin/panel/AdminSystemHealth';
import AdminGovernance from '@/components/admin/panel/AdminGovernance';
import AdminCompliance from '@/components/admin/panel/AdminCompliance';
import AdminLifeIntelligence from '@/components/admin/panel/AdminLifeIntelligence';
import AdminProductivityEngine from '@/components/admin/panel/AdminProductivityEngine';
import AdminChallenges from '@/components/admin/panel/AdminChallenges';
import AdminSafetyEthics from '@/components/admin/panel/AdminSafetyEthics';
import AdminAppUpdates from '@/components/admin/panel/AdminAppUpdates';
import { 
  Users, Shield, Bell, Brain, CreditCard, BarChart3, 
  Smartphone, FileText, Activity, Scale, Settings, Zap,
  Lock, UserCog, Key, DollarSign, Receipt, UsersRound,
  Heart, Calculator, Trophy, ShieldCheck, Rocket
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const tabs = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: UserCog },
  { id: 'features', label: 'Features', icon: Settings },
  { id: 'alarm', label: 'Rise', icon: Bell },
  { id: 'shield', label: 'Shield', icon: Shield },
  { id: 'groups', label: 'Groups', icon: UsersRound },
  { id: 'behavior', label: 'Rules', icon: Brain },
  { id: 'ai', label: 'AI', icon: Zap },
  { id: 'life', label: 'Life Intel', icon: Heart },
  { id: 'productivity', label: 'Scoring', icon: Calculator },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'safety', label: 'Safety', icon: ShieldCheck },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'entitlements', label: 'Access', icon: Key },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'audit', label: 'Audit', icon: FileText },
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'governance', label: 'Policy', icon: Scale },
  { id: 'compliance', label: 'Compliance', icon: Receipt },
  { id: 'updates', label: 'Updates', icon: Rocket },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">Control Center</h1>
              <p className="text-xs text-muted-foreground">System governance & management</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-12 w-max p-1 bg-muted/50">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="users" className="mt-6"><AdminUserManagement /></TabsContent>
          <TabsContent value="roles" className="mt-6"><AdminRoleManagement /></TabsContent>
          <TabsContent value="features" className="mt-6"><AdminFeatureControl /></TabsContent>
          <TabsContent value="alarm" className="mt-6"><AdminAlarmControl /></TabsContent>
          <TabsContent value="shield" className="mt-6"><AdminShieldControl /></TabsContent>
          <TabsContent value="groups" className="mt-6"><AdminGroupControl /></TabsContent>
          <TabsContent value="behavior" className="mt-6"><AdminBehaviorRules /></TabsContent>
          <TabsContent value="ai" className="mt-6"><AdminAIControl /></TabsContent>
          <TabsContent value="life" className="mt-6"><AdminLifeIntelligence /></TabsContent>
          <TabsContent value="productivity" className="mt-6"><AdminProductivityEngine /></TabsContent>
          <TabsContent value="challenges" className="mt-6"><AdminChallenges /></TabsContent>
          <TabsContent value="safety" className="mt-6"><AdminSafetyEthics /></TabsContent>
          <TabsContent value="payments" className="mt-6"><AdminPayments /></TabsContent>
          <TabsContent value="entitlements" className="mt-6"><AdminEntitlements /></TabsContent>
          <TabsContent value="revenue" className="mt-6"><AdminRevenue /></TabsContent>
          <TabsContent value="analytics" className="mt-6"><AdminAnalytics /></TabsContent>
          <TabsContent value="devices" className="mt-6"><AdminDeviceIntelligence /></TabsContent>
          <TabsContent value="audit" className="mt-6"><AdminAuditLogs /></TabsContent>
          <TabsContent value="health" className="mt-6"><AdminSystemHealth /></TabsContent>
          <TabsContent value="governance" className="mt-6"><AdminGovernance /></TabsContent>
          <TabsContent value="compliance" className="mt-6"><AdminCompliance /></TabsContent>
          <TabsContent value="updates" className="mt-6"><AdminAppUpdates /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

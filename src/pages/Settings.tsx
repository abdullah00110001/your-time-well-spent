import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppMode } from '@/contexts/AppModeContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User, Mail, Save, Palette, Globe, Key, RefreshCw, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ModeSwitcher from '@/components/mode/ModeSwitcher';
import NotificationSettings from '@/components/notifications/NotificationSettings';

import PremiumTab from '@/components/settings/PremiumTab';
import AppUpdateChecker from '@/components/settings/AppUpdateChecker';
import PermissionsCard from '@/components/settings/PermissionsCard';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    bio: '',
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, bio')
      .eq('user_id', user!.id)
      .single();

    if (data) {
      setProfile({
        full_name: data.full_name || '',
        bio: data.bio || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profile.full_name, bio: profile.bio })
      .eq('user_id', user!.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success(t('settings.updated'));
    }
    setSaving(false);
  };

  const themeOptions = [
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
    { value: 'amoled', label: 'AMOLED' },
    { value: 'midnight', label: 'Midnight' },
    { value: 'forest', label: 'Forest' },
    { value: 'sunset', label: 'Sunset' },
    { value: 'mono', label: 'Mono' },
    { value: 'system', label: t('settings.system') },
  ] as const;

  const languageOptions = [
    { value: 'en', label: t('settings.english'), native: 'English' },
    { value: 'bn', label: t('settings.bangla'), native: 'বাংলা' },
  ] as const;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto pb-24 lg:pb-8">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-headline font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="mt-1 text-body text-muted-foreground">{t('settings.subtitle')}</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="general">
              {language === 'bn' ? 'সাধারণ' : 'General'}
            </TabsTrigger>
            <TabsTrigger value="updates" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {language === 'bn' ? 'আপডেট' : 'Updates'}
            </TabsTrigger>
            <TabsTrigger value="premium" className="gap-1.5">
              <Crown className="h-3.5 w-3.5" />
              {language === 'bn' ? 'প্রিমিয়াম' : 'Premium'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {/* Profile Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-subtitle flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t('settings.profile')}
                    </CardTitle>
                    <CardDescription className="text-caption">{t('settings.updateInfo')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('settings.email')}</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{user?.email}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">{t('settings.fullName')}</Label>
                      <Input id="name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Your name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">{t('settings.bio')}</Label>
                      <Input id="bio" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="A short bio about yourself" />
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {t('settings.save')}
                    </Button>
                  </CardContent>
                </Card>

                <ModeSwitcher />
                <NotificationSettings />
                <PermissionsCard />

                {/* Appearance Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-subtitle flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      {t('settings.appearance')}
                    </CardTitle>
                    <CardDescription className="text-caption">{t('settings.theme')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {themeOptions.map((option) => (
                        <Button key={option.value} variant={theme === option.value ? 'default' : 'outline'} onClick={() => setTheme(option.value)} className="flex-1" size="sm">
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Language Card */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Globe className="h-5 w-5" />
                      {t('settings.language')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="flex flex-col sm:flex-row gap-2">
                      {languageOptions.map((option) => (
                        <Button key={option.value} variant={language === option.value ? 'default' : 'outline'} onClick={() => setLanguage(option.value)} className="flex-1" size="sm">
                          {option.native}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Password & Security Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-subtitle flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      {language === 'bn' ? 'পাসওয়ার্ড ও নিরাপত্তা' : 'Password & Security'}
                    </CardTitle>
                    <CardDescription className="text-caption">
                      {language === 'bn' ? 'আপনার পাসওয়ার্ড পরিবর্তন বা রিসেট করুন' : 'Change or reset your password'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">{language === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}</Label>
                        <Input id="newPassword" type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} placeholder={language === 'bn' ? 'নতুন পাসওয়ার্ড দিন' : 'Enter new password'} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}</Label>
                        <Input id="confirmPassword" type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} placeholder={language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm new password'} />
                      </div>
                      <Button
                        onClick={async () => {
                          if (passwordData.newPassword !== passwordData.confirmPassword) {
                            toast.error(language === 'bn' ? 'পাসওয়ার্ড মিলছে না' : 'Passwords do not match');
                            return;
                          }
                          if (passwordData.newPassword.length < 6) {
                            toast.error(language === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters');
                            return;
                          }
                          setChangingPassword(true);
                          const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
                          if (error) {
                            toast.error(language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন ব্যর্থ' : 'Failed to change password');
                          } else {
                            toast.success(language === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে' : 'Password changed successfully');
                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          }
                          setChangingPassword(false);
                        }}
                        disabled={changingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                        className="w-full sm:w-auto"
                      >
                        {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                        {language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change Password'}
                      </Button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">{language === 'bn' ? 'অথবা' : 'Or'}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {language === 'bn' ? 'আপনার ইমেইলে পাসওয়ার্ড রিসেট লিঙ্ক পাঠান' : 'Send a password reset link to your email'}
                      </p>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!user?.email) return;
                          setSendingReset(true);
                          const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/settings` });
                          if (error) {
                            toast.error(language === 'bn' ? 'রিসেট ইমেইল পাঠাতে ব্যর্থ' : 'Failed to send reset email');
                          } else {
                            toast.success(language === 'bn' ? 'রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে' : 'Reset link sent to your email');
                          }
                          setSendingReset(false);
                        }}
                        disabled={sendingReset}
                        className="w-full sm:w-auto"
                      >
                        {sendingReset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {language === 'bn' ? 'রিসেট লিঙ্ক পাঠান' : 'Send Reset Link'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-subtitle">{t('settings.account')}</CardTitle>
                    <CardDescription className="text-caption">{t('settings.subtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="destructive" onClick={signOut}>{t('nav.signOut')}</Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="updates">
            <AppUpdateChecker />
          </TabsContent>

          <TabsContent value="premium">
            <PremiumTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

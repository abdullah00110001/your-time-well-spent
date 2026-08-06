import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Play, Lock, Trash2, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DisciplineProfile {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  strictness_level: string;
  is_active: boolean;
  blocked_apps: string[];
  blocked_websites: string[];
  blocked_keywords: string[];
  block_infinite_content: boolean;
  block_adult_content: boolean;
  default_duration_minutes: number;
}

interface ShieldSession {
  id: string;
  profile_name: string;
}

interface ShieldProfilesProps {
  profiles: DisciplineProfile[];
  onStartSession: (profile: DisciplineProfile) => void;
  activeSession: ShieldSession | null;
  onRefresh: () => void;
}

export function ShieldProfiles({ profiles, onStartSession, activeSession, onRefresh }: ShieldProfilesProps) {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    icon: '🎯',
    description: '',
    strictness_level: 'normal',
    default_duration_minutes: 60
  });

  const getStrictnessColor = (level: string) => {
    switch (level) {
      case 'normal': return 'bg-primary/20 text-primary border-primary/30';
      case 'hard': return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      case 'absolute': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStrictnessIcons = (level: string) => {
    const levels = ['normal', 'hard', 'absolute'];
    const currentIndex = levels.indexOf(level);
    
    return Array.from({ length: 3 }, (_, i) => (
      <Lock key={i} className={cn('h-4 w-4', i <= currentIndex ? 'text-destructive' : 'text-muted-foreground/30')} />
    ));
  };

  const createProfile = async () => {
    if (!user || !newProfile.name) return;

    const { error } = await supabase
      .from('discipline_profiles')
      .insert({
        user_id: user.id,
        ...newProfile,
        blocked_apps: [],
        blocked_websites: [],
        blocked_keywords: [],
        block_infinite_content: true,
        block_adult_content: true
      });

    if (error) {
      toast.error('Failed to create profile');
      return;
    }

    toast.success('Profile created!');
    setShowCreateDialog(false);
    setNewProfile({ name: '', icon: '🎯', description: '', strictness_level: 'normal', default_duration_minutes: 60 });
    onRefresh();
  };

  const deleteProfile = async (profileId: string) => {
    const { error } = await supabase.from('discipline_profiles').delete().eq('id', profileId);
    if (error) {
      toast.error('Failed to delete profile');
      return;
    }
    toast.success('Profile deleted');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Card className="bg-primary/10 border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">ADD A NEW PROFILE</p>
                  <p className="text-xs text-muted-foreground">Create custom discipline mode</p>
                </div>
              </div>
              <Play className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {['🎯', '📚', '💼', '🧘', '😴', '💪', '🔥', '⚡'].map((emoji) => (
                <Button key={emoji} variant={newProfile.icon === emoji ? 'default' : 'outline'} className="text-2xl h-12" onClick={() => setNewProfile(p => ({ ...p, icon: emoji }))}>
                  {emoji}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Profile Name</Label>
              <Input placeholder="e.g., Study Mode" value={newProfile.name} onChange={(e) => setNewProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Strictness Level</Label>
              <Select value={newProfile.strictness_level} onValueChange={(value) => setNewProfile(p => ({ ...p, strictness_level: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">🟢 Normal - Easy to disable</SelectItem>
                  <SelectItem value="hard">🟡 Hard - Requires cooldown</SelectItem>
                  <SelectItem value="absolute">🔴 Absolute - Cannot disable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Duration (minutes)</Label>
              <Input type="number" value={newProfile.default_duration_minutes} onChange={(e) => setNewProfile(p => ({ ...p, default_duration_minutes: parseInt(e.target.value) || 60 }))} />
            </div>
            <Button className="w-full" onClick={createProfile}>Create Profile</Button>
          </div>
        </DialogContent>
      </Dialog>

      {profiles.map((profile) => (
        <Card key={profile.id} className={cn('transition-all', profile.is_active && 'ring-2 ring-primary')}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-2xl">{profile.icon}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{profile.name}</h3>
                    {profile.is_active && <Badge className="bg-primary text-xs">Active</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{profile.description || 'No description'}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {profile.blocked_apps?.slice(0, 3).map((app, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{app}</Badge>
                    ))}
                    {(profile.blocked_apps?.length || 0) > 3 && (
                      <Badge variant="secondary" className="text-xs">+{(profile.blocked_apps?.length || 0) - 3} more</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1">{getStrictnessIcons(profile.strictness_level)}</div>
                <Badge variant="outline" className={getStrictnessColor(profile.strictness_level)}>{profile.strictness_level}</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{profile.default_duration_minutes} min</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteProfile(profile.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <Button size="sm" onClick={() => onStartSession(profile)} disabled={!!activeSession}>
                  <Play className="h-4 w-4 mr-1" />Activate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
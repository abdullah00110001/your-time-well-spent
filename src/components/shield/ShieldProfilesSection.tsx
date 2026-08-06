import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  ChevronRight,
  Ban,
  MoreVertical,
  Edit,
  Trash2,
  Copy
} from 'lucide-react';
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

interface ShieldProfilesSectionProps {
  profiles: DisciplineProfile[];
  onActivate: (profile: DisciplineProfile) => void;
  activeSession: { profile_name: string } | null;
  onRefresh: () => void;
}

export function ShieldProfilesSection({ profiles, onActivate, activeSession, onRefresh }: ShieldProfilesSectionProps) {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    icon: '🎯',
    description: '',
    strictness_level: 'normal',
    default_duration_minutes: 60
  });

  const emojiOptions = ['🎯', '📚', '💼', '🧘', '😴', '💪', '🔥', '⚡', '🚀', '🎮', '📵', '🧠'];

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

  const duplicateProfile = async (profile: DisciplineProfile) => {
    if (!user) return;

    const { error } = await supabase
      .from('discipline_profiles')
      .insert({
        user_id: user.id,
        name: `${profile.name} (Copy)`,
        icon: profile.icon,
        description: profile.description,
        strictness_level: profile.strictness_level,
        blocked_apps: profile.blocked_apps,
        blocked_websites: profile.blocked_websites,
        blocked_keywords: profile.blocked_keywords,
        block_infinite_content: profile.block_infinite_content,
        block_adult_content: profile.block_adult_content,
        default_duration_minutes: profile.default_duration_minutes
      });

    if (error) {
      toast.error('Failed to duplicate profile');
      return;
    }
    toast.success('Profile duplicated');
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-lg">Profiles</h2>

      {/* Add New Profile Card */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Card className="bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-cyan-500/30 cursor-pointer hover:from-cyan-600/40 hover:to-blue-600/40 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/30 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-cyan-400" />
                </div>
                <span className="font-semibold text-cyan-100">ADD A NEW PROFILE</span>
              </div>
              <ChevronRight className="h-5 w-5 text-cyan-400" />
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-2">
              {emojiOptions.map((emoji) => (
                <Button 
                  key={emoji} 
                  variant={newProfile.icon === emoji ? 'default' : 'outline'} 
                  className="text-xl h-10 p-0" 
                  onClick={() => setNewProfile(p => ({ ...p, icon: emoji }))}
                >
                  {emoji}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Profile Name</Label>
              <Input 
                placeholder="e.g., Study Mode" 
                value={newProfile.name} 
                onChange={(e) => setNewProfile(p => ({ ...p, name: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input 
                placeholder="e.g., For focused study sessions" 
                value={newProfile.description} 
                onChange={(e) => setNewProfile(p => ({ ...p, description: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Strictness Level</Label>
              <Select 
                value={newProfile.strictness_level} 
                onValueChange={(value) => setNewProfile(p => ({ ...p, strictness_level: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">🟢 Normal</SelectItem>
                  <SelectItem value="hard">🟡 Hard</SelectItem>
                  <SelectItem value="absolute">🔴 Absolute</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Duration (minutes)</Label>
              <Input 
                type="number" 
                value={newProfile.default_duration_minutes} 
                onChange={(e) => setNewProfile(p => ({ ...p, default_duration_minutes: parseInt(e.target.value) || 60 }))} 
              />
            </div>
            <Button className="w-full" onClick={createProfile}>Create Profile</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Cards */}
      {profiles.map((profile) => (
        <Card key={profile.id} className={cn('bg-muted/50 border-muted-foreground/20', profile.is_active && 'ring-2 ring-primary')}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Ban className="h-6 w-6 text-muted-foreground" />
                <span className="font-semibold">{profile.name}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {}}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicateProfile(profile)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => deleteProfile(profile.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Blocked Apps/Sites Preview */}
            <div className="flex flex-wrap gap-2 mb-3">
              {profile.blocked_apps?.slice(0, 4).map((app, i) => (
                <div key={i} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-sm">
                  {app.charAt(0)}
                </div>
              ))}
              {profile.blocked_websites?.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {profile.blocked_websites[0]}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-muted-foreground/10">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/80"
                onClick={() => onActivate(profile)}
                disabled={!!activeSession}
              >
                Activate
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

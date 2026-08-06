import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Users, Target, Sunrise, ShieldCheck, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LifeosGroup, LifeosGroupType, useMyGroups, useCreateGroup, useDiscoverGroups, useJoinGroup } from '@/hooks/useLifeosGroups';
import { GroupDetailPage } from './GroupDetailPage';

interface Props { defaultType?: LifeosGroupType; }

export function LifeosGroupsHome({ defaultType }: Props) {
  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const { data: myGroups, isLoading: myLoading } = useMyGroups(defaultType);
  const { data: discover, isLoading: discoverLoading } = useDiscoverGroups(defaultType ?? 'all', search);
  const join = useJoinGroup();

  const filteredMy = useMemo(() => {
    if (!myGroups) return [];
    if (!search.trim()) return myGroups;
    const s = search.toLowerCase();
    return myGroups.filter(g => g.name.toLowerCase().includes(s) || g.goal.toLowerCase().includes(s));
  }, [myGroups, search]);

  if (openGroupId) {
    return <GroupDetailPage groupId={openGroupId} onBack={() => setOpenGroupId(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Search + Create */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..." className="pl-9 h-11" />
        </div>
        <Button size="icon" onClick={() => setOpenCreate(true)} className="h-11 w-11 shrink-0">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* My Groups */}
      <section>
        <h2 className="text-sm font-bold mb-3 px-1">My Groups</h2>
        {myLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-32" /><Skeleton className="h-32" />
          </div>
        ) : filteredMy.length === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold">No groups yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create one to start competing.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredMy.map(g => <MyGroupCard key={g.id} group={g} onOpen={() => setOpenGroupId(g.id)} />)}
          </div>
        )}
      </section>

      {/* Discover */}
      <section>
        <div className="flex items-center justify-between px-1 mb-3">
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-primary" /> Discover
          </h2>
          {search.trim() && (
            <span className="text-[10px] text-muted-foreground">
              {discover?.length ?? 0} result{(discover?.length ?? 0) !== 1 && 's'}
            </span>
          )}
        </div>
        {discoverLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-28" /><Skeleton className="h-28" />
          </div>
        ) : (discover?.length ?? 0) === 0 ? (
          <Card className="p-5 text-center border-dashed">
            <Globe className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {search.trim() ? 'No public groups match your search' : 'No public groups to discover yet'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {discover!.map(g => (
              <DiscoverGroupCard
                key={g.id}
                group={g}
                onJoin={() => join.mutate(g.id)}
                joining={join.isPending}
              />
            ))}
          </div>
        )}
      </section>

      <CreateGroupDialog open={openCreate} onOpenChange={setOpenCreate} defaultType={defaultType} />
    </div>
  );
}

function MyGroupCard({ group, onOpen }: { group: LifeosGroup; onOpen: () => void }) {
  const onTrack = group.on_track_pct ?? 0;
  const trackTone =
    onTrack >= 75 ? 'bg-primary/10 text-primary border-primary/20'
    : onTrack >= 50 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    : 'bg-destructive/10 text-destructive border-destructive/20';
  return (
    <button onClick={onOpen}
      className="text-left bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-foreground/20 transition-all">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {group.type === 'rise' ? <Sunrise className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <Badge variant="outline" className={cn("text-[10px] font-bold border", trackTone)}>
          {onTrack}% On Track
        </Badge>
      </div>
      <h3 className="font-bold text-sm truncate text-foreground">{group.name}</h3>
      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
        <Users className="h-3 w-3" /> {group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 && 's'}
      </p>
      <p className="text-xs flex items-start gap-1 mt-1 text-foreground/80">
        <Target className="h-3 w-3 mt-0.5 text-primary shrink-0" />
        <span className="truncate">{group.goal}</span>
      </p>
    </button>
  );
}

function DiscoverGroupCard({ group, onJoin, joining }: { group: LifeosGroup; onJoin: () => void; joining: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col">
      <div className="flex items-start gap-3 mb-2">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {group.type === 'rise' ? <Sunrise className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm truncate">{group.name}</h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Users className="h-3 w-3" /> {group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 && 's'}
          </p>
        </div>
      </div>
      <p className="text-xs text-foreground/80 flex items-start gap-1 mb-3 line-clamp-2">
        <Target className="h-3 w-3 mt-0.5 text-primary shrink-0" />
        <span>{group.goal}</span>
      </p>
      <Button size="sm" onClick={onJoin} disabled={joining} className="mt-auto h-8 text-xs">
        {joining ? 'Joining…' : 'Join'}
      </Button>
    </div>
  );
}

function CreateGroupDialog({ open, onOpenChange, defaultType }: { open: boolean; onOpenChange: (v: boolean) => void; defaultType?: LifeosGroupType }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<LifeosGroupType>(defaultType ?? 'rise');
  const [goal, setGoal] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const create = useCreateGroup();

  const reset = () => { setName(''); setDescription(''); setGoal(''); setIsPublic(true); };

  const submit = () => {
    if (!name.trim() || !goal.trim()) return;
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined, type, goal: goal.trim(), is_public: isPublic },
      { onSuccess: () => { reset(); onOpenChange(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Group Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Early Risers Club" />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as LifeosGroupType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rise">Rise (Wake-up)</SelectItem>
                <SelectItem value="shield">Shield (Focus)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Collective Goal</Label>
            <Input value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder={type === 'rise' ? 'Wake by 5:00 AM' : 'Max 2h social media'} />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Public group</Label>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || !name.trim() || !goal.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
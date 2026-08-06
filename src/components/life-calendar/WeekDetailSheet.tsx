import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Brain, Smile, Bookmark } from 'lucide-react';
import { type WeekInfo } from '@/hooks/useLifeCalendar';

interface WeekDetailSheetProps {
  weekInfo: WeekInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (yearNumber: number, weekNumber: number, updates: { notes?: string; reflection?: string; life_event?: string }) => Promise<void>;
  saving: boolean;
}

export default function WeekDetailSheet({ weekInfo, open, onOpenChange, onSave, saving }: WeekDetailSheetProps) {
  const [notes, setNotes] = useState('');
  const [reflection, setReflection] = useState('');
  const [lifeEvent, setLifeEvent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Sync local state when week changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && weekInfo) {
      setNotes(weekInfo.data?.notes || '');
      setReflection(weekInfo.data?.reflection || '');
      setLifeEvent(weekInfo.data?.life_event || '');
      setIsEditing(false);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!weekInfo) return;
    await onSave(weekInfo.year, weekInfo.weekInYear, {
      notes: notes || undefined,
      reflection: reflection || undefined,
      life_event: lifeEvent || undefined,
    });
    setIsEditing(false);
  };

  if (!weekInfo) return null;

  const statusColors: Record<string, string> = {
    past: 'bg-muted text-muted-foreground',
    current: 'bg-primary text-primary-foreground',
    future: 'bg-muted text-muted-foreground',
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Age {weekInfo.year}, Week {weekInfo.weekInYear}
          </SheetTitle>
          <SheetDescription>
            {format(weekInfo.calendarDate, 'MMM d, yyyy')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusColors[weekInfo.status]}>
              {weekInfo.status === 'current' ? '📍 Current Week' : weekInfo.status === 'past' ? 'Past' : 'Future'}
            </Badge>
            {weekInfo.data && (
              <>
                {weekInfo.data.discipline_score > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Brain className="h-3 w-3" /> Score: {weekInfo.data.discipline_score}
                  </Badge>
                )}
                {weekInfo.data.focus_hours > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" /> {weekInfo.data.focus_hours}h focus
                  </Badge>
                )}
                {weekInfo.data.mood_avg && (
                  <Badge variant="outline" className="gap-1">
                    <Smile className="h-3 w-3" /> Mood: {weekInfo.data.mood_avg}
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Tags */}
          {weekInfo.data?.tags && weekInfo.data.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {weekInfo.data.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  <Bookmark className="h-3 w-3" /> {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* View / Edit mode */}
          {!isEditing && weekInfo.status !== 'future' ? (
            <div className="space-y-3">
              {weekInfo.data?.life_event && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Life Event</p>
                  <p className="text-sm text-foreground">{weekInfo.data.life_event}</p>
                </div>
              )}
              {weekInfo.data?.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{weekInfo.data.notes}</p>
                </div>
              )}
              {weekInfo.data?.reflection && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reflection</p>
                  <p className="text-sm text-foreground">{weekInfo.data.reflection}</p>
                </div>
              )}
              <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
                {weekInfo.data ? 'Edit Notes' : 'Add Notes & Reflection'}
              </Button>
            </div>
          ) : weekInfo.status !== 'future' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Life Event</Label>
                <Textarea
                  placeholder="e.g. Started new job, graduation..."
                  value={lifeEvent}
                  onChange={(e) => setLifeEvent(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  placeholder="What happened this week?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reflection</Label>
                <Textarea
                  placeholder="What did you learn?"
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              This week hasn't happened yet. Live it first! 🌱
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

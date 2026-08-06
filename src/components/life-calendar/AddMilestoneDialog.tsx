import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddMilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (milestone: { title: string; description: string | null; milestone_type: string; milestone_date: string; icon: string; color: string }) => Promise<{ error: any } | undefined>;
}

const milestoneTypes = [
  { value: 'achievement', label: '🏆 Achievement', color: '#22c55e' },
  { value: 'graduation', label: '🎓 Graduation', color: '#3b82f6' },
  { value: 'marriage', label: '💍 Marriage', color: '#ec4899' },
  { value: 'career', label: '💼 Career', color: '#8b5cf6' },
  { value: 'crisis', label: '⚡ Crisis', color: '#ef4444' },
  { value: 'turning_point', label: '🔄 Turning Point', color: '#f59e0b' },
  { value: 'business', label: '🚀 Business', color: '#06b6d4' },
  { value: 'travel', label: '✈️ Travel', color: '#14b8a6' },
  { value: 'other', label: '📌 Other', color: '#6b7280' },
];

export default function AddMilestoneDialog({ open, onOpenChange, onAdd }: AddMilestoneDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('achievement');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedType = milestoneTypes.find(t => t.value === type);

  const handleAdd = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    await onAdd({
      title: title.trim(),
      description: description.trim() || null,
      milestone_type: type,
      milestone_date: date,
      icon: selectedType?.label.split(' ')[0] || '📌',
      color: selectedType?.color || '#6b7280',
    });
    setSaving(false);
    setTitle('');
    setDescription('');
    setDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Life Milestone</DialogTitle>
          <DialogDescription>Mark an important moment in your life</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Started University"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {milestoneTypes.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date *</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              maxLength={500}
            />
          </div>

          <Button onClick={handleAdd} disabled={!title.trim() || !date || saving} className="w-full">
            {saving ? 'Adding...' : 'Add Milestone'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const SUGGESTIONS = ['Quran 📖', 'Workout 💪', 'Coding 💻', 'Studying 📚', 'Coffee ☕', 'Walking 🚶', 'Praying 🤲'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void> | void;
}

export function WakeStatusModal({ open, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim());
      setText('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>You're up — what's the move?</DialogTitle>
          <DialogDescription>Share your status with the group.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            autoFocus
            placeholder="e.g. Reading Quran"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => setText(s)}
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Skip</Button>
          <Button onClick={submit} disabled={!text.trim() || busy}>
            Share status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
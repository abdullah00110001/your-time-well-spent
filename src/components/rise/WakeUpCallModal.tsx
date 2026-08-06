import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BellRing } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  targetName: string;
  remaining: number;
  onSend: (message: string) => Promise<void> | void;
}

export function WakeUpCallModal({ open, onClose, targetName, remaining, onSend }: Props) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await onSend(msg.trim());
      setMsg('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Wake up {targetName}
          </DialogTitle>
          <DialogDescription>
            This fires a real alarm on their phone. {remaining} call{remaining === 1 ? '' : 's'} left for this session.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Textarea
            placeholder="Optional message — e.g. 'Fajr is ending, get up!'"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            maxLength={140}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={busy || remaining <= 0}>Send wake-up</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
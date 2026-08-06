import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck } from 'lucide-react';
import { useTrustedWakers } from '@/hooks/useWakeBroadcast';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  member: { user_id: string; full_name: string } | null;
}

/**
 * Long-press a member card to open this sheet:
 * "Trust this person to wake me" — gives them unlimited wake-calls (1/min cooldown).
 */
export function TrustWakerSheet({ open, onOpenChange, groupId, member }: Props) {
  const { user } = useAuth();
  const { data: trusted, toggle } = useTrustedWakers(groupId, user?.id);
  const isTrusted = member ? trusted?.has(member.user_id) ?? false : false;

  if (!member) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Trusted Waker
          </SheetTitle>
          <SheetDescription>
            Let <strong>{member.full_name}</strong> send you unlimited wake calls in the morning.
            Normal members can only call you {2}× per day.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex items-center justify-between rounded-2xl border p-4">
          <div>
            <p className="font-semibold text-sm">Trust {member.full_name}</p>
            <p className="text-xs text-muted-foreground">Min 60s gap between calls</p>
          </div>
          <Switch
            checked={isTrusted}
            onCheckedChange={() => toggle.mutate(member.user_id)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

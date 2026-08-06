import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Bell, ImagePlus, Send, Smile, Trash2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeleteForEveryone, useDeleteForMe } from '@/hooks/useGroupChat';

export interface ChatMessage {
  id: string;
  user_id: string;
  full_name: string | null;
  text: string;
  sent_at: string;
  reactions?: { emoji: string; count: number }[];
  is_system?: boolean;
  deleted_for_everyone?: boolean;
}

interface Props {
  groupName: string;
  groupId?: string;
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (text: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${ampm} ${String(h % 12 || 12).padStart(2, '0')}:${m}`;
}
function fmtDateSep(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function shouldShowDateSep(prev: ChatMessage | undefined, curr: ChatMessage): boolean {
  if (!prev) return true;
  return new Date(prev.sent_at).toDateString() !== new Date(curr.sent_at).toDateString();
}

function SystemMsg({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-center py-1">
      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs text-primary">
        <Bell className="h-3 w-3" />
        {msg.text}
      </div>
    </div>
  );
}

function ChatBubble({
  msg, isMe, showAvatar, onLongPress,
}: {
  msg: ChatMessage; isMe: boolean; showAvatar: boolean; onLongPress: (msg: ChatMessage) => void;
}) {
  const initials = (msg.full_name || '?').slice(0, 2).toUpperCase();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (msg.deleted_for_everyone) return;
    timerRef.current = setTimeout(() => onLongPress(msg), 450);
  };
  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  return (
    <div className={cn('flex items-end gap-2', isMe && 'flex-row-reverse')}>
      <div className="h-7 w-7 shrink-0">
        {showAvatar && !isMe ? (
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{initials}</AvatarFallback>
          </Avatar>
        ) : (<div className="h-7 w-7" />)}
      </div>

      <div className={cn('flex max-w-[70%] flex-col gap-0.5', isMe && 'items-end')}>
        {showAvatar && !isMe && (
          <span className="px-1 text-[10px] text-muted-foreground">{msg.full_name || 'Anonymous'}</span>
        )}

        <div
          onContextMenu={(e) => { e.preventDefault(); if (!msg.deleted_for_everyone) onLongPress(msg); }}
          onTouchStart={start}
          onTouchEnd={cancel}
          onTouchMove={cancel}
          onMouseDown={start}
          onMouseUp={cancel}
          onMouseLeave={cancel}
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed select-none',
            msg.deleted_for_everyone
              ? 'italic bg-muted/40 border border-dashed border-border text-muted-foreground'
              : isMe
                ? 'rounded-br-sm bg-primary text-primary-foreground'
                : 'rounded-bl-sm bg-muted border border-border text-foreground',
          )}
        >
          {msg.deleted_for_everyone
            ? <span className="inline-flex items-center gap-1"><Ban className="h-3 w-3" /> This message was deleted</span>
            : msg.text}
        </div>

        <div className={cn('flex items-center gap-1.5', isMe && 'flex-row-reverse')}>
          <span className="text-[10px] text-muted-foreground">{fmtTime(msg.sent_at)}</span>
        </div>
      </div>
    </div>
  );
}

export function GroupWakeChat({ groupName, groupId, messages, currentUserId, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const delEveryone = useDeleteForEveryone(groupId);
  const delMe = useDeleteForMe(groupId);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const canDelForEveryone = (m: ChatMessage) => {
    if (m.user_id !== currentUserId) return false;
    return Date.now() - new Date(m.sent_at).getTime() < 24 * 3600 * 1000;
  };

  return (
    <div className="flex flex-col bg-background h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 scrollbar-none">
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const isMe = msg.user_id === currentUserId;
          const prevSameUser = prev && prev.user_id === msg.user_id && !prev.is_system;
          const showAvatar = !prevSameUser;
          const showDate = shouldShowDateSep(prev, msg);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-2 py-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDateSep(msg.sent_at)}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              {msg.is_system
                ? <SystemMsg msg={msg} />
                : <ChatBubble msg={msg} isMe={isMe} showAvatar={showAvatar} onLongPress={setActionMsg} />
              }
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card px-3 py-2.5 flex items-end gap-2">
        <button className="text-muted-foreground hover:text-primary transition-colors p-1 shrink-0">
          <ImagePlus className="h-5 w-5" />
        </button>
        <div className="flex-1 relative">
          <textarea
            className="w-full resize-none rounded-2xl bg-muted border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary min-h-[38px] max-h-32 scrollbar-none"
            placeholder="Message..."
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
        </div>
        <button className="text-muted-foreground hover:text-primary transition-colors p-1 shrink-0">
          <Smile className="h-5 w-5" />
        </button>
        <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={handleSend} disabled={!draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Long-press action sheet */}
      <Sheet open={!!actionMsg} onOpenChange={(v) => { if (!v) setActionMsg(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-6">
          <div className="space-y-2 pt-4">
            <button
              onClick={() => { if (actionMsg) delMe.mutate(actionMsg.id); setActionMsg(null); }}
              className="w-full text-left px-4 py-3 rounded-xl hover:bg-muted flex items-center gap-3"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Delete for me</span>
            </button>
            {actionMsg && canDelForEveryone(actionMsg) && (
              <button
                onClick={() => { if (actionMsg) delEveryone.mutate(actionMsg.id); setActionMsg(null); }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-destructive/10 flex items-center gap-3 text-destructive"
              >
                <Ban className="h-4 w-4" />
                <span className="text-sm">Delete for everyone</span>
              </button>
            )}
            <button
              onClick={() => setActionMsg(null)}
              className="w-full text-center px-4 py-3 rounded-xl border border-border text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

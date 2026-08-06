import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircleOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useGroupChat, useSendChatMessage, GroupChatMessage } from '@/hooks/useGroupChat';

interface Props {
  groupId: string;
  chatEnabled: boolean;
}

export function GroupChatTab({ groupId, chatEnabled }: Props) {
  const { user } = useAuth();
  const { data: messages, isLoading } = useGroupChat(chatEnabled ? groupId : undefined);
  const send = useSendChatMessage(groupId);
  const [text, setText] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  if (!chatEnabled) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
        <MessageCircleOff className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-semibold">Chat is currently disabled</p>
        <p className="text-xs text-muted-foreground mt-1">An admin has turned off conversation for this group.</p>
      </div>
    );
  }

  const submit = async () => {
    if (!text.trim()) return;
    await send.mutateAsync({ content: text });
    setText('');
  };

  return (
    <div className="flex flex-col h-[60vh] rounded-2xl border bg-card overflow-hidden">
      <ScrollArea ref={scrollerRef} className="flex-1 px-3 py-4">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading conversation…</p>
        ) : (messages?.length ?? 0) === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Say good morning to your circle.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages!.map((m) => <MessageBubble key={m.id} message={m} isMe={m.user_id === user?.id} />)}
          </div>
        )}
      </ScrollArea>
      <div className="border-t bg-background/95 backdrop-blur p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Write a message…"
          maxLength={500}
          className="h-11"
        />
        <Button size="icon" className="h-11 w-11 shrink-0" onClick={submit} disabled={send.isPending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message, isMe }: { message: GroupChatMessage; isMe: boolean }) {
  if (message.is_system) {
    return (
      <div className="text-center my-3">
        <span className="text-[11px] px-3 py-1 rounded-full bg-muted text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }
  return (
    <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug shadow-sm',
        isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm',
      )}>
        {!isMe && <p className="text-[11px] font-semibold opacity-80 mb-0.5">{message.author_name}</p>}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={cn('text-[10px] mt-1 tabular-nums', isMe ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
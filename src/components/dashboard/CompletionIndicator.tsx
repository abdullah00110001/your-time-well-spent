import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompletionIndicatorProps {
  isComplete: boolean;
  className?: string;
}

export default function CompletionIndicator({ isComplete, className }: CompletionIndicatorProps) {
  if (!isComplete) return null;
  
  return (
    <div className={cn("flex items-center gap-1.5 text-green-500", className)}>
      <CheckCircle2 className="h-5 w-5" />
      <span className="text-xs font-medium">Complete</span>
    </div>
  );
}

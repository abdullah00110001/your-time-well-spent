import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveFeedbackProps {
  status: SaveStatus;
  className?: string;
  savedMessage?: string;
  errorMessage?: string;
}

export default function SaveFeedback({ 
  status, 
  className,
  savedMessage = 'Saved!',
  errorMessage = 'Failed to save'
}: SaveFeedbackProps) {
  if (status === 'idle') return null;

  return (
    <div className={cn(
      "flex items-center gap-2 text-sm font-medium transition-all duration-300",
      status === 'saving' && "text-muted-foreground",
      status === 'saved' && "text-emerald-600 dark:text-emerald-400",
      status === 'error' && "text-destructive",
      className
    )}>
      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 className="h-4 w-4" />
          <span>{savedMessage}</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-4 w-4" />
          <span>{errorMessage}</span>
        </>
      )}
    </div>
  );
}

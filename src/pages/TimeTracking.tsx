import AppLayout from '@/components/layout/AppLayout';
import { Clock, Construction } from 'lucide-react';

export default function TimeTracking() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
          <Clock className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Time Tracking</h1>
        <p className="text-muted-foreground max-w-sm mb-4">
          Track how you spend your time across different life areas. Understand your patterns and optimize your day.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
          <Construction className="h-4 w-4" />
          Coming Soon
        </div>
      </div>
    </AppLayout>
  );
}

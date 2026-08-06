import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CalendarDays, Clock, Sparkles } from 'lucide-react';

export default function TimeAwareness() {
  const { language } = useLanguage();

  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);
  
  const dayOfYear = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const totalDays = Math.ceil((endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysRemaining = totalDays - dayOfYear;
  const yearProgress = Math.round((dayOfYear / totalDays) * 100);

  return (
    <div className="mb-4 sm:mb-8">

      {/* Year Progress - Separate Card */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{year} {language === 'bn' ? 'সালের অগ্রগতি' : 'Progress'}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-primary">{yearProgress}%</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {language === 'bn' ? 'সম্পন্ন' : 'completed'}
                  </span>
                </div>
                <Progress value={yearProgress} className="h-2 sm:h-3" />
              </div>
            </div>

            {/* Day Counters */}
            <div className="flex justify-center gap-4 sm:gap-6 lg:gap-8">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="mt-1 text-2xl sm:text-3xl font-bold">{dayOfYear}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">
                  {language === 'bn' ? `${totalDays} এর মধ্যে` : `of ${totalDays}`}
                </div>
              </div>
              
              <div className="h-14 sm:h-16 w-px bg-border" />
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-secondary">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="mt-1 text-2xl sm:text-3xl font-bold text-secondary">{daysRemaining}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">
                  {language === 'bn' ? 'দিন বাকি' : 'days left'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
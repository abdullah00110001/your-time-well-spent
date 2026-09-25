/**
 * ChronotypeOnboarding — SECTION 4: a short first-run flow that estimates the
 * user's chronotype and suggests a realistic target sleep time instead of an
 * arbitrary default.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Moon } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: (result: { chronotype: 'lark' | 'neutral' | 'owl'; suggestedSleepTime: string }) => void;
}

interface Q { key: string; question: string; options: { label: string; score: number }[] }

const QUESTIONS: Q[] = [
  {
    key: 'sleepy',
    question: 'On a free evening, when do you naturally start feeling sleepy?',
    options: [
      { label: 'Before 10 PM', score: -2 },
      { label: '10 – 11:30 PM', score: 0 },
      { label: '11:30 PM – 1 AM', score: 1 },
      { label: 'After 1 AM', score: 2 },
    ],
  },
  {
    key: 'wake',
    question: 'On a free day with no alarm, when do you wake up?',
    options: [
      { label: 'Before 6 AM', score: -2 },
      { label: '6 – 7:30 AM', score: 0 },
      { label: '7:30 – 9 AM', score: 1 },
      { label: 'After 9 AM', score: 2 },
    ],
  },
  {
    key: 'peak',
    question: 'When do you feel sharpest?',
    options: [
      { label: 'Early morning', score: -2 },
      { label: 'Late morning', score: -1 },
      { label: 'Afternoon', score: 1 },
      { label: 'Late night', score: 2 },
    ],
  },
  {
    key: 'morning',
    question: 'How do the first 30 minutes after waking usually feel?',
    options: [
      { label: 'Alert straight away', score: -2 },
      { label: 'Fine after a few minutes', score: 0 },
      { label: 'Slow and groggy', score: 1 },
      { label: 'Rough for an hour', score: 2 },
    ],
  },
];

export function ChronotypeOnboarding({ open, onOpenChange, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  const q = QUESTIONS[step];

  const choose = (score: number) => {
    const next = [...scores.slice(0, step), score];
    setScores(next);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }
    const total = next.reduce((a, b) => a + b, 0);
    const chronotype: 'lark' | 'neutral' | 'owl' = total <= -3 ? 'lark' : total >= 3 ? 'owl' : 'neutral';
    const suggestedSleepTime = chronotype === 'lark' ? '21:45' : chronotype === 'owl' ? '23:45' : '22:45';
    onDone({ chronotype, suggestedSleepTime });
    onOpenChange(false);
    setStep(0);
    setScores([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4" /> Find your natural rhythm
          </DialogTitle>
          <DialogDescription>
            Four quick questions — {step + 1} of {QUESTIONS.length}. This only sets a
            realistic starting target; you can change it any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium">{q.question}</p>
          <div className="grid gap-2">
            {q.options.map((o) => (
              <button
                key={o.label}
                onClick={() => choose(o.score)}
                className={cn(
                  'rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors',
                  'hover:border-primary hover:bg-primary/5',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Skip for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChronotypeOnboarding;

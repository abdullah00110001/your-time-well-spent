import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Skull, Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface MawtModeProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (preparedness: number) => void;
  lastRating?: number;
}

export default function MawtMode({ isOpen, onClose, onSubmit, lastRating }: MawtModeProps) {
  const [preparedness, setPreparedness] = useState(lastRating || 5);
  const [showReflection, setShowReflection] = useState(true);
  const { mode, labels } = useAppMode();

  const handleSubmit = () => {
    onSubmit(preparedness);
    onClose();
  };

  const getPreparednessLabel = (value: number) => {
    if (value <= 2) return { text: 'Not Ready', color: 'text-rose-500' };
    if (value <= 4) return { text: 'Unprepared', color: 'text-amber-500' };
    if (value <= 6) return { text: 'Somewhat Ready', color: 'text-yellow-500' };
    if (value <= 8) return { text: 'Prepared', color: mode === 'islamic' ? 'text-emerald-500' : 'text-blue-500' };
    return { 
      text: mode === 'islamic' ? 'Ready to Meet Allah' : 'Living Fully', 
      color: mode === 'islamic' ? 'text-emerald-600' : 'text-blue-600' 
    };
  };

  const label = getPreparednessLabel(preparedness);

  const reflectionItems = mode === 'islamic' 
    ? [
        "Have you prayed all your prayers with presence?",
        "Have you sought forgiveness from those you've wronged?",
        "Have you paid your debts and fulfilled your trusts?",
        "Have you prepared your soul for the questioning?",
      ]
    : [
        "Are you living according to your values?",
        "Have you made amends with those you've hurt?",
        "Are you leaving a positive legacy?",
        "Are you making the most of your time?",
      ];

  const actionItems = mode === 'islamic'
    ? [
        "Praying Fajr on time every day",
        "Reading at least 1 page of Quran daily",
        "Giving charity, even if small",
        "Seeking forgiveness before sleeping",
      ]
    : [
        "Starting each day with intention",
        "Reading for personal growth daily",
        "Performing one act of kindness",
        "Reflecting on your day before sleep",
      ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "sm:max-w-lg",
        mode === 'islamic' 
          ? "bg-slate-950 text-slate-100 border-slate-800"
          : "bg-slate-900 text-slate-100 border-slate-700"
      )}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2 text-slate-100">
            <Skull className="h-5 w-5" />
            {labels.realityCheck.title}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            <Calendar className="h-4 w-4 inline mr-1" />
            {labels.realityCheck.weeklyTrigger}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {showReflection ? (
            <>
              <div className="text-center space-y-4">
                <p className="text-lg text-slate-300 leading-relaxed">
                  {mode === 'islamic' 
                    ? '"Every soul will taste death. Then to Us will you be returned."'
                    : '"Memento Mori — Remember that you will die."'}
                </p>
                <p className="text-sm text-slate-500 italic">
                  {mode === 'islamic' ? '— Al-Ankabut 29:57' : '— Stoic Philosophy'}
                </p>
              </div>

              <div className="p-4 border border-slate-700 rounded-lg bg-slate-900/50">
                <p className="text-center text-slate-300">
                  {labels.realityCheck.description}
                </p>
              </div>

              <div className="space-y-2 text-sm text-slate-400">
                {reflectionItems.map((item, idx) => (
                  <p key={idx}>• {item}</p>
                ))}
              </div>

              <Button 
                onClick={() => setShowReflection(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100"
              >
                Continue to Rating
              </Button>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-4">
                  {labels.realityCheck.prompt}
                </p>
                
                <div className="py-6">
                  <p className={cn("text-4xl font-bold mb-2", label.color)}>
                    {preparedness}
                  </p>
                  <p className={cn("text-sm font-medium", label.color)}>
                    {label.text}
                  </p>
                </div>

                <Slider
                  value={[preparedness]}
                  onValueChange={(value) => setPreparedness(value[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>Not Ready</span>
                  <span>Fully Prepared</span>
                </div>
              </div>

              {preparedness <= 4 && (
                <Card className="bg-rose-950/30 border-rose-800">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                      <div className="text-sm text-rose-200">
                        <p className="font-medium">Reflection Needed</p>
                        <p className="text-rose-300 text-xs mt-1">
                          {mode === 'islamic'
                            ? "Consider making tawbah and increasing your good deeds this week. Death comes without warning."
                            : "Consider what changes you need to make to live more fully. Time waits for no one."}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                <p className="text-sm font-medium text-slate-300 mb-2">
                  This week, focus on:
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  {actionItems.map((item, idx) => (
                    <li key={idx}>✓ {item}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowReflection(true)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit}
                  className={cn(
                    "flex-1",
                    mode === 'islamic' 
                      ? "bg-emerald-800 hover:bg-emerald-700 text-emerald-100"
                      : "bg-blue-800 hover:bg-blue-700 text-blue-100"
                  )}
                >
                  Save Reflection
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

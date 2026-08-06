import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LifeOnboardingProps {
  onComplete: (birthDate: string, expectancy: number, gender?: string, country?: string) => Promise<void>;
  saving: boolean;
}

export default function LifeOnboarding({ onComplete, saving }: LifeOnboardingProps) {
  const [step, setStep] = useState(0);
  const [birthDate, setBirthDate] = useState('');
  const [expectancy, setExpectancy] = useState(80);
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');

  const handleSubmit = async () => {
    if (!birthDate) return;
    await onComplete(birthDate, expectancy, gender || undefined, country || undefined);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center max-w-md space-y-6"
          >
            <div className="h-20 w-20 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center">
              <Heart className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Your Life in Weeks</h1>
            <p className="text-muted-foreground leading-relaxed">
              Visualize your entire life as a grid of weeks. Each block represents 7 days — 
              see where you've been, where you are, and what lies ahead.
            </p>
            <p className="text-sm text-muted-foreground italic">
              "The best time to plant a tree was 20 years ago. The second best time is now."
            </p>
            <Button onClick={() => setStep(1)} size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Begin Setup
            </Button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-foreground">When were you born?</h2>
              <p className="text-sm text-muted-foreground mt-1">This helps us calculate your life grid</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Birth Date *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectancy">Life Expectancy (years)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="expectancy"
                    type="number"
                    min={40}
                    max={120}
                    value={expectancy}
                    onChange={(e) => setExpectancy(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">years ({expectancy * 52} weeks)</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gender (optional)</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country (optional)</Label>
                <Input
                  id="country"
                  placeholder="e.g. Bangladesh"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
              <Button onClick={handleSubmit} disabled={!birthDate || saving} className="flex-1">
                {saving ? 'Saving...' : 'Start My Life Calendar'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

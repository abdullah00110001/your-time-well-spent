import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Lock, Mail, Sparkles, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

interface FutureLetter {
  id: string;
  year: number;
  content: string;
  unlock_date: string;
  created_at: string;
}

export default function FutureLetter() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [letter, setLetter] = useState<FutureLetter | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const unlockDate = new Date(currentYear, 11, 31); // Dec 31
  const isUnlocked = new Date() >= unlockDate;
  const daysRemaining = differenceInDays(unlockDate, new Date());

  useEffect(() => {
    if (user) fetchLetter();
  }, [user]);

  const fetchLetter = async () => {
    const { data } = await supabase
      .from('future_letters')
      .select('*')
      .eq('user_id', user!.id)
      .eq('year', currentYear)
      .single();
    
    if (data) {
      setLetter(data);
      setContent(data.content);
    }
    setLoading(false);
  };

  const saveLetter = async () => {
    if (!content.trim()) {
      toast.error(language === 'bn' ? 'চিঠি লিখুন' : 'Please write something');
      return;
    }

    const { error } = await supabase
      .from('future_letters')
      .upsert({
        user_id: user!.id,
        year: currentYear,
        content: content.trim(),
        unlock_date: format(unlockDate, 'yyyy-MM-dd'),
      }, { onConflict: 'user_id,year' });

    if (error) {
      toast.error(language === 'bn' ? 'সংরক্ষণ করা যায়নি' : 'Could not save');
      return;
    }

    toast.success(language === 'bn' ? '💌 চিঠি সংরক্ষিত এবং লক করা হয়েছে!' : '💌 Letter saved and locked!');
    fetchLetter();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-6">
          <div className="animate-pulse text-muted-foreground">
            {language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20">
            {isUnlocked ? (
              <Mail className="h-8 w-8 text-primary" />
            ) : (
              <Lock className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {language === 'bn' ? 'ভবিষ্যতের চিঠি' : 'Letter to Future Self'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isUnlocked 
              ? (language === 'bn' ? 'আপনার চিঠি এখন পড়তে পারেন!' : 'Your letter is now unlocked!')
              : (language === 'bn' 
                  ? `৩১ ডিসেম্বর ${currentYear} পর্যন্ত লক থাকবে` 
                  : `Locked until December 31, ${currentYear}`)}
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          {/* Countdown */}
          {!isUnlocked && (
            <Card className="mb-6 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="flex items-center justify-center gap-4 p-6">
                <Clock className="h-6 w-6 text-secondary" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-secondary">{daysRemaining}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'bn' ? 'দিন বাকি' : 'days remaining'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Letter Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                {letter 
                  ? (isUnlocked 
                      ? (language === 'bn' ? 'আপনার চিঠি' : 'Your Letter')
                      : (language === 'bn' ? 'চিঠি লক করা আছে' : 'Letter Locked'))
                  : (language === 'bn' ? 'নিজের জন্য লিখুন' : 'Write to Yourself')}
              </CardTitle>
              <CardDescription>
                {letter && !isUnlocked
                  ? (language === 'bn' 
                      ? `${format(new Date(letter.created_at), 'dd MMMM yyyy')} তারিখে লেখা` 
                      : `Written on ${format(new Date(letter.created_at), 'MMMM d, yyyy')}`)
                  : (language === 'bn' 
                      ? 'বছরের শেষে এই চিঠি খুলবে' 
                      : 'This letter will unlock at the end of the year')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isUnlocked && letter ? (
                // Show the letter content when unlocked
                <div className="rounded-lg bg-muted/50 p-6">
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {letter.content}
                  </p>
                </div>
              ) : letter ? (
                // Letter is locked - show encrypted preview
                <div className="space-y-4">
                  <div className="relative rounded-lg bg-muted/50 p-6 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                      <div className="text-center">
                        <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-2 font-medium">
                          {language === 'bn' ? '🔒 লক করা আছে' : '🔒 Locked'}
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground blur-sm select-none">
                      {letter.content.slice(0, 200)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {language === 'bn' ? 'চিঠি সফলভাবে সংরক্ষিত' : 'Letter successfully saved'}
                  </div>
                </div>
              ) : (
                // No letter yet - show editor
                <div className="space-y-4">
                  <Textarea
                    placeholder={language === 'bn' 
                      ? `প্রিয় ${currentYear + 1} সালের আমি,\n\nআজ আমি এই চিঠি লিখছি কারণ...\n\nএই বছর আমার লক্ষ্য ছিল...\n\nআমি আশা করি তুমি এখন...` 
                      : `Dear future me,\n\nI'm writing this letter because...\n\nMy goals for this year were...\n\nI hope you are now...`}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    className="resize-none"
                  />
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {content.length} {language === 'bn' ? 'অক্ষর' : 'characters'}
                    </p>
                    <Button onClick={saveLetter} disabled={!content.trim()}>
                      <Lock className="mr-2 h-4 w-4" />
                      {language === 'bn' ? 'লক করুন এবং সংরক্ষণ করুন' : 'Lock & Save'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          {!letter && (
            <Card className="mt-6 border-dashed">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">
                  {language === 'bn' ? '💡 কী লিখবেন?' : '💡 What to write?'}
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• {language === 'bn' ? 'এই বছরের লক্ষ্য এবং স্বপ্ন' : 'Your goals and dreams for this year'}</li>
                  <li>• {language === 'bn' ? 'বর্তমান চিন্তা এবং অনুভূতি' : 'Current thoughts and feelings'}</li>
                  <li>• {language === 'bn' ? 'ভবিষ্যতের নিজেকে পরামর্শ' : 'Advice to your future self'}</li>
                  <li>• {language === 'bn' ? 'যা মনে রাখতে চান' : 'Things you want to remember'}</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

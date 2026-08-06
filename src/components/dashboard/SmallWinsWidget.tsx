import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Award, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SmallWin {
  id: string;
  content: string;
  date: string;
  created_at: string;
}

export default function SmallWinsWidget() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [wins, setWins] = useState<SmallWin[]>([]);
  const [newWin, setNewWin] = useState('');
  const [randomWin, setRandomWin] = useState<SmallWin | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWins();
    }
  }, [user]);

  const fetchWins = async () => {
    const { data } = await supabase
      .from('small_wins')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) {
      setWins(data);
      // Get a random past win to display
      if (data.length > 1) {
        const randomIndex = Math.floor(Math.random() * data.length);
        setRandomWin(data[randomIndex]);
      }
    }
  };

  const addWin = async () => {
    if (!newWin.trim()) return;

    const { error } = await supabase
      .from('small_wins')
      .insert({
        user_id: user!.id,
        content: newWin.trim(),
        date: format(new Date(), 'yyyy-MM-dd'),
      });

    if (error) {
      toast.error(language === 'bn' ? 'সংরক্ষণ করা যায়নি' : 'Could not save');
      return;
    }

    toast.success(language === 'bn' ? '🎉 জয় সংরক্ষিত!' : '🎉 Win logged!');
    setNewWin('');
    setIsAdding(false);
    fetchWins();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5 text-secondary" />
            {language === 'bn' ? 'ছোট জয়গুলো' : 'Small Wins'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdding && (
          <div className="flex gap-2">
            <Input
              placeholder={language === 'bn' ? 'আজ আপনি কী জিতেছেন?' : 'What did you win today?'}
              value={newWin}
              onChange={(e) => setNewWin(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addWin()}
            />
            <Button size="sm" onClick={addWin}>
              {language === 'bn' ? 'সংরক্ষণ' : 'Save'}
            </Button>
          </div>
        )}

        {randomWin && !isAdding && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-secondary" />
              <div>
                <p className="text-sm">{randomWin.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {language === 'bn' ? 'মনে আছে?' : 'Remember this?'} — {format(new Date(randomWin.date), 'MMM d')}
                </p>
              </div>
            </div>
          </div>
        )}

        {wins.length === 0 && !isAdding && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {language === 'bn' ? 'আজকের প্রথম জয় লগ করুন!' : 'Log your first win today!'}
          </p>
        )}

        {!isAdding && wins.length > 0 && (
          <div className="space-y-2">
            {wins.slice(0, 3).map((win) => (
              <div key={win.id} className="flex items-center gap-2 text-sm">
                <span className="text-primary">✓</span>
                <span className="truncate">{win.content}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

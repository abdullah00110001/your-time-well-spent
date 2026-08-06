import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, BookOpen, RefreshCw, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Quote {
  quote: string;
  quote_bn: string;
  author: string | null;
  type?: 'islamic' | 'general';
}

// Static quotes for fallback/mix
const staticQuotes: Quote[] = [
  { quote: "Indeed, with hardship comes ease.", quote_bn: "নিশ্চয়ই কষ্টের সাথে স্বস্তি আছে।", author: "Quran 94:6", type: 'islamic' },
  { quote: "Allah does not burden a soul beyond that it can bear.", quote_bn: "আল্লাহ কোন আত্মাকে তার সাধ্যের বাইরে বোঝা দেন না।", author: "Quran 2:286", type: 'islamic' },
  { quote: "Verily, in the remembrance of Allah do hearts find rest.", quote_bn: "জেনে রাখ, আল্লাহর স্মরণেই অন্তর প্রশান্তি লাভ করে।", author: "Quran 13:28", type: 'islamic' },
  { quote: "Take benefit of five before five: your youth before your old age.", quote_bn: "পাঁচটি বিষয়কে পাঁচটির আগে সুযোগ হিসেবে নাও: বার্ধক্যের আগে যৌবনকে।", author: "Prophet Muhammad ﷺ", type: 'islamic' },
  { quote: "Whoever treads a path seeking knowledge, Allah will make easy for him the path to Paradise.", quote_bn: "যে ব্যক্তি জ্ঞান অন্বেষণে পথ চলে, আল্লাহ তার জন্য জান্নাতের পথ সহজ করে দেন।", author: "Prophet Muhammad ﷺ", type: 'islamic' },
  { quote: "Your time is limited, don't waste it living someone else's life.", quote_bn: "আপনার সময় সীমিত, অন্যের জীবন যাপন করে এটি নষ্ট করবেন না।", author: "Steve Jobs", type: 'general' },
  { quote: "The only way to do great work is to love what you do.", quote_bn: "মহান কাজ করার একমাত্র উপায় হল আপনি যা করেন তা ভালোবাসা।", author: "Steve Jobs", type: 'general' },
  { quote: "Small consistent steps lead to extraordinary results.", quote_bn: "ছোট ধারাবাহিক পদক্ষেপ অসাধারণ ফলাফলের দিকে নিয়ে যায়।", author: null, type: 'general' },
  { quote: "Focus is your superpower. Protect it.", quote_bn: "ফোকাস আপনার সুপারপাওয়ার। এটি রক্ষা করুন।", author: null, type: 'general' },
  { quote: "The discipline you build today shapes the success of tomorrow.", quote_bn: "আজ যে শৃঙ্খলা গড়ে তুলবেন তা আগামীকালের সাফল্য গঠন করবে।", author: null, type: 'general' },
];

export default function UnifiedQuotes() {
  const { language } = useLanguage();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const { data } = await supabase
        .from('motivational_quotes')
        .select('*');
      
      // Merge DB quotes with static quotes
      const dbQuotes: Quote[] = (data || []).map((q: any) => ({
        quote: q.quote,
        quote_bn: q.quote_bn,
        author: q.author,
        type: q.author?.includes('Quran') || q.author?.includes('Prophet') || q.author?.includes('ﷺ') ? 'islamic' : 'general'
      }));

      const mergedQuotes = [...dbQuotes, ...staticQuotes];
      // Shuffle quotes
      const shuffled = mergedQuotes.sort(() => Math.random() - 0.5);
      setAllQuotes(shuffled);
      // Pick 2 random quotes (1 islamic, 1 general if possible)
      const islamicQuotes = shuffled.filter(q => q.type === 'islamic');
      const generalQuotes = shuffled.filter(q => q.type === 'general');
      
      const selectedQuotes: Quote[] = [];
      if (islamicQuotes.length > 0) selectedQuotes.push(islamicQuotes[0]);
      if (generalQuotes.length > 0) selectedQuotes.push(generalQuotes[0]);
      if (selectedQuotes.length < 2 && shuffled.length > 0) {
        selectedQuotes.push(shuffled.find(q => !selectedQuotes.includes(q)) || shuffled[0]);
      }
      
      setQuotes(selectedQuotes.length > 0 ? selectedQuotes : [shuffled[0]]);
    } catch (error) {
      // Fallback to static quotes
      setAllQuotes(staticQuotes);
      setQuotes([staticQuotes[0], staticQuotes[5]]);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Shuffle and pick new quotes
    const shuffled = [...allQuotes].sort(() => Math.random() - 0.5);
    const islamicQuotes = shuffled.filter(q => q.type === 'islamic');
    const generalQuotes = shuffled.filter(q => q.type === 'general');
    
    const selectedQuotes: Quote[] = [];
    if (islamicQuotes.length > 0) selectedQuotes.push(islamicQuotes[0]);
    if (generalQuotes.length > 0) selectedQuotes.push(generalQuotes[0]);
    
    setQuotes(selectedQuotes.length > 0 ? selectedQuotes : [shuffled[0]]);
    setCurrentIndex(0);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const nextQuote = () => {
    setCurrentIndex((prev) => (prev + 1) % quotes.length);
  };

  const prevQuote = () => {
    setCurrentIndex((prev) => (prev - 1 + quotes.length) % quotes.length);
  };

  if (quotes.length === 0) return null;

  const currentQuote = quotes[currentIndex];
  const isIslamic = currentQuote?.type === 'islamic' || 
    currentQuote?.author?.includes('Quran') || 
    currentQuote?.author?.includes('Prophet') ||
    currentQuote?.author?.includes('ﷺ');

  return (
    <Card className="mb-4 sm:mb-6 overflow-hidden border bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isIslamic ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
              {isIslamic ? <Heart className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {language === 'bn' ? 'দৈনিক অনুপ্রেরণা' : 'Daily Inspiration'}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {quotes.length > 1 ? `${currentIndex + 1}/${quotes.length}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {quotes.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={prevQuote}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={nextQuote}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="relative min-h-[60px]">
          <Badge 
            variant="secondary" 
            className={`mb-2 text-[10px] ${isIslamic ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-primary/10 text-primary'}`}
          >
            {isIslamic ? '📿 ' : '💡 '}
            {isIslamic 
              ? (language === 'bn' ? 'ইসলামিক' : 'Islamic') 
              : (language === 'bn' ? 'অনুপ্রেরণা' : 'Motivation')}
          </Badge>
          <p className="text-sm sm:text-base italic text-foreground/90 leading-relaxed">
            "{language === 'bn' ? currentQuote?.quote_bn : currentQuote?.quote}"
          </p>
          {currentQuote?.author && (
            <p className="mt-2 text-xs text-muted-foreground font-medium">
              — {currentQuote.author}
            </p>
          )}
        </div>

        {/* Dots indicator */}
        {quotes.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {quotes.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex 
                    ? 'w-4 bg-primary' 
                    : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

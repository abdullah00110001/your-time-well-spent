import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, ImagePlus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface MonthlyHighlight {
  id: string;
  month: number;
  year: number;
  image_url: string | null;
  note: string | null;
}

const monthNames = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
};

const monthColors = [
  'from-blue-400/20', 'from-pink-400/20', 'from-green-400/20', 'from-yellow-400/20',
  'from-purple-400/20', 'from-cyan-400/20', 'from-orange-400/20', 'from-rose-400/20',
  'from-emerald-400/20', 'from-amber-400/20', 'from-indigo-400/20', 'from-red-400/20',
];

export default function MonthlyHighlights() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [highlights, setHighlights] = useState<MonthlyHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    if (user) fetchHighlights();
  }, [user]);

  const fetchHighlights = async () => {
    const { data } = await supabase
      .from('monthly_highlights')
      .select('*')
      .eq('user_id', user!.id)
      .eq('year', currentYear);
    
    if (data) setHighlights(data);
    setLoading(false);
  };

  const getHighlight = (month: number) => 
    highlights.find(h => h.month === month);

  const openEditor = (month: number) => {
    const existing = getHighlight(month);
    setSelectedMonth(month);
    setNote(existing?.note || '');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || selectedMonth === null) return;
    
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'bn' ? 'ফাইল ৫MB এর কম হতে হবে' : 'File must be less than 5MB');
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user!.id}/${currentYear}-${selectedMonth}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('highlights')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(language === 'bn' ? 'আপলোড ব্যর্থ' : 'Upload failed');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('highlights')
      .getPublicUrl(filePath);

    // Save to database
    await saveHighlight(selectedMonth, urlData.publicUrl, note);
    setUploading(false);
  };

  const saveHighlight = async (month: number, imageUrl?: string | null, noteText?: string) => {
    const existing = getHighlight(month);
    
    const payload = {
      user_id: user!.id,
      year: currentYear,
      month,
      image_url: imageUrl !== undefined ? imageUrl : existing?.image_url || null,
      note: noteText !== undefined ? noteText : existing?.note || null,
    };

    const { error } = await supabase
      .from('monthly_highlights')
      .upsert(payload, { onConflict: 'user_id,year,month' });

    if (error) {
      toast.error(language === 'bn' ? 'সংরক্ষণ করা যায়নি' : 'Could not save');
      return;
    }

    toast.success(language === 'bn' ? 'সংরক্ষিত!' : 'Saved!');
    fetchHighlights();
  };

  const handleSaveNote = async () => {
    if (selectedMonth === null) return;
    await saveHighlight(selectedMonth, undefined, note);
    setSelectedMonth(null);
  };

  const names = language === 'bn' ? monthNames.bn : monthNames.en;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            {language === 'bn' ? 'মাসিক হাইলাইট' : 'Monthly Highlights'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'bn' 
              ? 'প্রতি মাসে একটি বিশেষ মুহূর্ত সংরক্ষণ করুন' 
              : 'Capture one special moment each month'}
          </p>
        </div>

        {/* 12-Month Grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const highlight = getHighlight(month);
            const isPast = month < currentMonth;
            const isCurrent = month === currentMonth;
            const isFuture = month > currentMonth;

            return (
              <Dialog key={month}>
                <DialogTrigger asChild>
                  <Card 
                    className={`group cursor-pointer overflow-hidden transition-all hover:shadow-lg ${
                      isCurrent ? 'ring-2 ring-primary' : ''
                    } ${isFuture ? 'opacity-50' : ''}`}
                    onClick={() => !isFuture && openEditor(month)}
                  >
                    <div className={`relative aspect-[4/3] bg-gradient-to-br ${monthColors[month - 1]} to-transparent`}>
                      {highlight?.image_url ? (
                        <img 
                          src={highlight.image_url} 
                          alt={names[month - 1]}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isPast || isCurrent ? (
                            <Camera className="h-8 w-8 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors" />
                          ) : (
                            <Sparkles className="h-8 w-8 text-muted-foreground/20" />
                          )}
                        </div>
                      )}
                      
                      {/* Month Label */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                        <h3 className="font-semibold text-white">{names[month - 1]}</h3>
                      </div>
                    </div>
                    
                    {highlight?.note && (
                      <CardContent className="p-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {highlight.note}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </DialogTrigger>

                {!isFuture && (
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {names[month - 1]} {currentYear}
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {/* Image Upload */}
                      <div 
                        className="relative aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {highlight?.image_url ? (
                          <img 
                            src={highlight.image_url} 
                            alt={names[month - 1]}
                            className="absolute inset-0 h-full w-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="text-center">
                            <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                              {language === 'bn' ? 'ছবি আপলোড করুন' : 'Upload image'}
                            </p>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </div>

                      {/* Note */}
                      <div>
                        <Textarea
                          placeholder={language === 'bn' ? 'এই মাসের হাইলাইট...' : 'This month\'s highlight...'}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <Button 
                        onClick={handleSaveNote} 
                        className="w-full"
                        disabled={uploading}
                      >
                        {uploading 
                          ? (language === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...') 
                          : (language === 'bn' ? 'সংরক্ষণ করুন' : 'Save')}
                      </Button>
                    </div>
                  </DialogContent>
                )}
              </Dialog>
            );
          })}
        </div>

        {/* Summary */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {language === 'bn' ? 'বছরের অগ্রগতি' : 'Year Progress'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {highlights.length}/12 {language === 'bn' ? 'মাস সংরক্ষিত' : 'months captured'}
                </p>
              </div>
              <div className="text-3xl font-bold text-primary">
                {Math.round((highlights.length / 12) * 100)}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

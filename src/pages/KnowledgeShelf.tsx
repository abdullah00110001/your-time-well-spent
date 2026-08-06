import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, GraduationCap, Film, Plus, Star, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface KnowledgeItem {
  id: string;
  type: 'book' | 'course' | 'movie';
  title: string;
  author: string | null;
  completed_date: string | null;
  rating: number | null;
  notes: string | null;
  cover_url: string | null;
  created_at: string;
}

const typeIcons = {
  book: BookOpen,
  course: GraduationCap,
  movie: Film,
};

const typeColors = {
  book: 'bg-blue-500/10 text-blue-500',
  course: 'bg-purple-500/10 text-purple-500',
  movie: 'bg-pink-500/10 text-pink-500',
};

export default function KnowledgeShelf() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Form state
  const [formType, setFormType] = useState<'book' | 'course' | 'movie'>('book');
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formRating, setFormRating] = useState<number>(5);
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', user!.id)
      .order('completed_date', { ascending: false });
    
    if (data) setItems(data as KnowledgeItem[]);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error(language === 'bn' ? 'শিরোনাম দিন' : 'Please enter a title');
      return;
    }

    const { error } = await supabase
      .from('knowledge_items')
      .insert({
        user_id: user!.id,
        type: formType,
        title: formTitle.trim(),
        author: formAuthor.trim() || null,
        completed_date: formDate,
        rating: formRating,
        notes: formNotes.trim() || null,
      });

    if (error) {
      toast.error(language === 'bn' ? 'সংরক্ষণ করা যায়নি' : 'Could not save');
      return;
    }

    toast.success(language === 'bn' ? '🎉 সংগ্রহে যোগ হয়েছে!' : '🎉 Added to collection!');
    setDialogOpen(false);
    resetForm();
    fetchItems();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormAuthor('');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormRating(5);
    setFormNotes('');
  };

  const filteredItems = activeTab === 'all' 
    ? items 
    : items.filter(item => item.type === activeTab);

  const stats = {
    books: items.filter(i => i.type === 'book').length,
    courses: items.filter(i => i.type === 'course').length,
    movies: items.filter(i => i.type === 'movie').length,
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'bn' ? 'জ্ঞানের সংগ্রহ' : 'Knowledge Shelf'}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {language === 'bn' ? 'আপনার শেখার যাত্রা ট্র্যাক করুন' : 'Track your learning journey'}
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {language === 'bn' ? 'নতুন যোগ করুন' : 'Add New'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {language === 'bn' ? 'নতুন আইটেম যোগ করুন' : 'Add New Item'}
                </DialogTitle>
                <DialogDescription>
                  {language === 'bn' ? 'আপনার সংগ্রহে যোগ করুন' : 'Add to your collection'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>{language === 'bn' ? 'ধরন' : 'Type'}</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          {language === 'bn' ? 'বই' : 'Book'}
                        </div>
                      </SelectItem>
                      <SelectItem value="course">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          {language === 'bn' ? 'কোর্স' : 'Course'}
                        </div>
                      </SelectItem>
                      <SelectItem value="movie">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4" />
                          {language === 'bn' ? 'মুভি' : 'Movie'}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{language === 'bn' ? 'শিরোনাম' : 'Title'}</Label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={language === 'bn' ? 'শিরোনাম লিখুন' : 'Enter title'}
                  />
                </div>

                <div>
                  <Label>{language === 'bn' ? 'লেখক/নির্মাতা' : 'Author/Creator'}</Label>
                  <Input
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder={language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}
                  />
                </div>

                <div>
                  <Label>{language === 'bn' ? 'সমাপ্তির তারিখ' : 'Completion Date'}</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label>{language === 'bn' ? 'রেটিং' : 'Rating'}</Label>
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setFormRating(star)}
                        className="focus:outline-none"
                      >
                        <Star 
                          className={`h-6 w-6 transition-colors ${
                            star <= formRating 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-muted-foreground'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>{language === 'bn' ? 'নোট' : 'Notes'}</Label>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder={language === 'bn' ? 'আপনার চিন্তা...' : 'Your thoughts...'}
                    rows={3}
                  />
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  {language === 'bn' ? 'যোগ করুন' : 'Add to Collection'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Achievement Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-500/10 to-transparent">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
                <BookOpen className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.books}</div>
                <div className="text-sm text-muted-foreground">
                  {language === 'bn' ? 'বই পড়েছেন' : 'Books Read'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-transparent">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
                <GraduationCap className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.courses}</div>
                <div className="text-sm text-muted-foreground">
                  {language === 'bn' ? 'কোর্স শেষ' : 'Courses Completed'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500/10 to-transparent">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/20">
                <Film className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.movies}</div>
                <div className="text-sm text-muted-foreground">
                  {language === 'bn' ? 'মুভি দেখেছেন' : 'Movies Watched'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Grid */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">{language === 'bn' ? 'সব' : 'All'}</TabsTrigger>
            <TabsTrigger value="book">{language === 'bn' ? 'বই' : 'Books'}</TabsTrigger>
            <TabsTrigger value="course">{language === 'bn' ? 'কোর্স' : 'Courses'}</TabsTrigger>
            <TabsTrigger value="movie">{language === 'bn' ? 'মুভি' : 'Movies'}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredItems.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => {
                  const Icon = typeIcons[item.type];
                  return (
                    <Card key={item.id} className="group hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColors[item.type]}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{item.title}</h3>
                            {item.author && (
                              <p className="text-sm text-muted-foreground truncate">{item.author}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star 
                                    key={star}
                                    className={`h-3 w-3 ${
                                      star <= (item.rating || 0) 
                                        ? 'fill-yellow-400 text-yellow-400' 
                                        : 'text-muted'
                                    }`} 
                                  />
                                ))}
                              </div>
                              {item.completed_date && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(item.completed_date), 'MMM yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {item.notes && (
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                            {item.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Trophy className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {language === 'bn' ? 'এখনো কিছু নেই। যোগ করুন!' : 'Nothing here yet. Add something!'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

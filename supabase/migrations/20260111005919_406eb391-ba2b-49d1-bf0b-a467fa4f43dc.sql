-- Create activity_tags table for Life Distribution
CREATE TABLE public.activity_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#8FAE8B',
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default activity tags
INSERT INTO public.activity_tags (name, name_bn, color, icon) VALUES
    ('Work', 'কাজ', '#6366f1', 'Briefcase'),
    ('Family', 'পরিবার', '#ec4899', 'Heart'),
    ('Learning', 'শেখা', '#8b5cf6', 'BookOpen'),
    ('Health', 'স্বাস্থ্য', '#22c55e', 'Dumbbell'),
    ('Entertainment', 'বিনোদন', '#f59e0b', 'Gamepad2'),
    ('Social', 'সামাজিক', '#06b6d4', 'Users'),
    ('Creative', 'সৃজনশীল', '#f97316', 'Palette'),
    ('Rest', 'বিশ্রাম', '#64748b', 'Moon');

-- Create daily_logs table for mood and tag tracking
CREATE TABLE public.daily_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    mood TEXT CHECK (mood IN ('good', 'average', 'bad')),
    tag_id UUID REFERENCES public.activity_tags(id),
    hours NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, date, tag_id)
);

-- Create small_wins table (Impact Log)
CREATE TABLE public.small_wins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create knowledge_items table (Knowledge Shelf)
CREATE TABLE public.knowledge_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('book', 'course', 'movie')),
    title TEXT NOT NULL,
    author TEXT,
    completed_date DATE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quarterly_goals table
CREATE TABLE public.quarterly_goals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
    quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create monthly_highlights table (with image + text)
CREATE TABLE public.monthly_highlights (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    image_url TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, year, month)
);

-- Create future_letters table (locked until Dec 31)
CREATE TABLE public.future_letters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
    content TEXT NOT NULL,
    unlock_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, year)
);

-- Create motivational_quotes table
CREATE TABLE public.motivational_quotes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quote TEXT NOT NULL,
    quote_bn TEXT NOT NULL,
    author TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert sample quotes
INSERT INTO public.motivational_quotes (quote, quote_bn, author) VALUES
    ('The only way to do great work is to love what you do.', 'মহান কাজ করার একমাত্র উপায় হল আপনি যা করেন তা ভালোবাসা।', 'Steve Jobs'),
    ('It does not matter how slowly you go as long as you do not stop.', 'আপনি কত ধীরে যাচ্ছেন তা গুরুত্বপূর্ণ নয় যতক্ষণ আপনি থামছেন না।', 'Confucius'),
    ('The future belongs to those who believe in the beauty of their dreams.', 'ভবিষ্যত তাদের যারা তাদের স্বপ্নের সৌন্দর্যে বিশ্বাস করে।', 'Eleanor Roosevelt'),
    ('Your time is limited, dont waste it living someone elses life.', 'আপনার সময় সীমিত, অন্যের জীবন যাপন করে এটি নষ্ট করবেন না।', 'Steve Jobs'),
    ('The best time to plant a tree was 20 years ago. The second best time is now.', 'গাছ লাগানোর সেরা সময় ছিল ২০ বছর আগে। দ্বিতীয় সেরা সময় হল এখন।', 'Chinese Proverb');

-- Enable RLS on all tables
ALTER TABLE public.activity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.small_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.future_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motivational_quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_tags (public read)
CREATE POLICY "Anyone can view activity tags" ON public.activity_tags FOR SELECT USING (true);

-- RLS Policies for daily_logs
CREATE POLICY "Users can view their own logs" ON public.daily_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own logs" ON public.daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own logs" ON public.daily_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own logs" ON public.daily_logs FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for small_wins
CREATE POLICY "Users can view their own wins" ON public.small_wins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own wins" ON public.small_wins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own wins" ON public.small_wins FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for knowledge_items
CREATE POLICY "Users can view their own items" ON public.knowledge_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own items" ON public.knowledge_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own items" ON public.knowledge_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own items" ON public.knowledge_items FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for quarterly_goals
CREATE POLICY "Users can view their own quarterly goals" ON public.quarterly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own quarterly goals" ON public.quarterly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own quarterly goals" ON public.quarterly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own quarterly goals" ON public.quarterly_goals FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for monthly_highlights
CREATE POLICY "Users can view their own highlights" ON public.monthly_highlights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own highlights" ON public.monthly_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own highlights" ON public.monthly_highlights FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for future_letters
CREATE POLICY "Users can view their own letters" ON public.future_letters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own letters" ON public.future_letters FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for motivational_quotes (public read)
CREATE POLICY "Anyone can view quotes" ON public.motivational_quotes FOR SELECT USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_daily_logs_updated_at BEFORE UPDATE ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_knowledge_items_updated_at BEFORE UPDATE ON public.knowledge_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quarterly_goals_updated_at BEFORE UPDATE ON public.quarterly_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_highlights_updated_at BEFORE UPDATE ON public.monthly_highlights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for monthly highlights
INSERT INTO storage.buckets (id, name, public) VALUES ('highlights', 'highlights', true);

-- Storage policies for highlights bucket
CREATE POLICY "Users can upload their own highlights" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'highlights' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view highlights" ON storage.objects FOR SELECT USING (bucket_id = 'highlights');
CREATE POLICY "Users can update their own highlights" ON storage.objects FOR UPDATE USING (bucket_id = 'highlights' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own highlights" ON storage.objects FOR DELETE USING (bucket_id = 'highlights' AND auth.uid()::text = (storage.foldername(name))[1]);
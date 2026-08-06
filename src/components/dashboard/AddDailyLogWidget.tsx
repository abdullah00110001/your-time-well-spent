import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Loader2, CalendarIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar'; // Assuming shadcn Calendar component
import { format } from 'date-fns';
import { cn } from '@/lib/utils'; // Assuming shadcn cn utility

interface ActivityTag {
  id: string;
  name: string;
  name_bn: string | null;
  color: string;
}

export default function AddDailyLogWidget() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined);
  const [hours, setHours] = useState<number | ''>('');
  const [tags, setTags] = useState<ActivityTag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchActivityTags();
    }
  }, [user]);

  const fetchActivityTags = async () => {
    const { data, error } = await supabase
      .from('activity_tags')
      .select('id, name, name_bn, color')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching activity tags:', error);
      toast({
        title: language === 'bn' ? 'কার্যকলাপ ট্যাগ লোড ব্যর্থ' : 'Failed to load activity tags',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setTags(data || []);
      // Optionally pre-select the first tag if available
      if (data && data.length > 0 && !selectedTagId) {
        setSelectedTagId(data[0].id);
      }
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: language === 'bn' ? 'অনুমতি নেই' : 'Unauthorized',
        description: language === 'bn' ? 'লগ যোগ করার জন্য আপনাকে লগ ইন করতে হবে।' : 'You must be logged in to add a log.',
        variant: 'destructive',
      });
      return;
    }

    if (!date || !selectedTagId || hours === '' || hours <= 0) {
      toast({
        title: language === 'bn' ? 'অসম্পূর্ণ ফর্ম' : 'Incomplete Form',
        description: language === 'bn' ? 'তারিখ, কার্যকলাপ এবং ঘন্টা পূরণ করুন।' : 'Please fill in date, activity, and hours.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const logDate = format(date, 'yyyy-MM-dd'); // Format date for Supabase

    const { error } = await supabase.from('daily_logs').insert({
      user_id: user.id,
      date: logDate,
      tag_id: selectedTagId,
      hours: hours as number,
    });

    if (error) {
      console.error('Error adding daily log:', error);
      toast({
        title: language === 'bn' ? 'লগ যোগ ব্যর্থ' : 'Failed to add daily log',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: language === 'bn' ? 'লগ সফলভাবে যোগ করা হয়েছে' : 'Log added successfully!',
        description: language === 'bn' ? 'আপনার দৈনিক কার্যকলাপ লগ করা হয়েছে।' : 'Your daily activity has been logged.',
        className: "bg-green-500 text-white", // Green background for success
      });
      // Reset form fields
      setHours('');
      // Keep selected tag and date for quick consecutive entries, or reset if preferred
      // setDate(new Date());
      // setSelectedTagId(undefined); // Resetting this might require re-setting the first tag too
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-accent" />
          <CardTitle className="text-base">
            {language === 'bn' ? 'দৈনিক লগ যোগ করুন' : 'Add Daily Log'}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddLog} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="log-date">
              {language === 'bn' ? 'তারিখ' : 'Date'}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  id="log-date"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : (language === 'bn' ? "একটি তারিখ নির্বাচন করুন" : "Pick a date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="activity-tag">
              {language === 'bn' ? 'কার্যকলাপ' : 'Activity'}
            </Label>
            <Select
              value={selectedTagId}
              onValueChange={setSelectedTagId}
              disabled={tags.length === 0}
            >
              <SelectTrigger id="activity-tag">
                <SelectValue placeholder={language === 'bn' ? 'একটি কার্যকলাপ নির্বাচন করুন' : 'Select an activity'} />
              </SelectTrigger>
              <SelectContent>
                {tags.length === 0 && (
                  <SelectItem value="no-tags" disabled>
                    {language === 'bn' ? 'কোনো ট্যাগ পাওয়া যায়নি' : 'No tags found. Add one in settings!'}
                  </SelectItem>
                )}
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {language === 'bn' && tag.name_bn ? tag.name_bn : tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="hours">
              {language === 'bn' ? 'ঘন্টা' : 'Hours'}
            </Label>
            <Input
              id="hours"
              type="number"
              placeholder="e.g., 2.5"
              step="0.1"
              min="0"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value) || '')}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {language === 'bn' ? 'লগ যোগ করুন' : 'Add Log'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

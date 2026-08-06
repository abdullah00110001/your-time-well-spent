import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileJson, FileText, Loader2, Calendar } from 'lucide-react';
import { format, startOfYear, endOfYear } from 'date-fns';
import { toast } from 'sonner';

type ExportFormat = 'json' | 'pdf';

interface ExportData {
  exportedAt: string;
  year: number;
  user: { email: string };
  goals?: any[];
  habits?: any[];
  habitEntries?: any[];
  dailyLogs?: any[];
  smallWins?: any[];
  knowledgeItems?: any[];
  quarterlyGoals?: any[];
  monthlyHighlights?: any[];
  reflections?: any[];
  timeEntries?: any[];
}

export default function DataExport() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [loading, setLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>({
    goals: true,
    habits: true,
    habitEntries: true,
    dailyLogs: true,
    smallWins: true,
    knowledgeItems: true,
    quarterlyGoals: true,
    monthlyHighlights: true,
    reflections: true,
    timeEntries: true,
  });

  const tables = [
    { key: 'goals', label: language === 'bn' ? 'বার্ষিক লক্ষ্য' : 'Yearly Goals' },
    { key: 'habits', label: language === 'bn' ? 'অভ্যাস' : 'Habits' },
    { key: 'habitEntries', label: language === 'bn' ? 'অভ্যাস এন্ট্রি' : 'Habit Entries' },
    { key: 'dailyLogs', label: language === 'bn' ? 'দৈনিক লগ' : 'Daily Logs' },
    { key: 'smallWins', label: language === 'bn' ? 'ছোট জয়' : 'Small Wins' },
    { key: 'knowledgeItems', label: language === 'bn' ? 'জ্ঞানের আইটেম' : 'Knowledge Items' },
    { key: 'quarterlyGoals', label: language === 'bn' ? 'ত্রৈমাসিক লক্ষ্য' : 'Quarterly Goals' },
    { key: 'monthlyHighlights', label: language === 'bn' ? 'মাসিক হাইলাইট' : 'Monthly Highlights' },
    { key: 'reflections', label: language === 'bn' ? 'সাপ্তাহিক রিফ্লেকশন' : 'Weekly Reflections' },
    { key: 'timeEntries', label: language === 'bn' ? 'সময় এন্ট্রি' : 'Time Entries' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const toggleTable = (key: string) => {
    setSelectedTables(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const allSelected = Object.fromEntries(tables.map(t => [t.key, true]));
    setSelectedTables(allSelected);
  };

  const deselectAll = () => {
    const allDeselected = Object.fromEntries(tables.map(t => [t.key, false]));
    setSelectedTables(allDeselected);
  };

  const fetchAllData = async (): Promise<ExportData> => {
    const year = parseInt(selectedYear);
    const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(new Date(year, 11, 31)), 'yyyy-MM-dd');

    const exportData: ExportData = {
      exportedAt: new Date().toISOString(),
      year,
      user: { email: user?.email || '' },
    };

    if (selectedTables.goals) {
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('year', year);
      exportData.goals = data || [];
    }

    if (selectedTables.habits) {
      const { data } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user!.id);
      exportData.habits = data || [];
    }

    if (selectedTables.habitEntries) {
      const { data } = await supabase
        .from('habit_entries')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);
      exportData.habitEntries = data || [];
    }

    if (selectedTables.dailyLogs) {
      const { data } = await supabase
        .from('daily_logs')
        .select('*, activity_tags(name, color)')
        .eq('user_id', user!.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);
      exportData.dailyLogs = data || [];
    }

    if (selectedTables.smallWins) {
      const { data } = await supabase
        .from('small_wins')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);
      exportData.smallWins = data || [];
    }

    if (selectedTables.knowledgeItems) {
      const { data } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('user_id', user!.id);
      exportData.knowledgeItems = data || [];
    }

    if (selectedTables.quarterlyGoals) {
      const { data } = await supabase
        .from('quarterly_goals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('year', year);
      exportData.quarterlyGoals = data || [];
    }

    if (selectedTables.monthlyHighlights) {
      const { data } = await supabase
        .from('monthly_highlights')
        .select('*')
        .eq('user_id', user!.id)
        .eq('year', year);
      exportData.monthlyHighlights = data || [];
    }

    if (selectedTables.reflections) {
      const { data } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', user!.id)
        .gte('week_start', yearStart)
        .lte('week_start', yearEnd);
      exportData.reflections = data || [];
    }

    if (selectedTables.timeEntries) {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);
      exportData.timeEntries = data || [];
    }

    return exportData;
  };

  const downloadJSON = (data: ExportData) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oporajeyo-data-${selectedYear}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generatePDFContent = (data: ExportData): string => {
    let content = `
      <html>
        <head>
          <title>OPORAJEYO - ${language === 'bn' ? 'বার্ষিক রিপোর্ট' : 'Annual Report'} ${selectedYear}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px; }
            h2 { color: #333; margin-top: 30px; }
            h3 { color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f5f5; }
            .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
            .stat-card { padding: 15px; background: #f9f9f9; border-radius: 8px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #16a34a; }
            .footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>🎯 OPORAJEYO - ${language === 'bn' ? 'বার্ষিক রিপোর্ট' : 'Annual Report'} ${selectedYear}</h1>
          <p>${language === 'bn' ? 'রপ্তানির তারিখ' : 'Exported on'}: ${format(new Date(), 'PPP')}</p>
    `;

    // Goals Section
    if (data.goals && data.goals.length > 0) {
      content += `
        <h2>🎯 ${language === 'bn' ? 'বার্ষিক লক্ষ্য' : 'Yearly Goals'}</h2>
        <table>
          <tr><th>${language === 'bn' ? 'শিরোনাম' : 'Title'}</th><th>${language === 'bn' ? 'বিবরণ' : 'Description'}</th></tr>
          ${data.goals.map(g => `<tr><td>${g.title}</td><td>${g.description || '-'}</td></tr>`).join('')}
        </table>
      `;
    }

    // Habits Section
    if (data.habits && data.habits.length > 0) {
      content += `
        <h2>✅ ${language === 'bn' ? 'অভ্যাস' : 'Habits'}</h2>
        <table>
          <tr><th>${language === 'bn' ? 'নাম' : 'Name'}</th><th>${language === 'bn' ? 'ফ্রিকোয়েন্সি' : 'Frequency'}</th><th>${language === 'bn' ? 'সক্রিয়' : 'Active'}</th></tr>
          ${data.habits.map(h => `<tr><td>${h.name}</td><td>${h.frequency}</td><td>${h.is_active ? '✓' : '✗'}</td></tr>`).join('')}
        </table>
      `;
    }

    // Stats Overview
    const habitEntriesCount = data.habitEntries?.filter(e => e.completed).length || 0;
    const smallWinsCount = data.smallWins?.length || 0;
    const knowledgeCount = data.knowledgeItems?.length || 0;
    const quarterlyCompleted = data.quarterlyGoals?.filter(g => g.completed).length || 0;

    content += `
      <h2>📊 ${language === 'bn' ? 'পরিসংখ্যান' : 'Statistics'}</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${habitEntriesCount}</div>
          <div>${language === 'bn' ? 'অভ্যাস সম্পন্ন' : 'Habits Completed'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${smallWinsCount}</div>
          <div>${language === 'bn' ? 'ছোট জয়' : 'Small Wins'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${knowledgeCount}</div>
          <div>${language === 'bn' ? 'জ্ঞানের আইটেম' : 'Knowledge Items'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${quarterlyCompleted}</div>
          <div>${language === 'bn' ? 'ত্রৈমাসিক লক্ষ্য সম্পন্ন' : 'Quarterly Goals Done'}</div>
        </div>
      </div>
    `;

    // Small Wins
    if (data.smallWins && data.smallWins.length > 0) {
      content += `
        <h2>🏆 ${language === 'bn' ? 'ছোট জয়' : 'Small Wins'}</h2>
        <ul>
          ${data.smallWins.slice(0, 20).map(w => `<li><strong>${format(new Date(w.date), 'MMM d')}</strong>: ${w.content}</li>`).join('')}
        </ul>
        ${data.smallWins.length > 20 ? `<p><em>... ${language === 'bn' ? `এবং আরো ${data.smallWins.length - 20}টি` : `and ${data.smallWins.length - 20} more`}</em></p>` : ''}
      `;
    }

    // Knowledge Items
    if (data.knowledgeItems && data.knowledgeItems.length > 0) {
      content += `
        <h2>📚 ${language === 'bn' ? 'জ্ঞানের সংগ্রহ' : 'Knowledge Shelf'}</h2>
        <table>
          <tr><th>${language === 'bn' ? 'শিরোনাম' : 'Title'}</th><th>${language === 'bn' ? 'ধরন' : 'Type'}</th><th>${language === 'bn' ? 'লেখক' : 'Author'}</th><th>${language === 'bn' ? 'রেটিং' : 'Rating'}</th></tr>
          ${data.knowledgeItems.map(k => `<tr><td>${k.title}</td><td>${k.type}</td><td>${k.author || '-'}</td><td>${k.rating ? '⭐'.repeat(k.rating) : '-'}</td></tr>`).join('')}
        </table>
      `;
    }

    content += `
          <div class="footer">
            <p>Generated by OPORAJEYO - ${language === 'bn' ? 'অপরাজেয়' : 'Unconquerable You'}</p>
          </div>
        </body>
      </html>
    `;

    return content;
  };

  const downloadPDF = (data: ExportData) => {
    const content = generatePDFContent(data);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleExport = async () => {
    const selectedCount = Object.values(selectedTables).filter(Boolean).length;
    if (selectedCount === 0) {
      toast.error(language === 'bn' ? 'অন্তত একটি ডেটা টাইপ সিলেক্ট করুন' : 'Select at least one data type');
      return;
    }

    setLoading(true);
    try {
      const data = await fetchAllData();
      
      if (exportFormat === 'json') {
        downloadJSON(data);
      } else {
        downloadPDF(data);
      }

      toast.success(language === 'bn' ? 'ডেটা এক্সপোর্ট সফল!' : 'Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(language === 'bn' ? 'এক্সপোর্ট করতে সমস্যা হয়েছে' : 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {language === 'bn' ? 'ডেটা এক্সপোর্ট' : 'Data Export'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'bn' 
              ? 'আপনার বার্ষিক ডেটা PDF বা JSON ফরম্যাটে ডাউনলোড করুন'
              : 'Download your yearly data as PDF or JSON for personal records'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {language === 'bn' ? 'এক্সপোর্ট অপশন' : 'Export Options'}
              </CardTitle>
              <CardDescription>
                {language === 'bn' ? 'বছর এবং ফরম্যাট সিলেক্ট করুন' : 'Select year and format'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{language === 'bn' ? 'বছর' : 'Year'}</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{language === 'bn' ? 'ফরম্যাট' : 'Format'}</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        JSON (Raw Data)
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PDF (Formatted Report)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Data Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{language === 'bn' ? 'ডেটা সিলেক্ট করুন' : 'Select Data'}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    {language === 'bn' ? 'সব' : 'All'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    {language === 'bn' ? 'কোনটিই না' : 'None'}
                  </Button>
                </div>
              </div>
              <CardDescription>
                {language === 'bn' ? 'কোন ডেটা এক্সপোর্ট করতে চান সিলেক্ট করুন' : 'Choose what data to include'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tables.map(table => (
                  <div key={table.key} className="flex items-center gap-2">
                    <Checkbox 
                      id={table.key}
                      checked={selectedTables[table.key]}
                      onCheckedChange={() => toggleTable(table.key)}
                    />
                    <Label htmlFor={table.key} className="cursor-pointer">
                      {table.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Button */}
        <div className="mt-8 flex justify-center">
          <Button 
            size="lg" 
            onClick={handleExport}
            disabled={loading}
            className="gap-2 px-8"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {loading 
              ? (language === 'bn' ? 'এক্সপোর্ট হচ্ছে...' : 'Exporting...')
              : (language === 'bn' ? 'এক্সপোর্ট করুন' : 'Export Data')}
          </Button>
        </div>

        {/* Info Card */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">
              {language === 'bn' ? '💡 টিপস' : '💡 Tips'}
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {language === 'bn' ? 'JSON ফরম্যাট অন্য অ্যাপে ইমপোর্ট করার জন্য ভালো' : 'JSON format is great for importing into other apps'}</li>
              <li>• {language === 'bn' ? 'PDF ফরম্যাট প্রিন্ট করার জন্য বা শেয়ার করার জন্য ভালো' : 'PDF format is perfect for printing or sharing'}</li>
              <li>• {language === 'bn' ? 'আপনার ডেটা সম্পূর্ণ প্রাইভেট থাকবে' : 'Your data stays completely private'}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2, Calendar, BarChart3, Target, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/contexts/AppModeContext';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';

export function ExportReport() {
  const { user } = useAuth();
  const { mode } = useAppMode();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [generating, setGenerating] = useState(false);

  const getPeriodDates = () => {
    const today = new Date();
    switch (period) {
      case 'week':
        return { start: subDays(today, 7), end: today };
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'quarter':
        return { start: subMonths(today, 3), end: today };
      case 'year':
        return { start: subMonths(today, 12), end: today };
    }
  };

  const generateReport = async () => {
    if (!user) return;
    
    setGenerating(true);
    
    try {
      const { start, end } = getPeriodDates();
      const startDate = format(start, 'yyyy-MM-dd');
      const endDate = format(end, 'yyyy-MM-dd');

      // Fetch data
      const [entriesResult, habitsResult, goalsResult, reflectionsResult] = await Promise.all([
        supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true }),
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('goals')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('user_reflections')
          .select('*')
          .eq('user_id', user.id)
          .gte('reflection_date', startDate)
          .lte('reflection_date', endDate)
      ]);

      const entries = entriesResult.data || [];
      const habits = habitsResult.data || [];
      const goals = goalsResult.data || [];
      const reflections = reflectionsResult.data || [];

      // Calculate stats
      const totalEntries = entries.length;
      const avgStudyTime = entries.reduce((sum, e: any) => sum + (e.study_hours || 0), 0) / Math.max(totalEntries, 1);
      const avgDeviceTime = entries.reduce((sum, e: any) => sum + (e.screen_time_hours || 0), 0) / Math.max(totalEntries, 1);
      const avgFocus = entries.reduce((sum, e: any) => sum + (e.focus_level || 0), 0) / Math.max(totalEntries, 1);
      const avgMood = entries.reduce((sum, e: any) => sum + (e.energy_level || 0), 0) / Math.max(totalEntries, 1);
      const avgDiscipline = entries.reduce((sum, e: any) => sum + (e.weighted_daily_score || 0), 0) / Math.max(totalEntries, 1);
      
      // Generate HTML report
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Life OS Progress Report - ${format(start, 'MMM yyyy')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; padding: 40px; background: linear-gradient(135deg, ${mode === 'islamic' ? '#10b981, #0891b2' : '#3b82f6, #8b5cf6'}); border-radius: 16px; color: white; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { font-size: 18px; margin-bottom: 16px; color: #334155; display: flex; align-items: center; gap: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
    .stat-card { background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: bold; color: ${mode === 'islamic' ? '#10b981' : '#3b82f6'}; }
    .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .list { list-style: none; }
    .list li { padding: 12px 0; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
    .list li:last-child { border-bottom: none; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .footer { text-align: center; margin-top: 40px; color: #64748b; font-size: 14px; }
    @media print { body { background: white; } .container { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Progress Report</h1>
      <p>${format(start, 'MMMM d')} - ${format(end, 'MMMM d, yyyy')}</p>
    </div>

    <div class="section">
      <h2>📈 Overview</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalEntries}</div>
          <div class="stat-label">Days Tracked</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgStudyTime.toFixed(1)}h</div>
          <div class="stat-label">Avg Study Time</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgDeviceTime.toFixed(1)}h</div>
          <div class="stat-label">Avg Device Time</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgFocus.toFixed(1)}</div>
          <div class="stat-label">Avg Focus</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgMood.toFixed(1)}</div>
          <div class="stat-label">Avg Mood</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgDiscipline.toFixed(0)}%</div>
          <div class="stat-label">Discipline Score</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>🎯 Goals (${goals.length})</h2>
      <ul class="list">
        ${goals.map((g: any) => `
          <li>
            <span>${g.title}</span>
            <span class="badge ${g.target_completion >= 100 ? 'badge-success' : 'badge-warning'}">${g.target_completion >= 100 ? 'completed' : 'in progress'}</span>
          </li>
        `).join('')}
        ${goals.length === 0 ? '<li>No goals set for this period</li>' : ''}
      </ul>
    </div>

    <div class="section">
      <h2>✅ Active Habits (${habits.filter(h => h.is_active).length})</h2>
      <ul class="list">
        ${habits.filter(h => h.is_active).map(h => `
          <li>
            <span>${h.name}</span>
            <span style="color: ${h.color}">●</span>
          </li>
        `).join('')}
        ${habits.length === 0 ? '<li>No habits tracked</li>' : ''}
      </ul>
    </div>

    <div class="section">
      <h2>📝 Reflections (${reflections.length})</h2>
      <p style="color: #64748b;">You wrote ${reflections.length} reflection${reflections.length !== 1 ? 's' : ''} during this period.</p>
    </div>

    <div class="footer">
      <p>Generated by Life OS on ${format(new Date(), 'MMMM d, yyyy')}</p>
    </div>
  </div>
</body>
</html>`;

      // Create and download
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life-os-report-${format(start, 'yyyy-MM')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Report downloaded! Open it in a browser to print as PDF.');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Export Progress Report
        </CardTitle>
        <CardDescription>
          Download a comprehensive report of your progress
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Report Period</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Last 3 Months</SelectItem>
                <SelectItem value="year">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={generateReport} disabled={generating} className="w-full sm:w-auto">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Generate Report
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Daily Entries
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            Statistics
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Goals
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Habits
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

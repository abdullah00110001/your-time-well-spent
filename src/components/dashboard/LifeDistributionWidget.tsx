import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface DistributionData {
  name: string;
  value: number;
  color: string;
}

export default function LifeDistributionWidget() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [data, setData] = useState<DistributionData[]>([]);

  useEffect(() => {
    if (user) {
      fetchDistribution();
    }
  }, [user]);

  const fetchDistribution = async () => {
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    
    // Get all daily logs with their tags
    const { data: logs } = await supabase
      .from('daily_logs')
      .select(`
        hours,
        activity_tags (
          name,
          name_bn,
          color
        )
      `)
      .eq('user_id', user!.id)
      .gte('date', startOfYear);

    if (logs && logs.length > 0) {
      // Aggregate hours by tag
      const tagHours: Record<string, { hours: number; color: string; name: string }> = {};
      
      logs.forEach((log: any) => {
        if (log.activity_tags) {
          const tagName = language === 'bn' ? log.activity_tags.name_bn : log.activity_tags.name;
          if (!tagHours[tagName]) {
            tagHours[tagName] = { hours: 0, color: log.activity_tags.color, name: tagName };
          }
          tagHours[tagName].hours += Number(log.hours) || 0;
        }
      });

      const chartData = Object.values(tagHours)
        .filter(t => t.hours > 0)
        .map(t => ({
          name: t.name,
          value: Math.round(t.hours * 10) / 10,
          color: t.color,
        }))
        .sort((a, b) => b.value - a.value);

      setData(chartData);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-5 w-5 text-accent" />
            {language === 'bn' ? 'জীবন বিতরণ' : 'Life Distribution'}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/life-distribution">
              {language === 'bn' ? 'সব দেখুন' : 'View All'}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value}h`, '']}
                  contentStyle={{ 
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background))'
                  }}
                />
                <Legend 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <PieChartIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'bn' ? 'কার্যকলাপ ট্র্যাক করুন' : 'Track activities to see distribution'}
            </p>
            <Button variant="link" size="sm" asChild className="mt-2">
              <Link to="/life-distribution">
                {language === 'bn' ? 'শুরু করুন' : 'Get Started'}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

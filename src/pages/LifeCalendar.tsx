import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useLifeCalendar, type WeekInfo } from '@/hooks/useLifeCalendar';
import LifeOnboarding from '@/components/life-calendar/LifeOnboarding';
import LifeGrid from '@/components/life-calendar/LifeGrid';
import HayatBattery from '@/components/life-calendar/HayatBattery';
import WeekDetailSheet from '@/components/life-calendar/WeekDetailSheet';
import MilestoneTimeline from '@/components/life-calendar/MilestoneTimeline';
import AddMilestoneDialog from '@/components/life-calendar/AddMilestoneDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Grid3X3, Battery, Flag, Plus, Loader2 } from 'lucide-react';

export default function LifeCalendar() {
  const {
    profile,
    loading,
    saving,
    lifeStats,
    milestones,
    saveProfile,
    saveWeekNote,
    addMilestone,
    deleteMilestone,
    getWeekInfo,
  } = useLifeCalendar();

  const [selectedWeek, setSelectedWeek] = useState<WeekInfo | null>(null);
  const [weekSheetOpen, setWeekSheetOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('grid');

  const handleWeekClick = (weekInfo: WeekInfo) => {
    setSelectedWeek(weekInfo);
    setWeekSheetOpen(true);
  };

  const handleOnboardingComplete = async (birthDate: string, expectancy: number, gender?: string, country?: string) => {
    await saveProfile(birthDate, expectancy, gender, country);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // No profile yet — show onboarding
  if (!profile) {
    return (
      <AppLayout>
        <LifeOnboarding onComplete={handleOnboardingComplete} saving={saving} />
      </AppLayout>
    );
  }

  if (!lifeStats) return null;

  return (
    <AppLayout>
      <div className="px-4 pt-2 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Life Calendar</h1>
            <p className="text-xs text-muted-foreground">
              {lifeStats.weeksLived.toLocaleString()} weeks lived · {lifeStats.weeksRemaining.toLocaleString()} remaining
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setMilestoneDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Milestone
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="grid" className="gap-1.5 text-xs">
              <Grid3X3 className="h-3.5 w-3.5" />
              Grid
            </TabsTrigger>
            <TabsTrigger value="battery" className="gap-1.5 text-xs">
              <Battery className="h-3.5 w-3.5" />
              Battery
            </TabsTrigger>
            <TabsTrigger value="milestones" className="gap-1.5 text-xs">
              <Flag className="h-3.5 w-3.5" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-4">
            <LifeGrid
              totalYears={profile.life_expectancy_years}
              getWeekInfo={getWeekInfo}
              onWeekClick={handleWeekClick}
              currentAgeYears={lifeStats.currentAgeYears}
            />
          </TabsContent>

          <TabsContent value="battery" className="mt-4">
            <HayatBattery
              percentUsed={lifeStats.percentUsed}
              weeksLived={lifeStats.weeksLived}
              weeksRemaining={lifeStats.weeksRemaining}
              totalWeeks={lifeStats.totalWeeks}
              currentAge={lifeStats.currentAgeYears}
            />
          </TabsContent>

          <TabsContent value="milestones" className="mt-4">
            <MilestoneTimeline
              milestones={milestones}
              onDelete={deleteMilestone}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Week Detail Sheet */}
      <WeekDetailSheet
        weekInfo={selectedWeek}
        open={weekSheetOpen}
        onOpenChange={setWeekSheetOpen}
        onSave={saveWeekNote}
        saving={saving}
      />

      {/* Add Milestone Dialog */}
      <AddMilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        onAdd={addMilestone}
      />
    </AppLayout>
  );
}

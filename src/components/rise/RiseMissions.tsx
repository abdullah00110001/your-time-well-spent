import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Camera, 
  Calculator, 
  Smartphone, 
  QrCode, 
  Brain,
  Type, 
  Footprints, 
  Dumbbell,
  Shuffle,
  Check,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Mission {
  id: string;
  name: string;
  icon: React.ReactNode;
  emoji: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  enabled: boolean;
  settings?: any;
}

interface RiseMissionsProps {
  selectedMissions: string[];
  onMissionToggle: (missionId: string) => void;
}

export function RiseMissions({ selectedMissions, onMissionToggle }: RiseMissionsProps) {
  const [expandedMission, setExpandedMission] = useState<string | null>(null);

  const missions: Mission[] = [
    {
      id: 'photo',
      name: 'Photo Mission',
      icon: <Camera className="h-5 w-5" />,
      emoji: '📸',
      description: 'Take a photo of a pre-registered location to dismiss alarm',
      difficulty: 'hard',
      enabled: selectedMissions.includes('photo'),
      settings: { registeredLocations: ['Bathroom sink', 'Kitchen', 'Front door'] }
    },
    {
      id: 'math',
      name: 'Math Mission',
      icon: <Calculator className="h-5 w-5" />,
      emoji: '🧮',
      description: 'Solve math problems to wake up your brain',
      difficulty: 'medium',
      enabled: selectedMissions.includes('math'),
      settings: { difficulty: 'medium', problemCount: 3 }
    },
    {
      id: 'shake',
      name: 'Shake Mission',
      icon: <Smartphone className="h-5 w-5" />,
      emoji: '💪',
      description: 'Shake your phone to get blood flowing',
      difficulty: 'easy',
      enabled: selectedMissions.includes('shake'),
      settings: { shakeCount: 30 }
    },
    {
      id: 'barcode',
      name: 'Barcode/QR Mission',
      icon: <QrCode className="h-5 w-5" />,
      emoji: '🏷️',
      description: 'Scan a registered barcode or QR code',
      difficulty: 'hard',
      enabled: selectedMissions.includes('barcode'),
      settings: { registeredCodes: ['Toothpaste', 'Coffee jar'] }
    },
    {
      id: 'memory',
      name: 'Memory Mission',
      icon: <Brain className="h-5 w-5" />,
      emoji: '🧠',
      description: 'Memorize and enter a number sequence',
      difficulty: 'medium',
      enabled: selectedMissions.includes('memory'),
      settings: { sequenceLength: 5 }
    },
    {
      id: 'typing',
      name: 'Typing Mission',
      icon: <Type className="h-5 w-5" />,
      emoji: '✍️',
      description: 'Type a motivational phrase exactly',
      difficulty: 'easy',
      enabled: selectedMissions.includes('typing'),
      settings: { phrases: ['I am awake and ready', 'Today is a new opportunity'] }
    },
    {
      id: 'walking',
      name: 'Walking/Step Mission',
      icon: <Footprints className="h-5 w-5" />,
      emoji: '🚶',
      description: 'Walk a set number of steps',
      difficulty: 'hard',
      enabled: selectedMissions.includes('walking'),
      settings: { stepCount: 50 }
    },
    {
      id: 'squat',
      name: 'Squat Mission',
      icon: <Dumbbell className="h-5 w-5" />,
      emoji: '🏋️',
      description: 'Complete squats using camera detection',
      difficulty: 'hard',
      enabled: selectedMissions.includes('squat'),
      settings: { squatCount: 10 }
    }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-500/20 text-emerald-500';
      case 'medium': return 'bg-amber-500/20 text-amber-500';
      case 'hard': return 'bg-rose-500/20 text-rose-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const popularityOrder = ['math', 'shake', 'memory', 'photo', 'barcode', 'typing', 'squat', 'walking'];

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">Wake-up Missions</span> force you to complete a task 
            before dismissing your alarm. Choose missions that work best for you!
          </p>
        </CardContent>
      </Card>

      {/* Mission Cards */}
      <div className="space-y-3">
        {missions.sort((a, b) => 
          popularityOrder.indexOf(a.id) - popularityOrder.indexOf(b.id)
        ).map((mission) => (
          <Card 
            key={mission.id}
            className={cn(
              'transition-all cursor-pointer',
              mission.enabled && 'border-primary ring-1 ring-primary/50'
            )}
            onClick={() => setExpandedMission(
              expandedMission === mission.id ? null : mission.id
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-12 w-12 rounded-xl flex items-center justify-center text-2xl',
                    mission.enabled ? 'bg-primary/20' : 'bg-muted'
                  )}>
                    {mission.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{mission.name}</h3>
                      <Badge className={getDifficultyColor(mission.difficulty)}>
                        {mission.difficulty}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {mission.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={mission.enabled}
                  onCheckedChange={() => onMissionToggle(mission.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Expanded Settings */}
              {expandedMission === mission.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {mission.id === 'math' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Difficulty Level</span>
                        <div className="flex gap-1">
                          {['Easy', 'Medium', 'Hard', 'Extreme'].map((level) => (
                            <Badge 
                              key={level}
                              variant={level.toLowerCase() === 'medium' ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                            >
                              {level}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Number of Problems</span>
                        <Badge variant="outline">3</Badge>
                      </div>
                    </>
                  )}

                  {mission.id === 'shake' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Shake Count</span>
                      <Badge variant="outline">30 shakes</Badge>
                    </div>
                  )}

                  {mission.id === 'photo' && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Registered Locations</span>
                      {['Bathroom sink', 'Kitchen counter'].map((loc) => (
                        <div key={loc} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <span className="text-sm">{loc}</span>
                          <Check className="h-4 w-4 text-emerald-500" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full">
                        <Camera className="h-4 w-4 mr-2" />
                        Add New Location
                      </Button>
                    </div>
                  )}

                  {mission.id === 'walking' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Required Steps</span>
                      <Badge variant="outline">50 steps</Badge>
                    </div>
                  )}

                  {mission.id === 'squat' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Required Squats</span>
                      <Badge variant="outline">10 squats</Badge>
                    </div>
                  )}

                  {mission.id === 'memory' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sequence Length</span>
                      <Badge variant="outline">5 numbers</Badge>
                    </div>
                  )}

                  {mission.id === 'typing' && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Custom Phrases</span>
                      <div className="p-2 bg-muted rounded-lg">
                        <p className="text-sm italic">"I am awake and ready for the day"</p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Type className="h-4 w-4 mr-2" />
                        Add Custom Phrase
                      </Button>
                    </div>
                  )}

                  {mission.id === 'barcode' && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Registered Barcodes</span>
                      <div className="p-2 bg-muted rounded-lg flex items-center justify-between">
                        <span className="text-sm">Toothpaste</span>
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <QrCode className="h-4 w-4 mr-2" />
                        Scan New Barcode
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Combination Tip */}
      <Card className="bg-muted/50">
        <CardContent className="p-4 flex items-start gap-3">
          <Shuffle className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-sm">Pro Tip: Combine Missions</p>
            <p className="text-xs text-muted-foreground mt-1">
              You can enable multiple missions for a single alarm. 
              Complete them in order to fully dismiss!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

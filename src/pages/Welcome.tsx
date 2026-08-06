import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Shield as ShieldIcon, Sunrise, Target } from 'lucide-react';
import { LifeOSLogo } from '@/components/LifeOSLogo';

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-between px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] overflow-hidden relative">
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full bg-primary/15 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-24 w-80 h-80 rounded-full bg-accent/10 blur-3xl animate-pulse delay-700" />
      </div>

      <div className="w-full max-w-md mx-auto flex flex-col items-center mt-8 animate-fade-in">
        <div className="mb-6">
          <LifeOSLogo size={120} />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-center">Welcome to <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Life OS</span></h1>
        <p className="mt-3 text-base text-muted-foreground text-center max-w-xs leading-relaxed">
          Build the discipline. Reclaim your time. Live with intention.
        </p>
      </div>

      <div className="w-full max-w-md mx-auto grid grid-cols-1 gap-3 my-8">
        <FeatureRow icon={<Sunrise className="h-5 w-5" />} title="Rise" desc="Wake up on time, every time." />
        <FeatureRow icon={<ShieldIcon className="h-5 w-5" />} title="Shield" desc="Block distractions, build focus." />
        <FeatureRow icon={<Target className="h-5 w-5" />} title="Goals" desc="Track progress, hit milestones." />
      </div>

      <div className="w-full max-w-md mx-auto space-y-3">
        <Button
          onClick={() => { localStorage.setItem('hasSeenWelcome', '1'); navigate('/auth'); }}
          className="w-full h-14 rounded-2xl text-base font-bold shadow-lg"
        >
          Get Started
        </Button>
        <Button
          variant="ghost"
          onClick={() => { localStorage.setItem('hasSeenWelcome', '1'); navigate('/auth'); }}
          className="w-full h-12 rounded-2xl text-sm font-medium text-muted-foreground"
        >
          I already have an account
        </Button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/60 border border-border/40 backdrop-blur-sm">
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="font-bold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  );
}
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UpgradePromptProps {
  feature: string;
  requiredPlan?: 'premium' | 'ultimate';
}

export default function UpgradePrompt({ feature, requiredPlan = 'premium' }: UpgradePromptProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-6 flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-bold text-foreground mb-1">{feature}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This feature requires the {requiredPlan === 'ultimate' ? 'Ultimate' : 'Premium'} plan
        </p>
        <Button asChild>
          <Link to="/premium" className="gap-2">
            <Crown className="h-4 w-4" />
            Upgrade Now
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

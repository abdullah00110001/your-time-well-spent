import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, UserPlus, MessageCircle, Trophy, Flame, Copy, Check, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Partner {
  id: string;
  name: string;
  avatar?: string;
  streak: number;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
}

export function AccountabilityPartners() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    if (user) {
      generateInviteCode();
      loadPartners();
    }
  }, [user]);

  const generateInviteCode = () => {
    if (!user) return;
    // Generate a simple invite code based on user ID
    const code = `YT-${user.id.slice(0, 8).toUpperCase()}`;
    setInviteCode(code);
  };

  const loadPartners = async () => {
    // For now, show demo data - in production this would fetch from a partners table
    setPartners([]);
    setIsLoading(false);
  };

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success('Invite code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    // In production, this would send an email invitation
    toast.success(`Invite sent to ${inviteEmail}!`);
    setInviteEmail('');
    setShowInviteDialog(false);
  };

  const shareInvite = () => {
    const message = `Join me on Life OS for accountability!\n\nUse my invite code: ${inviteCode}\n\nDownload the app and let's grow together! 🌱`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Accountability Partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Accountability Partners
        </CardTitle>
        <CardDescription>
          Partner up with friends for mutual motivation and support
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {partners.length > 0 ? (
          <div className="space-y-3">
            {partners.map(partner => (
              <div
                key={partner.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={partner.avatar} />
                    <AvatarFallback>{partner.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{partner.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span>{partner.streak} day streak</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={partner.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {partner.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <h4 className="font-medium mb-1">No Partners Yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Invite friends to become accountability partners
            </p>
          </div>
        )}

        {/* Invite Section */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invite a Partner
          </h4>
          
          <div className="space-y-3">
            {/* Invite Code */}
            <div className="flex items-center gap-2">
              <Input 
                value={inviteCode} 
                readOnly 
                className="font-mono text-center"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyInviteCode}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Invite Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite by Email</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      type="email"
                      placeholder="friend@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <Button onClick={sendInvite} className="w-full">
                      Send Invite
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline"
                onClick={shareInvite}
                className="w-full"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </Button>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-xs text-muted-foreground">Shared Goals</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <MessageCircle className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-muted-foreground">Encouragement</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-xs text-muted-foreground">Streak Buddies</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

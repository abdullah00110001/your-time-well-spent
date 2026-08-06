import { useState, useEffect } from 'react';
import { Shield as ShieldIcon, ShieldAlert, Power } from 'lucide-react';
import { ShieldModes } from '@/components/shield/ShieldModes';
import { ShieldBlocking } from '@/components/shield/ShieldBlocking';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';
import { isNative } from '@/lib/capacitor/platform';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Shield() {
  const [isShieldActive, setIsShieldActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ১. নেটিভ সিস্টেম থেকে শিল্ডের বর্তমান স্ট্যাটাস আনা
  useEffect(() => {
    checkShieldStatus();
  }, []);

  const checkShieldStatus = async () => {
    if (!isNative) {
      setIsLoading(false);
      return;
    }
    try {
      const status = await ShieldPlugin.isEnabled();
      setIsShieldActive(status.enabled);
    } catch (error) {
      console.error("Failed to fetch shield status", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ২. মাস্টার সুইচ কন্ট্রোল (পুরো শিল্ড অন বা অফ করা)
  const toggleMasterShield = async () => {
    try {
      if (isShieldActive) {
        // স্ট্রিক্ট মোড অন থাকলে নেটিভ থেকে এরর আসবে এবং Catch ব্লকে চলে যাবে
        await ShieldPlugin.disable();
        setIsShieldActive(false);
        toast.info("Shield deactivated successfully");
      } else {
        await ShieldPlugin.enable();
        setIsShieldActive(true);
        toast.success("Shield activated securely");
      }
    } catch (error: any) {
      // যদি স্ট্রিক্ট মোড অন থাকে, তবে ইউজারকে আটকে দেওয়া হবে
      toast.error(error || "Cannot disable Shield during Strict Mode!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white/40">
        <ShieldIcon className="h-10 w-10 animate-pulse mb-4 text-indigo-500/50" />
        <p>Loading Shield Core...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      
      {/* 🛡️ Header & Master Switch */}
      <div className="pt-14 pb-6 px-6 bg-slate-900/50 border-b border-white/5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${isShieldActive ? 'bg-indigo-500/20' : 'bg-rose-500/20'}`}>
              {isShieldActive ? (
                <ShieldIcon className="h-7 w-7 text-indigo-400" />
              ) : (
                <ShieldAlert className="h-7 w-7 text-rose-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">LifeOS Shield</h1>
              <p className="text-xs font-medium mt-1">
                {isShieldActive ? (
                  <span className="text-indigo-400">● Protection Active</span>
                ) : (
                  <span className="text-rose-400">● System Vulnerable</span>
                )}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleMasterShield}
            className={`h-14 w-14 rounded-full border-2 transition-all ${
              isShieldActive 
                ? 'border-indigo-500 text-indigo-400 hover:bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                : 'border-rose-500 text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            <Power className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* 🧩 Shield Modules */}
      <div className="p-6 space-y-8">
        <ShieldModes />
        <div className="h-px w-full bg-white/5" /> {/* Divider */}
        <ShieldBlocking />
      </div>

    </div>
  );
}

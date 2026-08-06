import { useState, useEffect, useRef } from 'react';
import { Activity, Smartphone, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
// সেন্সরের জন্য ক্যাপাসিটর মোশন প্লাগিন
import { Motion } from '@capacitor/motion';
import { isNative } from '@/lib/capacitor/platform';

interface ShakeMissionProps {
  onComplete: () => void;
  requiredShakes?: number; // ডিফল্ট ৩০ বার ঝাঁকাতে হবে
}

export function ShakeMission({ onComplete, requiredShakes = 30 }: ShakeMissionProps) {
  const [shakeCount, setShakeCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // ডাবল কাউন্ট রোধ করার জন্য টাইম ট্র্যাকার
  const lastShakeTime = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    const setupMotionListener = async () => {
      if (!isNative) {
        toast.info("Web browser detected. Click the button to simulate shakes.");
        return;
      }

      try {
        // মোশন লিসেনার অ্যাড করা
        await Motion.addListener('accel', (event) => {
          if (!isMounted || isFinished) return;

          // X, Y, Z অক্ষের এক্সিলারেশন মাপা
          const { x, y, z } = event.acceleration;
          
          // ভেক্টর ম্যাগনিটিউড বের করা (কত জোরে ঝাঁকানো হয়েছে)
          const acceleration = Math.sqrt(x * x + y * y + z * z);
          
          // থ্রেশোল্ড (Threshold): ১৫ এর বেশি হলে সেটাকে 'জোরে ঝাঁকানো' ধরা হবে
          if (acceleration > 15) {
            const now = Date.now();
            // এক ঝাঁকুনির পর অন্তত ৩০০ মিলি-সেকেন্ড গ্যাপ থাকতে হবে
            if (now - lastShakeTime.current > 300) {
              lastShakeTime.current = now;
              
              setShakeCount((prev) => {
                const newCount = prev + 1;
                if (newCount >= requiredShakes) {
                  handleComplete();
                }
                return newCount;
              });
            }
          }
        });
      } catch (error) {
        console.error("Failed to start motion listener:", error);
        toast.error("Motion sensor not available!");
      }
    };

    setupMotionListener();

    // কম্পোনেন্ট আনমাউন্ট হলে লিসেনার মুছে ফেলা (যাতে ব্যাটারি নষ্ট না হয়)
    return () => {
      isMounted = false;
      Motion.removeAllListeners();
    };
  }, [isFinished, requiredShakes]);

  const handleComplete = () => {
    setIsFinished(true);
    toast.success("Wake up successful!");
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  // ব্রাউজারে টেস্ট করার জন্য বা সেন্সর নষ্ট থাকলে ব্যাকআপ বাটন
  const simulateShake = () => {
    setShakeCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= requiredShakes) {
        handleComplete();
      }
      return newCount;
    });
  };

  // প্রোগ্রেস বারের ক্যালকুলেশন
  const progressPercentage = Math.min((shakeCount / requiredShakes) * 100, 100);
  const circleRadius = 90;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (progressPercentage / 100) * circleCircumference;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-6">
      
      {/* 📱 Header */}
      <div className="flex items-center justify-between mb-10 mt-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 rounded-2xl">
            <Activity className="h-6 w-6 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold">Shake Mission</h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-12 text-center">
        
        <div>
          <h3 className="text-3xl font-black mb-2 tracking-wide">SHAKE IT!</h3>
          <p className="text-white/50 font-medium">
            Shake your phone vigorously to wake up your brain.
          </p>
        </div>

        {/* ⭕ Visual Progress Ring */}
        <div className="relative flex items-center justify-center">
          <svg className="w-64 h-64 transform -rotate-90">
            {/* Background Circle */}
            <circle
              cx="128"
              cy="128"
              r={circleRadius}
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-white/5"
            />
            {/* Progress Circle */}
            <circle
              cx="128"
              cy="128"
              r={circleRadius}
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={circleCircumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-cyan-500 transition-all duration-300 ease-out"
            />
          </svg>
          
          <div className="absolute flex flex-col items-center justify-center">
            <Smartphone className={`h-16 w-16 mb-2 text-white transition-transform ${shakeCount % 2 === 0 ? 'rotate-12' : '-rotate-12'}`} />
            <span className="text-4xl font-black text-white">
              {shakeCount}
            </span>
            <span className="text-xs text-white/40 uppercase font-bold tracking-widest mt-1">
              / {requiredShakes}
            </span>
          </div>
        </div>

        {/* ⚠️ Fallback for Web/Emulator */}
        {!isNative && (
          <Button 
            onClick={simulateShake}
            variant="outline"
            className="mt-8 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 rounded-xl"
          >
            Simulate Shake (Web Only)
          </Button>
        )}
      </div>

    </div>
  );
}

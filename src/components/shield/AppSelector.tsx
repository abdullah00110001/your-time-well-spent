import { useState, useEffect } from 'react';
import { Search, X, Check, Smartphone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentBlockedApps: string[]; // আগে থেকে কোনগুলো ব্লক করা আছে
  onSave: (selectedApps: string[]) => void;
}

// ডেমো অ্যাপ লিস্ট (সাধারণত যেগুলো মানুষ ব্লক করতে চায়)
const COMMON_APPS = [
  { id: 'com.facebook.katana', name: 'Facebook' },
  { id: 'com.instagram.android', name: 'Instagram' },
  { id: 'com.zhiliaoapp.musically', name: 'TikTok' },
  { id: 'com.google.android.youtube', name: 'YouTube' },
  { id: 'com.whatsapp', name: 'WhatsApp' },
  { id: 'com.snapchat.android', name: 'Snapchat' },
  { id: 'com.twitter.android', name: 'X (Twitter)' },
  { id: 'com.netflix.mediaclient', name: 'Netflix' },
  { id: 'com.tencent.ig', name: 'PUBG Mobile' },
  { id: 'com.dts.freefireth', name: 'Free Fire' },
];

export function AppSelector({ isOpen, onClose, currentBlockedApps, onSave }: AppSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());

  // যখনই মডাল ওপেন হবে, আগে থেকে ব্লক করা অ্যাপগুলো সিলেক্টেড দেখাবে
  useEffect(() => {
    if (isOpen) {
      setSelectedApps(new Set(currentBlockedApps));
      setSearchQuery('');
    }
  }, [isOpen, currentBlockedApps]);

  const toggleAppSelection = (appId: string) => {
    const newSelection = new Set(selectedApps);
    if (newSelection.has(appId)) {
      newSelection.delete(appId);
    } else {
      newSelection.add(appId);
    }
    setSelectedApps(newSelection);
  };

  const handleSave = () => {
    onSave(Array.from(selectedApps));
    onClose();
  };

  // সার্চ লজিক
  const filteredApps = COMMON_APPS.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white animate-in slide-in-from-bottom-full duration-300">
      
      {/* 🏷️ Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60 hover:text-white">
            <X className="h-6 w-6" />
          </Button>
          <h2 className="text-xl font-bold">Select Apps to Block</h2>
        </div>
        <div className="text-sm font-medium px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full">
          {selectedApps.size} Selected
        </div>
      </div>

      {/* 🔍 Search Bar */}
      <div className="p-4 bg-slate-900/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* 📱 App List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/30">
            <ShieldAlert className="h-8 w-8 mb-2 opacity-50" />
            <p>No apps found matching "{searchQuery}"</p>
          </div>
        ) : (
          filteredApps.map((app) => {
            const isSelected = selectedApps.has(app.id);
            return (
              <div 
                key={app.id}
                onClick={() => toggleAppSelection(app.id)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-500/10 border-indigo-500/50' 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-white/60'}`}>
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <span className="text-lg font-medium">{app.name}</span>
                </div>
                
                {/* Custom Checkbox */}
                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-500' 
                    : 'border-white/20'
                }`}>
                  {isSelected && <Check className="h-4 w-4 text-white" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 💾 Save Button Footer */}
      <div className="p-6 bg-slate-900 border-t border-white/10">
        <Button 
          onClick={handleSave}
          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-lg font-semibold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all"
        >
          Confirm {selectedApps.size > 0 ? `(${selectedApps.size})` : ''}
        </Button>
      </div>

    </div>
  );
}

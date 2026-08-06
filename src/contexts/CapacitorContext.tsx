import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useCapacitor } from '@/hooks/useCapacitor';
import { isNative, isAndroid } from '@/lib/capacitor/platform';

interface CapacitorContextType {
  isNative: boolean;
  isAndroid: boolean;
  isInitialized: boolean;
  deviceInfo: any;
  pushToken: string | null;
}

const CapacitorContext = createContext<CapacitorContextType>({
  isNative: false,
  isAndroid: false,
  isInitialized: false,
  deviceInfo: null,
  pushToken: null
});

export const useCapacitorContext = () => useContext(CapacitorContext);

interface CapacitorProviderProps {
  children: ReactNode;
}

export function CapacitorProvider({ children }: CapacitorProviderProps) {
  const capacitorState = useCapacitor();
  
  // Don't block rendering - always show children
  // The loading state is handled by individual components that need native features
  return (
    <CapacitorContext.Provider value={capacitorState}>
      {children}
    </CapacitorContext.Provider>
  );
}

// Hook to check if running as installed app (PWA or native)
export function useInstalledApp() {
  const { isNative } = useCapacitorContext();
  const [isInstalled, setIsInstalled] = useState(false);
  
  useEffect(() => {
    const isPwaInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                           (window.navigator as any).standalone === true;
    
    setIsInstalled(isNative || isPwaInstalled);
  }, [isNative]);
  
  return { isInstalled, isNative };
}

// Hook for safe area insets (for notch devices)
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });
  
  useEffect(() => {
    const computeInsets = () => {
      const style = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(style.getPropertyValue('--sat') || '0') || 0,
        bottom: parseInt(style.getPropertyValue('--sab') || '0') || 0,
        left: parseInt(style.getPropertyValue('--sal') || '0') || 0,
        right: parseInt(style.getPropertyValue('--sar') || '0') || 0,
      });
    };
    
    computeInsets();
    window.addEventListener('resize', computeInsets);
    return () => window.removeEventListener('resize', computeInsets);
  }, []);
  
  return insets;
}

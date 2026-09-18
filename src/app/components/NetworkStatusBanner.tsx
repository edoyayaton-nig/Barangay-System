import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCcw, Wifi } from 'lucide-react';
import { toast } from 'sonner';

export default function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Internet Disconnected', {
        description: 'You are currently offline. Changes will sync once connection is restored.'
      });
    };

    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Internet Reconnected', {
        description: 'Your connection has been restored. Live sync is active.'
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between sticky top-0 z-50 border-b border-amber-600 animate-in fade-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-center text-center">
        <WifiOff size={15} className="text-slate-950 shrink-0" />
        <span>
          <strong>Offline Mode:</strong> Internet connection lost. Form submissions and live records will sync automatically once reconnected.
        </span>
      </div>
    </div>
  );
}

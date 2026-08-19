/**
 * useConnectionStatus hook
 * Monitors navigator.onLine and provides live status.
 */
import { useState, useEffect } from 'react';

export type ConnectionStatus = 'online' | 'offline' | 'connecting';

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(navigator.onLine ? 'online' : 'offline');
  const [synced, setSynced] = useState(true);

  useEffect(() => {
    const handleOnline = () => {
      setStatus('connecting');
      setSynced(false);
      setTimeout(() => {
        setStatus('online');
        setTimeout(() => setSynced(true), 2000);
      }, 800);
    };
    const handleOffline = () => { setStatus('offline'); setSynced(false); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { status, synced, isOnline: status === 'online' || status === 'connecting' };
}

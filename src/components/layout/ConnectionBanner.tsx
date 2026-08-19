import { useConnectionStatus } from '@/hooks/useConnectionStatus';

export function ConnectionBanner() {
  const { status, synced } = useConnectionStatus();

  if (status === 'online' && synced) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] text-center text-sm py-2 font-medium transition-all duration-300 ${
        status === 'offline'
          ? 'bg-red-600/90 text-white'
          : status === 'connecting'
          ? 'bg-yellow-500/90 text-black'
          : 'bg-green-600/90 text-white'
      }`}
    >
      {status === 'offline' && (
        <span>🔴 You're offline. Messages will send when you're back online.</span>
      )}
      {status === 'connecting' && (
        <span>🟡 Back online — syncing your messages...</span>
      )}
      {status === 'online' && !synced && (
        <span>🟢 Everything is synced ✓</span>
      )}
    </div>
  );
}

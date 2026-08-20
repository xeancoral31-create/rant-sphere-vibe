/**
 * useLiveLocation hook
 * Manages browser geolocation watchPosition, updates Supabase session,
 * and handles the offline location queue.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { updateLiveLocation, stopLiveLocation } from '@/lib/friends-api';
import { enqueueLocation, getQueuedLocations, deleteQueuedLocation } from '@/lib/offline-queue';

export type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export type LiveSessionState = {
  sessionId: string;
  conversationId: string;
  expiresAt: Date | null;
  startedAt: Date;
};

export function useLiveLocation() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [session, setSession] = useState<LiveSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const watchRef = useRef<number | null>(null);
  const sessionRef = useRef<LiveSessionState | null>(null);

  useEffect(() => { sessionRef.current = session; }, [session]);

  // Flush offline location queue when back online
  useEffect(() => {
    const onOnline = async () => {
      const queued = await getQueuedLocations();
      for (const ql of queued) {
        try {
          await updateLiveLocation({
            sessionId: ql.session_id,
            latitude: ql.latitude,
            longitude: ql.longitude,
            accuracy: ql.accuracy,
          });
          await deleteQueuedLocation(ql.id);
        } catch {
          // Will retry next reconnect
        }
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const startWatching = useCallback((sess: LiveSessionState) => {
    setSession(sess);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc: LocationState = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setLocation(loc);
        setError(null);

        const currentSession = sessionRef.current;
        if (!currentSession) return;

        // Check expiry
        if (currentSession.expiresAt && new Date() > currentSession.expiresAt) {
          await stopWatching();
          return;
        }

        if (navigator.onLine) {
          try {
            await updateLiveLocation({
              sessionId: currentSession.sessionId,
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              heading: loc.heading,
              speed: loc.speed,
            });
          } catch {
            // Queue it
          }
        } else {
          await enqueueLocation({
            id: `${currentSession.sessionId}-${loc.timestamp}`,
            session_id: currentSession.sessionId,
            conversation_id: currentSession.conversationId,
            user_id: '',
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            is_live: true,
            queued_at: Date.now(),
          });
        }
      },
      (err) => {
        if (err.code === 1) setPermissionDenied(true);
        setError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

  const stopWatching = useCallback(async () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    const currentSession = sessionRef.current;
    if (currentSession) {
      await stopLiveLocation(currentSession.sessionId, currentSession.conversationId, '');
    }
    setSession(null);
  }, []);

  const getCurrentPosition = useCallback((): Promise<LocationState> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: LocationState = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          };
          setLocation(loc);
          resolve(loc);
        },
        (err) => {
          if (err.code === 1) setPermissionDenied(true);
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  return { location, session, error, permissionDenied, startWatching, stopWatching, getCurrentPosition };
}

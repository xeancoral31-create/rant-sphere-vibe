import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type SignalingEvent = {
  type: 'call-offer' | 'call-answer' | 'ice-candidate' | 'call-end' | 'call-decline';
  callerId: string;
  receiverId: string;
  callType?: 'voice' | 'video';
  payload?: any;
};

export function useSignaling(userId: string | undefined) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const onEventRef = useRef<((event: SignalingEvent) => void) | null>(null);

  useEffect(() => {
    if (!userId) return;

    // We use a broadcast channel for the specific user
    const ch = supabase.channel(`signaling:${userId}`, {
      config: {
        broadcast: {
          ack: false,
        },
      },
    });

    ch.on(
      'broadcast',
      { event: 'signaling-event' },
      (payload) => {
        if (onEventRef.current) {
          onEventRef.current(payload.payload as SignalingEvent);
        }
      }
    ).subscribe();

    setChannel(ch);

    return () => {
      ch.unsubscribe();
    };
  }, [userId]);

  const sendSignalingEvent = useCallback(
    async (receiverId: string, event: SignalingEvent) => {
      if (!userId) return;

      // Send to the receiver's personal signaling channel
      const ch = supabase.channel(`signaling:${receiverId}`);
      await ch.subscribe();
      
      await ch.send({
        type: 'broadcast',
        event: 'signaling-event',
        payload: event,
      });

      ch.unsubscribe();
    },
    [userId]
  );

  const onSignalingEvent = useCallback((cb: (event: SignalingEvent) => void) => {
    onEventRef.current = cb;
  }, []);

  return {
    sendSignalingEvent,
    onSignalingEvent,
  };
}

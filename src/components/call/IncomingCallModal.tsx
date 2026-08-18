import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phone, Video, X } from 'lucide-react';

interface IncomingCallModalProps {
  callerId: string;
  callType: 'voice' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ callerId, callType, onAccept, onDecline }: IncomingCallModalProps) {
  const [callerProfile, setCallerProfile] = useState<any>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', callerId)
      .single()
      .then(({ data }) => setCallerProfile(data));
  }, [callerId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl border border-border/50 animate-in zoom-in-95 duration-200">
        
        <div className="w-24 h-24 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold text-3xl mb-4 overflow-hidden ring-4 ring-background shadow-xl">
          {callerProfile?.avatar_url ? (
            <img src={callerProfile.avatar_url} className="w-full h-full object-cover" />
          ) : (
            callerProfile?.username?.[0]?.toUpperCase() ?? "?"
          )}
        </div>

        <h3 className="font-display font-bold text-2xl mb-1">
          {callerProfile?.display_name || callerProfile?.username || 'Someone'}
        </h3>
        <p className="text-muted-foreground mb-8">
          Incoming {callType} call...
        </p>

        <div className="flex items-center gap-6 w-full justify-center">
          <button 
            onClick={onDecline}
            className="w-14 h-14 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors grid place-items-center"
          >
            <X className="w-6 h-6" />
          </button>
          
          <button 
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors grid place-items-center shadow-lg shadow-green-500/20 animate-pulse"
          >
            {callType === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}

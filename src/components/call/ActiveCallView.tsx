import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video as VideoIcon, VideoOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveCallViewProps {
  callState: 'calling' | 'connected';
  callType: 'voice' | 'video';
  remoteUser: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEndCall: () => void;
}

export function ActiveCallView({ callState, callType, remoteUser, localStream, remoteStream, onEndCall }: ActiveCallViewProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (remoteUser) {
      supabase.from('profiles').select('username, display_name, avatar_url').eq('id', remoteUser).single()
        .then(({ data }) => setProfile(data));
    }
  }, [remoteUser]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col animate-in slide-in-from-bottom duration-300">
      
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {callType === 'video' && remoteStream ? (
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-white/10 grid place-items-center text-5xl font-bold mb-6 overflow-hidden">
              {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.username?.[0]?.toUpperCase() ?? "?"}
            </div>
            <h2 className="text-3xl font-display font-bold">{profile?.display_name || profile?.username || 'Calling...'}</h2>
            <p className="text-white/60 mt-2">{callState === 'calling' ? 'Calling...' : 'Connected'}</p>
          </div>
        )}

        {/* Local Video (PiP) */}
        {callType === 'video' && !isVideoOff && localStream && (
          <div className="absolute top-6 right-6 w-32 md:w-48 aspect-[3/4] bg-black/50 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-32 bg-gradient-to-t from-black to-transparent flex items-center justify-center gap-6 pb-6">
        <button 
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-white'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        
        {callType === 'video' && (
          <button 
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-white'}`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
          </button>
        )}

        <button 
          onClick={onEndCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-500/20"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}

import { createContext, useContext, ReactNode } from 'react';
import { useWebRTC, CallState, CallType } from '@/hooks/useWebRTC';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { IncomingCallModal } from './IncomingCallModal';
import { ActiveCallView } from './ActiveCallView';

interface CallContextType {
  callState: CallState;
  callType: CallType;
  remoteUser: string | null;
  initiateCall: (receiverId: string, type: CallType) => void;
  acceptCall: (callerId: string, type: CallType, offer: any) => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const webrtc = useWebRTC(user?.id);

  return (
    <CallContext.Provider value={webrtc}>
      {children}
      
      {webrtc.callState === 'ringing' && webrtc.remoteUser && (
        <IncomingCallModal 
          callerId={webrtc.remoteUser}
          callType={webrtc.callType}
          onAccept={() => webrtc.acceptCall(webrtc.remoteUser!, webrtc.callType, webrtc.getPendingOffer())}
          onDecline={() => {
            // webrtc hook automatically handles declining when endCall is triggered 
            // if we send a signaling event, but let's just use endCall
            webrtc.endCall();
          }}
        />
      )}

      {(webrtc.callState === 'calling' || webrtc.callState === 'connected') && (
        <ActiveCallView 
          callState={webrtc.callState}
          callType={webrtc.callType}
          remoteUser={webrtc.remoteUser}
          localStream={webrtc.localStream}
          remoteStream={webrtc.remoteStream}
          onEndCall={webrtc.endCall}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCallContext() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within CallProvider');
  }
  return context;
}

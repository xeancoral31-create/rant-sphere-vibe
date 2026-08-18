import { useCallback, useRef, useState } from 'react';
import { useSignaling, SignalingEvent } from './useSignaling';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
};

export function useWebRTC(userId: string | undefined) {
  const { sendSignalingEvent, onSignalingEvent } = useSignaling(userId);
  
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('voice');
  const [remoteUser, setRemoteUser] = useState<string | null>(null);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [localStreamObj, setLocalStreamObj] = useState<MediaStream | null>(null);
  const [remoteStreamObj, setRemoteStreamObj] = useState<MediaStream | null>(null);

  // Initialize peer connection
  const initPeerConnection = useCallback((receiverId: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Listen for remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteStreamRef.current = remoteStream;
      setRemoteStreamObj(remoteStream);
    };

    // Send ICE candidates to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingEvent(receiverId, {
          type: 'ice-candidate',
          callerId: userId!,
          receiverId,
          payload: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        endCall();
      }
    };

    return pc;
  }, [userId, sendSignalingEvent]);

  // Request media permissions and stream
  const getMedia = useCallback(async (type: CallType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStreamObj(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
      throw error;
    }
  }, []);

  const initiateCall = useCallback(async (receiverId: string, type: CallType) => {
    try {
      await getMedia(type);
      setCallType(type);
      setRemoteUser(receiverId);
      setCallState('calling');

      const pc = initPeerConnection(receiverId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignalingEvent(receiverId, {
        type: 'call-offer',
        callerId: userId!,
        receiverId,
        callType: type,
        payload: offer,
      });
    } catch (e) {
      setCallState('idle');
    }
  }, [getMedia, initPeerConnection, sendSignalingEvent, userId]);

  const acceptCall = useCallback(async (callerId: string, type: CallType, offer: RTCSessionDescriptionInit) => {
    try {
      await getMedia(type);
      setCallType(type);
      setRemoteUser(callerId);
      setCallState('connected');

      const pc = initPeerConnection(callerId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignalingEvent(callerId, {
        type: 'call-answer',
        callerId: userId!,
        receiverId: callerId,
        payload: answer,
      });
    } catch (e) {
      endCall();
    }
  }, [getMedia, initPeerConnection, sendSignalingEvent, userId]);

  const endCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStreamObj(null);
    setRemoteStreamObj(null);
    
    if (remoteUser) {
      sendSignalingEvent(remoteUser, {
        type: 'call-end',
        callerId: userId!,
        receiverId: remoteUser,
      }).catch(() => {});
    }

    setCallState('idle');
    setRemoteUser(null);
  }, [remoteUser, sendSignalingEvent, userId]);

  // Handle incoming signaling events
  onSignalingEvent(async (event) => {
    switch (event.type) {
      case 'call-offer':
        if (callState !== 'idle') {
          // Busy
          sendSignalingEvent(event.callerId, {
            type: 'call-decline',
            callerId: userId!,
            receiverId: event.callerId,
          });
          return;
        }
        setCallType(event.callType || 'voice');
        setRemoteUser(event.callerId);
        setCallState('ringing');
        // Store offer temporarily until accepted
        (window as any)._pendingOffer = event.payload;
        break;
      case 'call-answer':
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(event.payload));
        }
        break;
      case 'ice-candidate':
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(event.payload));
        }
        break;
      case 'call-decline':
      case 'call-end':
        endCall();
        break;
    }
  });

  return {
    callState,
    callType,
    remoteUser,
    localStream: localStreamObj,
    remoteStream: remoteStreamObj,
    initiateCall,
    acceptCall,
    endCall,
    getPendingOffer: () => (window as any)._pendingOffer,
  };
}

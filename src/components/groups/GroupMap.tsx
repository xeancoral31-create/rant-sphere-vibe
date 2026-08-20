import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MapPin, Navigation, Radio, EyeOff, ShieldAlert, Phone, Check, X, Clock, RefreshCw } from "lucide-react";
import { enqueueLocation } from "@/lib/offline-queue";

interface MemberLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  is_live: boolean;
  last_updated: string;
  expires_at?: string | null;
  profile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface GroupMapProps {
  groupId: string;
  groupName: string;
  members: any[];
}

export function GroupMap({ groupId, groupName, members }: GroupMapProps) {
  const { user } = useAuthContext();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const [locations, setLocations] = useState<MemberLocation[]>([]);
  const [sharingSession, setSharingSession] = useState<MemberLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Location Dialog State
  const [showLiveDialog, setShowLiveDialog] = useState(false);
  const [liveDuration, setLiveDuration] = useState<number | null>(60); // default 1 hour in minutes

  // Current Location Preview State
  const [currentLocPreview, setCurrentLocPreview] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
  } | null>(null);

  // Emergency SMS / Location Dialog
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyMessage, setEmergencyMessage] = useState("");

  const mapKey = import.meta.env.VITE_MAPTILER_API_KEY;

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!mapKey) {
      setError("MapTiler API Key is missing");
      setLoading(false);
      return;
    }

    try {
      const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapKey}`;
      const inst = new maplibregl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: [120.9842, 14.5995], // Default Manila coordinates
        zoom: 12,
      });

      inst.addControl(new maplibregl.NavigationControl(), "top-right");
      map.current = inst;
      setLoading(false);
    } catch (e: any) {
      setError(e.message || "Failed to load MapTiler map");
      setLoading(false);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapKey]);

  // Load Group Member Locations
  useEffect(() => {
    loadLocations();

    const channel = supabase
      .channel(`group-locs-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "location_sharing_sessions",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  async function loadLocations() {
    try {
      const { data, error: fetchErr } = await (supabase.from("location_sharing_sessions") as any)
        .select("*, profile:profiles(username, display_name, avatar_url)")
        .eq("group_id", groupId);

      if (fetchErr) throw fetchErr;

      const validSessions = (data ?? []).filter((s: MemberLocation) => {
        if (!s.is_live && s.expires_at && new Date(s.expires_at) < new Date()) {
          return false;
        }
        return true;
      });

      setLocations(validSessions);

      // Check if current user is actively sharing
      const mySession = validSessions.find((s: MemberLocation) => s.user_id === user?.id);
      setSharingSession(mySession || null);

      // Update Markers on Map
      updateMarkers(validSessions);
    } catch (e) {
      console.error("Error loading location sessions:", e);
    }
  }

  function updateMarkers(locs: MemberLocation[]) {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();

    locs.forEach((loc) => {
      const el = document.createElement("div");
      el.className = "relative group cursor-pointer";

      const isMe = loc.user_id === user?.id;
      const initial = loc.profile?.username?.[0]?.toUpperCase() || "U";
      const name = loc.profile?.display_name || loc.profile?.username || "Member";

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 rounded-full border-2 ${
            isMe ? "border-primary ring-4 ring-primary/30" : "border-emerald-400"
          } bg-gradient-vivid overflow-hidden shadow-glow grid place-items-center text-white text-xs font-bold">
            ${
              loc.profile?.avatar_url
                ? `<img src="${loc.profile.avatar_url}" class="w-full h-full object-cover"/>`
                : initial
            }
          </div>
          <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ${
            loc.is_live ? "bg-emerald-400 animate-ping" : "bg-muted-foreground"
          } border-2 border-background"></span>
        </div>
      `;

      const popupHtml = `
        <div class="p-2 text-xs font-sans text-foreground">
          <div class="font-bold text-sm">${name} ${isMe ? "(You)" : ""}</div>
          <div class="text-muted-foreground">📍 Updated ${formatDistanceToNow(new Date(loc.last_updated), { addSuffix: true })}</div>
          <div class="mt-1 flex items-center gap-1 font-semibold ${loc.is_live ? "text-emerald-400" : "text-muted-foreground"}">
            <span class="w-2 h-2 rounded-full ${loc.is_live ? "bg-emerald-400" : "bg-muted-foreground"}"></span>
            ${loc.is_live ? "Live Location Active" : "Last Known Location"}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.set(loc.user_id, marker);
      bounds.extend([loc.longitude, loc.latitude]);
    });

    if (locs.length > 0) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }

  // Request Current Location & Preview
  function handleShareCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    toast.info("Requesting device location...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentLocPreview({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 10,
          timestamp: Date.now(),
        });

        // Fly map to location
        map.current?.flyTo({ center: [longitude, latitude], zoom: 15 });
        toast.success("Location obtained! Confirm sharing below.");
      },
      (err) => {
        toast.error(`Location permission denied or unavailable: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Confirm Current Location Share to Group
  async function confirmShareCurrentLocation() {
    if (!currentLocPreview || !user) return;

    const sessionPayload = {
      user_id: user.id,
      group_id: groupId,
      latitude: currentLocPreview.lat,
      longitude: currentLocPreview.lng,
      accuracy: currentLocPreview.accuracy,
      is_live: false,
      started_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      // Queue offline
      await enqueueLocation({
        id: `loc-${Date.now()}`,
        session_id: `session-${Date.now()}`,
        conversation_id: groupId,
        user_id: user.id,
        latitude: currentLocPreview.lat,
        longitude: currentLocPreview.lng,
        accuracy: currentLocPreview.accuracy,
        is_live: false,
        queued_at: Date.now(),
      });
      toast.info("Offline — Location update queued for sync");
      setCurrentLocPreview(null);
      return;
    }

    try {
      // Upsert location session
      await (supabase.from("location_sharing_sessions") as any).upsert(sessionPayload);

      // Post location message to group chat
      await (supabase.from("messages") as any).insert({
        conversation_id: groupId,
        sender_id: user.id,
        message_type: "location",
        content: `Shared location: ${currentLocPreview.lat.toFixed(4)}, ${currentLocPreview.lng.toFixed(4)}`,
        metadata: {
          latitude: currentLocPreview.lat,
          longitude: currentLocPreview.lng,
          accuracy: currentLocPreview.accuracy,
          timestamp: currentLocPreview.timestamp,
        },
      });

      toast.success("Current location shared with group!");
      setCurrentLocPreview(null);
      loadLocations();
    } catch (e: any) {
      toast.error(`Failed to share location: ${e.message}`);
    }
  }

  // Confirm Start Live Location Session
  async function confirmStartLiveLocation() {
    if (!user) return;

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported");
      return;
    }

    setShowLiveDialog(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const expiresAt = liveDuration ? new Date(Date.now() + liveDuration * 60 * 1000).toISOString() : null;

        const sessionPayload = {
          user_id: user.id,
          group_id: groupId,
          latitude,
          longitude,
          accuracy: accuracy || 10,
          is_live: true,
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
          last_updated: new Date().toISOString(),
        };

        await (supabase.from("location_sharing_sessions") as any).upsert(sessionPayload);

        // Send system notification message
        await (supabase.from("messages") as any).insert({
          conversation_id: groupId,
          sender_id: user.id,
          message_type: "live_location",
          content: `Started sharing live location (${liveDuration ? `${liveDuration} mins` : "until stopped"})`,
          metadata: { latitude, longitude, accuracy, is_live: true },
        });

        toast.success("Live location sharing enabled! 🟢");
        loadLocations();
      },
      (err) => {
        toast.error(`Could not get live location: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  }

  // Stop Live Location Session
  async function handleStopSharing() {
    if (!user) return;

    await (supabase.from("location_sharing_sessions") as any)
      .delete()
      .eq("user_id", user.id)
      .eq("group_id", groupId);

    await (supabase.from("messages") as any).insert({
      conversation_id: groupId,
      sender_id: user.id,
      message_type: "system",
      content: "Stopped sharing location",
    });

    toast.info("Location sharing disabled");
    setSharingSession(null);
    loadLocations();
  }

  // Trigger Emergency SMS & Location Sharing
  function handleEmergencyTrigger() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const body = `EMERGENCY ALERT: I need help! My live location is https://maps.google.com/?q=${latitude},${longitude} at ${new Date().toLocaleTimeString()}`;
        setEmergencyMessage(body);
        setShowEmergencyModal(true);
      },
      () => {
        const body = `EMERGENCY ALERT: I need help! Time: ${new Date().toLocaleTimeString()}`;
        setEmergencyMessage(body);
        setShowEmergencyModal(true);
      }
    );
  }

  function launchEmergencySMS() {
    if (!emergencyPhone.trim()) {
      toast.error("Please enter a contact phone number");
      return;
    }
    setShowEmergencyModal(false);
    const smsUrl = `sms:${encodeURIComponent(emergencyPhone.trim())}?body=${encodeURIComponent(emergencyMessage)}`;
    window.location.href = smsUrl;
    toast.success("Opening Emergency SMS app...");
  }

  return (
    <div className="relative w-full h-[550px] rounded-3xl overflow-hidden glass border border-white/10 shadow-2xl flex flex-col">
      {/* Map Header Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between p-3 rounded-2xl glass border border-white/15 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-sm text-foreground">{groupName} Map</h3>
            <p className="text-[11px] text-muted-foreground">
              {locations.length} members sharing location
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sharingSession ? (
            <button
              onClick={handleStopSharing}
              className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-semibold hover:bg-red-500/30 transition flex items-center gap-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" /> Stop Sharing
            </button>
          ) : (
            <>
              <button
                onClick={handleShareCurrentLocation}
                className="px-3 py-1.5 rounded-full glass hover:bg-card text-xs font-semibold text-foreground flex items-center gap-1.5 transition border border-white/10"
              >
                <Navigation className="w-3.5 h-3.5 text-primary" /> Share Location
              </button>
              <button
                onClick={() => setShowLiveDialog(true)}
                className="px-3 py-1.5 rounded-full bg-gradient-vivid text-white text-xs font-semibold shadow-glow hover:scale-105 transition flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Location
              </button>
            </>
          )}

          <button
            onClick={handleEmergencyTrigger}
            className="p-2 rounded-full bg-red-600/30 text-red-400 hover:bg-red-600 hover:text-white transition"
            title="Emergency SMS & Location Alert"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map View Area */}
      <div className="flex-1 w-full h-full relative">
        {loading && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-xs font-semibold text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span>Loading MapTiler Map...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-background/90 p-6 text-center">
            <div className="space-y-3 max-w-sm">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
              <h4 className="font-bold text-base text-foreground">Map Unavailable</h4>
              <p className="text-xs text-muted-foreground">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold"
              >
                Retry Map
              </button>
            </div>
          </div>
        ) : (
          <div ref={mapContainer} className="w-full h-full" />
        )}
      </div>

      {/* Current Location Preview Confirmation Modal */}
      {currentLocPreview && (
        <div className="absolute bottom-4 left-4 right-4 z-20 p-4 rounded-2xl glass border border-primary/40 shadow-2xl backdrop-blur-2xl animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              <span className="font-bold text-xs text-primary uppercase tracking-wider">Location Preview</span>
            </div>
            <button onClick={() => setCurrentLocPreview(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-foreground space-y-1">
            <div>📍 Coordinates: {currentLocPreview.lat.toFixed(5)}, {currentLocPreview.lng.toFixed(5)}</div>
            <div className="text-muted-foreground">Accuracy: ~{Math.round(currentLocPreview.accuracy)}m radius</div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={confirmShareCurrentLocation}
              className="flex-1 py-2 rounded-xl bg-gradient-vivid text-white text-xs font-bold shadow-glow hover:scale-102 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Send Location to Group
            </button>
            <button
              onClick={() => setCurrentLocPreview(null)}
              className="py-2 px-4 rounded-xl glass text-xs font-semibold text-muted-foreground hover:bg-card"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Live Location Confirmation Dialog */}
      {showLiveDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass rounded-3xl p-6 border border-white/15 max-w-sm w-full space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 grid place-items-center text-primary shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground">Share Live Location?</h4>
                <p className="text-xs text-muted-foreground">Select how long members can track your location.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "15 Minutes", minutes: 15 },
                { label: "1 Hour", minutes: 60 },
                { label: "8 Hours", minutes: 480 },
                { label: "Until Stopped", minutes: null },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setLiveDuration(opt.minutes)}
                  className={`p-3 rounded-xl text-xs font-semibold transition border ${
                    liveDuration === opt.minutes
                      ? "bg-primary/20 text-primary border-primary font-bold shadow-glow"
                      : "glass text-muted-foreground hover:bg-card"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={confirmStartLiveLocation}
                className="flex-1 py-2.5 rounded-xl bg-gradient-vivid text-white text-xs font-bold shadow-glow hover:scale-102 transition"
              >
                Confirm & Share
              </button>
              <button
                onClick={() => setShowLiveDialog(false)}
                className="py-2.5 px-4 rounded-xl glass text-xs font-semibold text-muted-foreground hover:bg-card"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency SMS Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass rounded-3xl p-6 border border-red-500/30 max-w-md w-full space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 grid place-items-center text-red-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Send Emergency Alert</h4>
                <p className="text-xs text-muted-foreground">Normal carrier SMS charges may apply.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Recipient Phone Number</label>
                <input
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+63 917 123 4567"
                  className="mt-1 w-full rounded-xl bg-card border border-border/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Emergency Message Preview</label>
                <textarea
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl bg-card border border-border/40 p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-red-500 resize-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2 rounded-xl glass text-xs font-semibold text-muted-foreground hover:bg-card"
              >
                Cancel
              </button>
              <button
                onClick={launchEmergencySMS}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> Launch Emergency SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

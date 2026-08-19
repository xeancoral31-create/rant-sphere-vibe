import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getActiveLocations } from "@/lib/barkada-api";
import { ChevronLeft, Navigation, MapPin, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/groups/$groupId/map")({ component: GroupMapPage });

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY as string;

function GroupMapPage() {
  const { groupId } = Route.useParams();
  const { user } = useAuthContext();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load MapLibre GL JS dynamically
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      try {
        if (!mapContainer.current) return;
        if (!MAPTILER_KEY) {
          setMapError("MapTiler API key not configured.");
          return;
        }

        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css" as any);

        if (!isMounted || !mapContainer.current) return;

        const map = new maplibre.Map({
          container: mapContainer.current,
          style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
          center: [121.0, 14.6], // Philippines default
          zoom: 11,
        });

        map.on("load", () => {
          if (isMounted) { mapRef.current = map; setMapLoaded(true); }
        });

        map.on("error", (e) => {
          if (isMounted) setMapError("Failed to load map tiles.");
        });
      } catch (err: any) {
        if (isMounted) setMapError("Failed to initialize map: " + err.message);
      }
    }

    initMap();
    return () => { isMounted = false; mapRef.current?.remove(); };
  }, []);

  // Load locations
  useEffect(() => {
    if (user && groupId) {
      loadLocations();
    }
  }, [groupId, user?.id]);

  // Realtime location updates
  useEffect(() => {
    const ch = supabase
      .channel(`locations-${groupId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "location_sharing_sessions",
        filter: `conversation_id=eq.${groupId}`,
      }, () => {
        loadLocations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId]);

  // Update markers when locations change and map is ready
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      updateMarkers();
    }
  }, [locations, mapLoaded]);

  async function loadLocations() {
    try {
      const data = await getActiveLocations(groupId);
      setLocations(data);
    } catch (e: any) {
      console.error("Failed to load locations", e);
    } finally {
      setLoading(false);
    }
  }

  async function updateMarkers() {
    const maplibre = await import("maplibre-gl");
    const map = mapRef.current;
    if (!map) return;

    // Remove stale markers
    const activeIds = new Set(locations.map((l) => l.user_id));
    for (const [userId, marker] of markersRef.current.entries()) {
      if (!activeIds.has(userId)) {
        marker.remove();
        markersRef.current.delete(userId);
      }
    }

    const bounds: [[number, number], [number, number]] | null = locations.length > 0 ? [
      [
        Math.min(...locations.map((l) => l.longitude)) - 0.01,
        Math.min(...locations.map((l) => l.latitude)) - 0.01,
      ],
      [
        Math.max(...locations.map((l) => l.longitude)) + 0.01,
        Math.max(...locations.map((l) => l.latitude)) + 0.01,
      ],
    ] : null;

    for (const loc of locations) {
      const el = document.createElement("div");
      el.className = "group-map-marker";
      el.style.cssText = `
        display: flex; flex-direction: column; align-items: center; cursor: pointer;
        animation: markerPop 0.3s ease-out;
      `;
      const isLive = loc.is_live;
      const isMe = loc.user_id === user?.id;
      const profile = loc.profiles;
      const lastUpdated = formatDistanceToNow(new Date(loc.last_updated), { addSuffix: true });

      el.innerHTML = `
        <div style="
          background: ${isMe ? "linear-gradient(135deg, #8b5cf6, #ec4899)" : "linear-gradient(135deg, #1e1b4b, #312e81)"};
          border: 2px solid ${isLive ? "#22c55e" : "#8b5cf6"};
          border-radius: 12px; padding: 8px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          min-width: 120px; text-align: center; color: white; font-family: system-ui;
        ">
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px;">
            <div style="
              width: 28px; height: 28px; border-radius: 50%; overflow: hidden;
              background: linear-gradient(135deg, #8b5cf6, #ec4899);
              display: flex; align-items: center; justify-content: center;
              font-size: 12px; font-weight: bold;
            ">
              ${profile?.avatar_url
                ? `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit: cover;" />`
                : (profile?.username?.[0]?.toUpperCase() ?? "?")}
            </div>
            <span style="font-size: 12px; font-weight: 600;">${profile?.display_name || profile?.username || "User"}</span>
          </div>
          <div style="font-size: 10px; opacity: 0.8; display: flex; align-items: center; gap: 4px; justify-content: center;">
            ${isLive ? '<span style="color:#22c55e;">🟢 Live</span>' : '<span style="color:#9ca3af;">📍</span>'}
            ${lastUpdated}
          </div>
          ${isMe ? '<div style="font-size: 10px; color: #a78bfa; margin-top: 2px;">You</div>' : ""}
        </div>
        <div style="width: 2px; height: 10px; background: ${isLive ? "#22c55e" : "#8b5cf6"}; margin-top: -1px;"></div>
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${isLive ? "#22c55e" : "#8b5cf6"};"></div>
      `;

      if (markersRef.current.has(loc.user_id)) {
        // Update position
        markersRef.current.get(loc.user_id)!.setLngLat([loc.longitude, loc.latitude]);
      } else {
        const marker = new maplibre.Marker({ element: el })
          .setLngLat([loc.longitude, loc.latitude])
          .addTo(map);
        markersRef.current.set(loc.user_id, marker);
      }
    }

    // Fit bounds if we have multiple markers
    if (bounds && locations.length > 1) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    } else if (locations.length === 1) {
      map.flyTo({ center: [locations[0].longitude, locations[0].latitude], zoom: 14 });
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="glass border-b border-border/40 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link to="/groups/$groupId/chat" params={{ groupId }} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold">Group Map</h1>
          <p className="text-xs text-muted-foreground">{locations.length} location{locations.length !== 1 ? "s" : ""} active</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={loadLocations} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {mapError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background">
            <MapPin className="w-12 h-12 text-muted-foreground opacity-40" />
            <div className="text-center">
              <div className="font-semibold">Map failed to load</div>
              <div className="text-sm text-muted-foreground">{mapError}</div>
            </div>
            <button onClick={() => { setMapError(null); window.location.reload(); }} className="px-4 py-2 rounded-full bg-primary text-white text-sm">
              Retry
            </button>
          </div>
        ) : (
          <div ref={mapContainer} className="absolute inset-0" />
        )}

        {/* Member sidebar panel */}
        {!mapError && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72">
            <div className="glass rounded-2xl border border-white/10 p-3 max-h-48 overflow-y-auto">
              <div className="text-xs font-semibold text-muted-foreground mb-2">ACTIVE LOCATIONS</div>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : locations.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <MapPin className="w-6 h-6 mx-auto mb-1 opacity-40" />
                  No one is sharing their location
                </div>
              ) : (
                <div className="space-y-2">
                  {locations.map((loc) => (
                    <button
                      key={loc.user_id}
                      onClick={() => { if (mapRef.current) mapRef.current.flyTo({ center: [loc.longitude, loc.latitude], zoom: 16 }); }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-card/60 text-left transition"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                        {loc.profiles?.avatar_url
                          ? <img src={loc.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                          : loc.profiles?.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{loc.profiles?.display_name || loc.profiles?.username}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {loc.is_live ? <span className="text-green-400">🟢 Live</span> : <span>📍</span>}
                          {formatDistanceToNow(new Date(loc.last_updated), { addSuffix: true })}
                        </div>
                      </div>
                      {loc.user_id === user?.id && <span className="text-xs text-primary">You</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MapLibre CSS injection */}
      <style>{`
        @keyframes markerPop {
          from { transform: scale(0) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .maplibregl-ctrl-logo { display: none; }
        .maplibregl-ctrl-attrib { font-size: 10px; opacity: 0.5; }
      `}</style>
    </div>
  );
}

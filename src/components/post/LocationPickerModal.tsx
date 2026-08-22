import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, X, Search, Navigation, Loader2, Globe, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface LocationData {
  locationName: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  privacyLevel: "public" | "approximate" | "private";
}

interface LocationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: LocationData) => void;
  initialLocation?: LocationData | null;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

// Default center: Philippines
const DEFAULT_CENTER: [number, number] = [121.0, 14.6];
const DEFAULT_ZOOM = 5;

async function reverseGeocode(lat: number, lng: number): Promise<{ name: string; address: string }> {
  try {
    const res = await fetch(
      `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const addr = data.address || {};
    const name =
      addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || "Selected Location";
    const formatted = data.display_name || name;
    return { name, address: formatted };
  } catch {
    return { name: "Selected Location", address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  }
}

async function searchLocations(query: string): Promise<Array<{ name: string; address: string; lat: number; lng: number }>> {
  if (!query.trim() || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data as any[]).map((item: any) => ({
      name: item.address?.city || item.address?.town || item.address?.village || item.name || "Location",
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}

export function LocationPickerModal({
  open,
  onOpenChange,
  onConfirm,
  initialLocation,
}: LocationPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ name: string; address: string; lat: number; lng: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState<"public" | "approximate" | "private">(
    initialLocation?.privacyLevel || "public"
  );
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize map when modal opens
  useEffect(() => {
    if (!open) return;

    // Defer initialization to ensure DOM is rendered
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        const center = initialLocation
          ? [initialLocation.longitude, initialLocation.latitude] as [number, number]
          : DEFAULT_CENTER;
        const zoom = initialLocation ? 13 : DEFAULT_ZOOM;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "&copy; OpenStreetMap contributors",
                maxzoom: 19,
              },
            },
            layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
          },
          center,
          zoom,
          attributionControl: false,
        });

        map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          "bottom-right"
        );
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          setMapReady(true);
          setMapError(null);

          // If we have an initial location, place a marker
          if (initialLocation) {
            placeMarker(map, initialLocation.latitude, initialLocation.longitude);
          }
        });

        map.on("click", async (e) => {
          const { lat, lng } = e.lngLat;
          placeMarker(map, lat, lng);
          const geocoded = await reverseGeocode(lat, lng);
          setSelectedLocation({
            locationName: geocoded.name,
            latitude: lat,
            longitude: lng,
            formattedAddress: geocoded.address,
            privacyLevel,
          });
        });

        map.on("error", () => {
          setMapError("Map tiles failed to load. You can still search for a location.");
        });

        mapRef.current = map;
      } catch (err: any) {
        setMapError("Failed to initialize map: " + (err.message || "Unknown error"));
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [open]);

  // Destroy map on close
  useEffect(() => {
    if (!open) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      setMapReady(false);
      setMapError(null);
      setSearchQuery("");
      setSearchResults([]);
      setShowSearch(false);
    }
  }, [open]);

  function placeMarker(map: maplibregl.Map, lat: number, lng: number) {
    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Create custom marker element matching OutLoud theme
    const el = document.createElement("div");
    el.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      cursor: pointer; user-select: none;
      filter: drop-shadow(0 4px 12px rgba(255, 107, 107, 0.6));
      animation: markerDrop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    el.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #ff6b6b, #c44569);
        border: 2.5px solid white;
        border-radius: 50% 50% 50% 0;
        width: 36px; height: 36px;
        transform: rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 20px rgba(255,107,107,0.5);
      ">
        <span style="transform: rotate(45deg); font-size: 16px; display: block;">📍</span>
      </div>
      <div style="width: 2px; height: 8px; background: linear-gradient(to bottom, #c44569, transparent);"></div>
    `;

    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current = marker;
  }

  // Search with debounce
  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchLocations(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
  }, []);

  function handleSelectSearchResult(result: { name: string; address: string; lat: number; lng: number }) {
    setSearchResults([]);
    setSearchQuery(result.name);
    setShowSearch(false);

    const newLoc: LocationData = {
      locationName: result.name,
      latitude: result.lat,
      longitude: result.lng,
      formattedAddress: result.address,
      privacyLevel,
    };
    setSelectedLocation(newLoc);

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [result.lng, result.lat], zoom: 14 });
      placeMarker(mapRef.current, result.lat, result.lng);
    }
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Your browser doesn't support location access. Please select manually on the map.");
      return;
    }

    setIsLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 15 });
          placeMarker(mapRef.current, latitude, longitude);
        }
        const geocoded = await reverseGeocode(latitude, longitude);
        const newLoc: LocationData = {
          locationName: geocoded.name,
          latitude,
          longitude,
          formattedAddress: geocoded.address,
          privacyLevel,
        };
        setSelectedLocation(newLoc);
        setIsLoadingGps(false);
        toast.success("Location detected!");
      },
      (err) => {
        setIsLoadingGps(false);
        if (err.code === 1) {
          toast.error("Location access was denied. Please select a location manually on the map.");
        } else if (err.code === 2) {
          toast.error("Location is unavailable. Please select a location manually on the map.");
        } else if (err.code === 3) {
          toast.error("Location request timed out. Please try again or select manually.");
        } else {
          toast.error("We couldn't access your location. Please select a location manually on the map.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleConfirm() {
    if (!selectedLocation) {
      toast.error("Please select a location on the map first.");
      return;
    }
    onConfirm({ ...selectedLocation, privacyLevel });
    onOpenChange(false);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      {/* Marker animation style */}
      <style>{`
        @keyframes markerDrop {
          from { transform: translateY(-20px) scale(0.5); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .leaflet-attribution-flag { display: none !important; }
        .maplibregl-ctrl-attrib-inner { font-size: 9px !important; }
        .maplibregl-ctrl-attrib { background: rgba(0,0,0,0.5) !important; border-radius: 6px !important; }
        .maplibregl-ctrl-attrib a { color: #aaa !important; }
      `}</style>

      <div
        className="w-full max-w-lg bg-card border border-border/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-vivid grid place-items-center shadow-glow">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Add Location</h3>
              <p className="text-[11px] text-muted-foreground">Click the map or search for a place</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pt-3 pb-2 relative shrink-0">
          <div className="flex items-center gap-2 bg-input/80 border border-border/40 rounded-xl px-3 py-2 focus-within:border-primary/60 transition">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { handleSearchInput(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Search for a location..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {isSearching && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />}
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearch && searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full z-10 mt-1 bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSearchResult(result)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition border-b border-border/30 last:border-0"
                >
                  <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{result.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{result.address}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="relative mx-4 mb-3 rounded-2xl overflow-hidden border border-border/40 shrink-0" style={{ height: "300px" }}>
          {/* Map renders here */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Loading overlay */}
          {!mapReady && !mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Loading map...</span>
            </div>
          )}

          {/* Map error overlay */}
          {mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/90 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground opacity-60" />
              <div className="text-xs text-muted-foreground max-w-[200px]">{mapError}</div>
            </div>
          )}

          {/* Map hint */}
          {mapReady && !selectedLocation && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-black/70 backdrop-blur-sm text-white text-[11px] px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
              Click anywhere on the map to pin a location
            </div>
          )}
        </div>

        {/* Selected Location Display */}
        <div className="px-4 pb-2 shrink-0">
          {selectedLocation ? (
            <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-2xl px-4 py-3">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{selectedLocation.locationName}</div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">{selectedLocation.formattedAddress}</div>
              </div>
              <button
                onClick={() => {
                  setSelectedLocation(null);
                  markerRef.current?.remove();
                  markerRef.current = null;
                }}
                className="text-muted-foreground hover:text-foreground transition shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-muted/30 border border-border/40 rounded-2xl px-4 py-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">No location selected yet</span>
            </div>
          )}
        </div>

        {/* Privacy Controls */}
        {selectedLocation && (
          <div className="px-4 pb-3 shrink-0">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Location Privacy</div>
            <div className="flex items-center gap-2">
              {(["public", "approximate", "private"] as const).map((level) => {
                const icons = {
                  public: <Globe className="w-3.5 h-3.5" />,
                  approximate: <Eye className="w-3.5 h-3.5" />,
                  private: <EyeOff className="w-3.5 h-3.5" />,
                };
                const labels = {
                  public: "Public",
                  approximate: "Approximate",
                  private: "Private",
                };
                const descriptions = {
                  public: "Exact location visible to all",
                  approximate: "Only city/region shown",
                  private: "Location hidden from others",
                };
                return (
                  <button
                    key={level}
                    onClick={() => setPrivacyLevel(level)}
                    title={descriptions[level]}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition flex-1 justify-center ${
                      privacyLevel === level
                        ? "bg-primary/15 border-primary text-primary shadow-glow"
                        : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {icons[level]}
                    <span className="hidden sm:inline">{labels[level]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Action Buttons */}
        <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-border/40 shrink-0">
          <button
            onClick={handleUseMyLocation}
            disabled={isLoadingGps}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/60 border border-border/40 text-xs font-semibold text-foreground hover:bg-muted transition disabled:opacity-50 flex-1 justify-center"
          >
            {isLoadingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-primary" />
            )}
            {isLoadingGps ? "Detecting..." : "Use My Location"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-vivid text-white text-xs font-bold shadow-glow hover:scale-105 transition disabled:opacity-40 disabled:scale-100 flex-1 justify-center"
          >
            <MapPin className="w-3.5 h-3.5" />
            Confirm Location
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

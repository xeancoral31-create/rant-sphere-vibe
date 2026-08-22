import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface PostLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latitude: number;
  longitude: number;
  locationName: string;
  formattedAddress?: string | null;
  privacyLevel?: string;
}

export function PostLocationModal({
  open,
  onOpenChange,
  latitude,
  longitude,
  locationName,
  formattedAddress,
  privacyLevel = "public",
}: PostLocationModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
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
          center: [longitude, latitude],
          zoom: privacyLevel === "approximate" ? 11 : 14,
          attributionControl: false,
          interactive: true,
        });

        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          setMapReady(true);

          // Add marker (only if not private)
          if (privacyLevel !== "private") {
            const el = document.createElement("div");
            el.style.cssText = `
              display: flex; flex-direction: column; align-items: center;
              filter: drop-shadow(0 4px 12px rgba(255, 107, 107, 0.6));
              animation: markerPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            `;
            el.innerHTML = `
              <div style="
                background: linear-gradient(135deg, #ff6b6b, #c44569);
                border: 2.5px solid white;
                border-radius: 50% 50% 50% 0;
                width: 40px; height: 40px;
                transform: rotate(-45deg);
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 20px rgba(255,107,107,0.5);
              ">
                <span style="transform: rotate(45deg); font-size: 18px; display: block; line-height: 1;">📍</span>
              </div>
              <div style="width: 2px; height: 10px; background: linear-gradient(to bottom, #c44569, transparent);"></div>
            `;

            const popup = new maplibregl.Popup({
              offset: 52,
              closeButton: false,
              className: "outloud-popup",
            }).setHTML(`
              <div style="
                font-family: system-ui, sans-serif;
                background: rgba(33, 24, 50, 0.97);
                border: 1px solid rgba(255,107,107,0.4);
                border-radius: 12px;
                padding: 10px 14px;
                min-width: 140px;
                color: white;
              ">
                <div style="font-weight: 700; font-size: 13px; color: #ff6b6b; margin-bottom: 2px;">📍 ${locationName}</div>
                ${formattedAddress ? `<div style="font-size: 11px; opacity: 0.7; line-height: 1.4;">${formattedAddress.substring(0, 60)}${formattedAddress.length > 60 ? "…" : ""}</div>` : ""}
              </div>
            `);

            const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([longitude, latitude])
              .setPopup(popup)
              .addTo(map);

            // Auto-open popup
            setTimeout(() => marker.togglePopup(), 400);

            markerRef.current = marker;
          }
        });

        map.on("error", () => {
          setMapError("Failed to load map tiles.");
        });

        mapRef.current = map;
      } catch (err: any) {
        setMapError("Map initialization failed.");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [open, latitude, longitude, locationName, formattedAddress, privacyLevel]);

  useEffect(() => {
    if (!open) {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
      setMapError(null);
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const googleMapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      <style>{`
        @keyframes markerPop {
          from { transform: translateY(-10px) scale(0.7); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .maplibregl-popup-content {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        .maplibregl-popup-tip { display: none !important; }
        .maplibregl-ctrl-attrib-inner { font-size: 9px !important; }
        .maplibregl-ctrl-attrib {
          background: rgba(0,0,0,0.5) !important;
          border-radius: 6px !important;
        }
        .maplibregl-ctrl-attrib a { color: #999 !important; }
      `}</style>

      <div
        className="w-full max-w-md bg-card border border-border/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
        style={{ maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-vivid grid place-items-center shadow-glow">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate">{locationName}</h3>
              {formattedAddress && (
                <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{formattedAddress}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Privacy badge */}
        {privacyLevel === "approximate" && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-medium flex items-center gap-2">
            <span className="text-sm">ℹ️</span>
            Approximate location — exact coordinates are not shared.
          </div>
        )}
        {privacyLevel === "private" && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-muted/40 border border-border/40 text-muted-foreground text-[11px] font-medium flex items-center gap-2">
            <span className="text-sm">🔒</span>
            Location is set to private.
          </div>
        )}

        {/* Map */}
        <div className="relative m-4 rounded-2xl overflow-hidden border border-border/40" style={{ height: "280px" }}>
          <div ref={mapContainerRef} className="w-full h-full" />

          {!mapReady && !mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Loading map...</span>
            </div>
          )}

          {mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/90 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground opacity-60" />
              <div className="text-xs text-muted-foreground">{mapError}</div>
            </div>
          )}
        </div>

        {/* Open in Google Maps */}
        <div className="px-4 pb-4">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-muted/60 border border-border/40 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  AlertCircle,
  Heart,
  Share2,
  Bookmark
} from "lucide-react";
import { toast } from "sonner";

export interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  creator?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  likesCount?: number;
  viewsCount?: string;
}

export function VideoPlayerModal({
  open,
  onClose,
  videoUrl,
  title,
  creator,
  likesCount = 0,
  viewsCount,
}: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(likesCount);
  const [saved, setSaved] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setIsPlaying(true);
      setHasError(false);
      setIsBuffering(true);
      setCurrentTime(0);
    }
  }, [open, videoUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "m") toggleMute();
      if (e.key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isPlaying, isMuted]);

  function handleMouseMove() {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => setHasError(true));
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }

  function toggleMute() {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  }

  function handleTimeUpdate() {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }

  function handleLoadedMetadata() {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setIsBuffering(false);
      videoRef.current.play().catch(() => setIsPlaying(false));
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  function formatTime(secs: number) {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function handleLike() {
    setLiked(!liked);
    setLikes(prev => liked ? prev - 1 : prev + 1);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-fade-in p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-4xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row max-h-[92vh] group"
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
      >
        {/* Video Stage */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px] overflow-hidden">
          {hasError ? (
            <div className="text-center p-8 space-y-3">
              <div className="w-16 h-16 rounded-full bg-destructive/20 text-destructive grid place-items-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-white font-bold text-lg">Unable to load this video</h3>
              <p className="text-muted-foreground text-xs max-w-xs mx-auto">
                This video is currently unavailable or unsupported. Please check your connection or try another clip.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                autoPlay
                className="w-full h-full max-h-[75vh] object-contain cursor-pointer"
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
                onError={() => { setIsBuffering(false); setHasError(true); }}
              />

              {/* Buffering Spinner */}
              {isBuffering && !hasError && (
                <div className="absolute inset-0 grid place-items-center bg-black/30 pointer-events-none">
                  <div className="w-14 h-14 rounded-full bg-black/70 backdrop-blur-md grid place-items-center text-primary shadow-glow">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                </div>
              )}

              {/* Center Play/Pause Overlay indicator */}
              {!isPlaying && !isBuffering && !hasError && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 grid place-items-center bg-black/30 cursor-pointer"
                  aria-label="Play video"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-vivid grid place-items-center text-white shadow-glow hover:scale-110 transition">
                    <Play className="w-7 h-7 fill-white ml-1" />
                  </div>
                </button>
              )}

              {/* Bottom Custom Video Controls Bar */}
              <div
                className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${
                  showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Progress bar */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between text-white text-xs font-semibold">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="hover:text-primary transition p-1"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>

                    <div className="flex items-center gap-1 group/vol">
                      <button onClick={toggleMute} className="hover:text-primary transition p-1">
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary opacity-80 hover:opacity-100"
                      />
                    </div>

                    <span className="font-mono text-[11px] text-white/80">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleFullscreen}
                      className="hover:text-primary transition p-1.5 rounded-lg hover:bg-white/10"
                      aria-label="Toggle Fullscreen"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Close Button Mobile/Desktop */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 grid place-items-center text-white hover:bg-white/20 transition cursor-pointer"
            aria-label="Close video player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info & Side Action Panel */}
        <div className="w-full md:w-80 bg-zinc-950 p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 space-y-4">
          <div className="space-y-4">
            {/* Header info */}
            {creator && (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shadow-glow shrink-0">
                  {creator.avatar_url ? (
                    <img src={creator.avatar_url} className="w-full h-full object-cover" alt={creator.username} />
                  ) : (
                    creator.username?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{creator.display_name || creator.username}</div>
                  <div className="text-xs text-muted-foreground truncate">@{creator.username}</div>
                </div>
              </div>
            )}

            {/* Title / Caption */}
            {title && (
              <p className="text-sm text-zinc-200 leading-relaxed font-medium">
                {title}
              </p>
            )}

            {viewsCount && (
              <div className="text-xs text-zinc-400 font-medium">
                👁️ {viewsCount} views
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-around pt-4 border-t border-white/10 text-xs">
            <button
              onClick={handleLike}
              className={`flex flex-col items-center gap-1 transition ${
                liked ? "text-rose-500 font-bold" : "text-zinc-400 hover:text-rose-400"
              }`}
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
              <span>{likes}</span>
            </button>

            <button
              onClick={() => setSaved(!saved)}
              className={`flex flex-col items-center gap-1 transition ${
                saved ? "text-amber-400 font-bold" : "text-zinc-400 hover:text-amber-400"
              }`}
            >
              <Bookmark className={`w-5 h-5 ${saved ? "fill-current" : ""}`} />
              <span>{saved ? "Saved" : "Save"}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition"
            >
              <Share2 className="w-5 h-5" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  X,
  Camera,
  Upload,
  Trash2,
  Loader2,
  Check,
  ImageIcon,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  initialProfile: {
    id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    cover_url: string | null;
  };
  onProfileUpdated: (updated: {
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    cover_url: string | null;
  }) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function EditProfileModal({
  open,
  onClose,
  initialProfile,
  onProfileUpdated,
}: EditProfileModalProps) {
  const { user, refreshProfile } = useAuthContext();

  // Form fields
  const [displayName, setDisplayName] = useState(initialProfile.display_name || "");
  const [bio, setBio] = useState(initialProfile.bio || "");

  // Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialProfile.avatar_url);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // Cover state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialProfile.cover_url);
  const [removeCover, setRemoveCover] = useState(false);

  // Status
  const [saving, setSaving] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDisplayName(initialProfile.display_name || "");
      setBio(initialProfile.bio || "");
      setAvatarFile(null);
      setAvatarPreview(initialProfile.avatar_url);
      setRemoveAvatar(false);
      setCoverFile(null);
      setCoverPreview(initialProfile.cover_url);
      setRemoveCover(false);
      setSaving(false);
      setUploadStatusText("");
    }
  }, [open, initialProfile]);

  if (!open || typeof document === "undefined") return null;

  // File validation
  function validateImageFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "This image format is not supported. Please use JPG, PNG, or WEBP.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "The selected image exceeds the 5 MB limit.";
    }
    return null;
  }

  // Handle Avatar Selection
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  }

  // Handle Cover Selection
  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  }

  // Helper: Upload file to storage with reliable fallback
  async function uploadToStorage(file: File, folder: "avatars" | "covers"): Promise<string> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user?.id || "user"}/${folder}-${Date.now()}.${ext}`;

    // Try 'avatars' bucket first
    try {
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (!upErr) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
      }
    } catch {}

    // Fallback: try 'posts' bucket
    try {
      const { error: postErr } = await supabase.storage.from("posts").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (!postErr) {
        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
      }
    } catch {}

    // Fallback: optimized Data URL representation
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  // Handle Save Profile
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setUploadStatusText("Uploading profile photo...");

    try {
      let finalAvatarUrl = initialProfile.avatar_url;
      let finalCoverUrl = initialProfile.cover_url;

      // 1. Process Avatar
      if (removeAvatar) {
        finalAvatarUrl = null;
      } else if (avatarFile) {
        setUploadStatusText("Uploading profile picture...");
        finalAvatarUrl = await uploadToStorage(avatarFile, "avatars");
      }

      // 2. Process Cover
      if (removeCover) {
        finalCoverUrl = null;
      } else if (coverFile) {
        setUploadStatusText("Uploading cover banner...");
        finalCoverUrl = await uploadToStorage(coverFile, "covers");
      }

      setUploadStatusText("Saving profile details...");

      // 3. Update Supabase profiles table
      const updatedData = {
        id: user.id,
        username: initialProfile.username,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: finalAvatarUrl,
        cover_url: finalCoverUrl,
        updated_at: new Date().toISOString(),
      };

      const { error: dbError } = await (supabase.from("profiles") as any)
        .upsert(updatedData, { onConflict: "id" });

      if (dbError) throw dbError;

      // 4. Also update Clerk User profile if available
      try {
        if (avatarFile && (user as any)?.setProfileImage) {
          await (user as any).setProfileImage({ file: avatarFile });
        }
      } catch {}

      // 5. Notify Parent & Context
      onProfileUpdated({
        display_name: updatedData.display_name,
        bio: updatedData.bio,
        avatar_url: updatedData.avatar_url,
        cover_url: updatedData.cover_url,
      });

      refreshProfile();
      toast.success("Your profile has been updated successfully.");
      onClose();
    } catch (err: any) {
      console.error("Profile update error:", err);
      toast.error("Unable to upload the selected image. Please try again.");
    } finally {
      setSaving(false);
      setUploadStatusText("");
    }
  }

  const hasChanges =
    displayName.trim() !== (initialProfile.display_name || "").trim() ||
    bio.trim() !== (initialProfile.bio || "").trim() ||
    avatarFile !== null ||
    removeAvatar ||
    coverFile !== null ||
    removeCover;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Edit Profile</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your public profile information and appearance.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
          {/* Hidden File Inputs */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
            onChange={handleCoverChange}
          />

          {/* ── 1. Profile Picture Section ── */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Profile Picture
            </label>
            <div className="flex items-center gap-5 p-4 rounded-2xl bg-muted/20 border border-border/30">
              {/* Circular Avatar Preview */}
              <div className="relative group/avatar shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold text-3xl overflow-hidden shadow-glow border-2 border-primary/40 ring-4 ring-background">
                  {avatarPreview && !removeAvatar ? (
                    <img
                      src={avatarPreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initialProfile.username?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition grid place-items-center text-white cursor-pointer"
                  title="Change photo"
                >
                  <Camera className="w-6 h-6" />
                </button>
              </div>

              {/* Avatar Controls */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-xs font-semibold transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{avatarPreview && !removeAvatar ? "Change Photo" : "Upload Photo"}</span>
                  </button>

                  {avatarPreview && !removeAvatar && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(null);
                        setRemoveAvatar(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full glass hover:bg-destructive/15 text-muted-foreground hover:text-destructive text-xs font-semibold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Supported: JPG, PNG, WEBP · Maximum 5 MB
                </p>
              </div>
            </div>
          </div>

          {/* ── 2. Profile Information Section ── */}
          <div className="space-y-4 pt-2 border-t border-border/30">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Profile Information
            </label>

            {/* Display Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">Display Name</span>
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
                className="w-full bg-input/80 border border-border/50 rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                This is the name displayed on your profile and posts.
              </p>
            </div>

            {/* Bio */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">Bio</span>
                <span
                  className={`text-[11px] font-mono font-medium ${
                    bio.length >= 150 ? "text-rose-400" : "text-muted-foreground"
                  }`}
                >
                  {bio.length} / 160
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Software Engineer & Sphere Creator ✨"
                rows={3}
                maxLength={160}
                className="w-full bg-input/80 border border-border/50 rounded-2xl p-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
              />
            </div>
          </div>

          {/* ── 3. Profile Appearance (Cover Photo) ── */}
          <div className="space-y-3 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Profile Appearance
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground">Cover Photo</span>

              {/* Cover Preview Area */}
              <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-muted/20 h-28 sm:h-32 flex items-center justify-center group/cover">
                {coverPreview && !removeCover ? (
                  <img
                    src={coverPreview}
                    alt="Cover banner preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                    <span className="text-xs">No cover photo set</span>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition flex items-center justify-center gap-2 backdrop-blur-xs">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-full bg-white text-black font-semibold text-xs shadow-lg hover:scale-105 transition cursor-pointer"
                  >
                    Change Cover
                  </button>
                  {coverPreview && !removeCover && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview(null);
                        setRemoveCover(true);
                      }}
                      className="px-3 py-1.5 rounded-full bg-destructive text-white font-semibold text-xs shadow-lg hover:scale-105 transition cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                >
                  {coverPreview && !removeCover ? "Replace cover photo" : "+ Add a cover photo"}
                </button>
                <span className="text-[11px] text-muted-foreground">
                  Landscape · JPG, PNG, WEBP · Max 5 MB
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-card/60 backdrop-blur-md">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {saving && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>{uploadStatusText || "Saving Changes..."}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2.5 rounded-full bg-gradient-vivid text-white text-xs font-bold shadow-glow hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:scale-100 disabled:shadow-none cursor-pointer flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

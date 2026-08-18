import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Accessibility,
  Bell,
  Ban,
  Clock,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  Link2,
  LogOut,
  Lock,
  Settings as SettingsIcon,
  Sliders,
  User as UserIcon,
  Users,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useSettings, type UserSettings } from "@/hooks/use-settings";
import { toast } from "sonner";
import { FollowButton } from "@/components/connections/FollowButton";
import { respondToRequest } from "@/lib/connections";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings · RantSphere" },
      { name: "description", content: "Manage your RantSphere account, privacy, audience, notifications, blocking and accessibility preferences." },
      { property: "og:title", content: "Settings · RantSphere" },
      { property: "og:description", content: "Manage your RantSphere account, privacy, audience and notification preferences." },
    ],
  }),
});

const SECTIONS = [
  { id: "account", label: "Account settings", icon: SettingsIcon, group: "Account" },
  { id: "profile", label: "Profile settings", icon: UserIcon, group: "Account" },
  { id: "personal", label: "Personal information", icon: ImageIcon, group: "Account" },
  { id: "security", label: "Password and security", icon: KeyRound, group: "Account" },
  { id: "privacy", label: "Privacy", icon: Lock, group: "Audience" },
  { id: "audience", label: "Audience and visibility", icon: Eye, group: "Audience" },
  { id: "posts", label: "Posts and content", icon: ImageIcon, group: "Audience" },
  { id: "connections", label: "Followers and following", icon: Users, group: "Audience" },
  { id: "notifications", label: "Notifications", icon: Bell, group: "Preferences" },
  { id: "blocking", label: "Blocking", icon: Ban, group: "Preferences" },
  { id: "activity", label: "Activity and history", icon: Clock, group: "Preferences" },
  { id: "connected", label: "Connected accounts", icon: Link2, group: "Preferences" },
  { id: "language", label: "Language and region", icon: Globe, group: "Preferences" },
  { id: "accessibility", label: "Accessibility", icon: Accessibility, group: "Preferences" },
  { id: "preferences", label: "Preferences", icon: Sliders, group: "Preferences" },
  { id: "help", label: "Help and support", icon: HelpCircle, group: "Support" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Row({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`w-12 h-7 rounded-full transition ${on ? "bg-gradient-vivid" : "bg-muted"}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl bg-input border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-6 shadow-card">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {desc && <p className="text-sm text-muted-foreground mt-1">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { profile, refreshProfile, user } = useAuthContext();
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const [active, setActive] = useState<SectionId>("account");

  async function set(patch: Partial<UserSettings>) {
    try {
      await update(patch);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (!profile || !user) return null;

  const groups = Array.from(new Set(SECTIONS.map((s) => s.group)));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="font-display text-3xl font-bold mb-6">Settings</h1>
      <div className="grid md:grid-cols-[260px_1fr] gap-6 items-start">
        <nav className="glass rounded-3xl p-3 md:sticky md:top-6 max-h-[80vh] overflow-y-auto">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{g}</div>
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition ${
                    active === s.id ? "bg-gradient-vivid text-white shadow-glow" : "hover:bg-card"
                  }`}
                >
                  <s.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          ))}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-card"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </nav>

        <div className="space-y-6 pb-16">
          {active === "account" && <AccountSection />}
          {active === "profile" && <ProfileSection onSaved={refreshProfile} />}
          {active === "personal" && <PersonalSection />}
          {active === "security" && <SecuritySection />}
          {active === "privacy" && settings && (
            <Card title="Privacy" desc="Who can find and reach you. Applies to this account only.">
              <Row title="Private account" desc="Only mutual connections can see your rants">
                <Toggle
                  on={profile.is_private}
                  onClick={async () => {
                    await supabase.from("profiles").update({ is_private: !profile.is_private }).eq("id", user.id);
                    refreshProfile();
                    toast.success("Privacy updated");
                  }}
                />
              </Row>
              <Row title="Show followers list" desc="Let others see who follows you">
                <Toggle on={settings.show_followers} onClick={() => set({ show_followers: !settings.show_followers })} />
              </Row>
              <Row title="Searchable" desc="Allow your profile to appear in search">
                <Toggle on={settings.searchable} onClick={() => set({ searchable: !settings.searchable })} />
              </Row>
              <Row title="Who can message you">
                <Select
                  value={settings.allow_messages_from}
                  onChange={(v) => set({ allow_messages_from: v })}
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "mutual", label: "Mutual connections" },
                    { value: "nobody", label: "No one" },
                  ]}
                />
              </Row>
              <Row title="Allow tagging" desc="Others can mention you in rants">
                <Toggle on={settings.allow_tagging} onClick={() => set({ allow_tagging: !settings.allow_tagging })} />
              </Row>
            </Card>
          )}
          {active === "audience" && settings && (
            <Card title="Audience and visibility" desc="Control the default reach of what you share.">
              <Row title="Profile visibility">
                <Select
                  value={settings.profile_visibility}
                  onChange={(v) => set({ profile_visibility: v })}
                  options={[
                    { value: "public", label: "Public" },
                    { value: "followers", label: "Followers" },
                    { value: "mutual", label: "Mutual only" },
                  ]}
                />
              </Row>
              <Row title="Default rant audience">
                <Select
                  value={settings.post_default_audience}
                  onChange={(v) => set({ post_default_audience: v })}
                  options={[
                    { value: "public", label: "Public" },
                    { value: "followers", label: "Followers" },
                    { value: "mutual", label: "Mutual only" },
                  ]}
                />
              </Row>
              <p className="text-xs text-muted-foreground pt-3">
                While your account is private, only people you and they both follow (mutual connections) can load your
                rants — this is enforced in the database, not just in the interface.
              </p>
            </Card>
          )}
          {active === "posts" && <PostsSection />}
          {active === "connections" && <ConnectionsSection />}
          {active === "notifications" && settings && (
            <Card title="Notifications" desc="Choose what reaches you.">
              <Row title="Reactions">
                <Toggle on={settings.notify_likes} onClick={() => set({ notify_likes: !settings.notify_likes })} />
              </Row>
              <Row title="Comments and replies">
                <Toggle on={settings.notify_comments} onClick={() => set({ notify_comments: !settings.notify_comments })} />
              </Row>
              <Row title="Follows and requests">
                <Toggle on={settings.notify_follows} onClick={() => set({ notify_follows: !settings.notify_follows })} />
              </Row>
              <Row title="Messages">
                <Toggle on={settings.notify_messages} onClick={() => set({ notify_messages: !settings.notify_messages })} />
              </Row>
              <Row title="Email summaries">
                <Toggle on={settings.notify_email} onClick={() => set({ notify_email: !settings.notify_email })} />
              </Row>
            </Card>
          )}
          {active === "blocking" && <BlockingSection />}
          {active === "activity" && <ActivitySection />}
          {active === "connected" && <ConnectedSection />}
          {active === "language" && settings && (
            <Card title="Language and region">
              <Row title="Language">
                <Select
                  value={settings.language}
                  onChange={(v) => set({ language: v })}
                  options={[
                    { value: "en", label: "English" },
                    { value: "fil", label: "Filipino" },
                    { value: "ceb", label: "Cebuano" },
                    { value: "es", label: "Español" },
                  ]}
                />
              </Row>
              <Row title="Region">
                <Select
                  value={settings.region}
                  onChange={(v) => set({ region: v })}
                  options={[
                    { value: "PH", label: "Philippines" },
                    { value: "US", label: "United States" },
                    { value: "SG", label: "Singapore" },
                    { value: "GB", label: "United Kingdom" },
                  ]}
                />
              </Row>
            </Card>
          )}
          {active === "accessibility" && settings && (
            <Card title="Accessibility">
              <Row title="Reduce motion" desc="Minimise animations and transitions">
                <Toggle on={settings.reduce_motion} onClick={() => set({ reduce_motion: !settings.reduce_motion })} />
              </Row>
              <Row title="Larger text">
                <Toggle on={settings.larger_text} onClick={() => set({ larger_text: !settings.larger_text })} />
              </Row>
              <Row title="High contrast">
                <Toggle on={settings.high_contrast} onClick={() => set({ high_contrast: !settings.high_contrast })} />
              </Row>
            </Card>
          )}
          {active === "preferences" && settings && (
            <Card title="Preferences">
              <Row title="Autoplay videos">
                <Toggle on={settings.autoplay_video} onClick={() => set({ autoplay_video: !settings.autoplay_video })} />
              </Row>
              <Row title="Theme">
                <Select
                  value={settings.theme}
                  onChange={(v) => set({ theme: v })}
                  options={[
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ]}
                />
              </Row>
            </Card>
          )}
          {active === "help" && (
            <Card title="Help and support">
              <Row title="Report a problem" desc="Tell us what went wrong and we'll look into it.">
                <a href="mailto:support@rantsphere.app" className="rounded-full glass px-4 py-2 text-sm font-medium">
                  Contact support
                </a>
              </Row>
              <Row title="Community guidelines" desc="What is and isn't allowed on RantSphere.">
                <Link to="/explore" className="rounded-full glass px-4 py-2 text-sm font-medium">
                  Read
                </Link>
              </Row>
              <Row title="Log out of this device">
                <button onClick={logout} className="rounded-full bg-gradient-vivid px-4 py-2 text-sm font-semibold text-white shadow-glow">
                  Log out
                </button>
              </Row>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSection() {
  const { user, profile } = useAuthContext();
  return (
    <Card title="Account settings" desc="The account currently signed in on this device.">
      <Row title="Username">
        <span className="text-sm text-muted-foreground">@{profile?.username}</span>
      </Row>
      <Row title="Email">
        <span className="text-sm text-muted-foreground">{user?.email ?? "—"}</span>
      </Row>
      <Row title="Account ID">
        <span className="text-xs text-muted-foreground font-mono">{user?.id.slice(0, 8)}…</span>
      </Row>
      <Row title="Role" desc="Only one account in the system holds the administrator role.">
        <span className="text-sm text-muted-foreground">User</span>
      </Row>
    </Card>
  );
}

function ProfileSection({ onSaved }: { onSaved: () => void }) {
  const { profile, user } = useAuthContext();
  const [form, setForm] = useState({ display_name: "", bio: "" });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) setForm({ display_name: profile.display_name ?? "", bio: profile.bio ?? "" });
  }, [profile?.id]);

  async function save() {
    if (!user || !profile) return;
    setLoading(true);
    let avatar_url = profile.avatar_url;
    if (avatar) {
      const ext = avatar.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true });
      if (!error) avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("profiles").update({ ...form, avatar_url }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
  }

  if (!profile) return null;

  return (
    <Card title="Profile settings" desc="How you appear across RantSphere.">
      <div className="flex items-center gap-4 py-4 border-b border-border/40">
        <div className="w-20 h-20 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold text-2xl overflow-hidden">
          {avatar ? (
            <img src={URL.createObjectURL(avatar)} alt="New avatar" className="w-full h-full object-cover" />
          ) : profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            profile.username[0]?.toUpperCase()
          )}
        </div>
        <label className="rounded-full glass px-4 py-2 cursor-pointer hover:bg-card text-sm font-medium">
          Change avatar
          <input type="file" accept="image/*" hidden onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="py-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className="mt-1 w-full rounded-xl bg-input border border-border px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            maxLength={200}
            className="mt-1 w-full rounded-xl bg-input border border-border px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
        <button
          onClick={save}
          disabled={loading}
          className="w-full rounded-xl bg-gradient-vivid py-3 font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Card>
  );
}

function PersonalSection() {
  const { user } = useAuthContext();
  const [form, setForm] = useState({ full_name: "", country: "", location: "", website: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, country, location, website, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setForm({
            full_name: data.full_name ?? "",
            country: data.country ?? "",
            location: data.location ?? "",
            website: data.website ?? "",
            phone: data.phone ?? "",
          });
      });
  }, [user?.id]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success("Personal information saved");
  }

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: "full_name", label: "Full name" },
    { key: "country", label: "Country" },
    { key: "location", label: "Location" },
    { key: "website", label: "Website" },
    { key: "phone", label: "Phone" },
  ];

  return (
    <Card title="Personal information" desc="Private to your account. Never shown to other users unless you share it.">
      <div className="space-y-4 py-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium">{f.label}</label>
            <input
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="mt-1 w-full rounded-xl bg-input border border-border px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ))}
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-gradient-vivid py-3 font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </Card>
  );
}

function SecuritySection() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw("");
    toast.success("Password updated");
  }

  return (
    <Card title="Password and security" desc="Keep your account protected.">
      <div className="py-2 space-y-4">
        <div>
          <label className="text-sm font-medium">New password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="mt-1 w-full rounded-xl bg-input border border-border px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={change}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-vivid py-3 font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {busy ? "Updating..." : "Update password"}
        </button>
        <button
          onClick={async () => {
            await supabase.auth.signOut({ scope: "global" });
            toast.success("Signed out of all devices");
          }}
          className="w-full rounded-xl glass py-3 font-semibold"
        >
          Log out of all devices
        </button>
      </div>
    </Card>
  );
}

function PostsSection() {
  const { user } = useAuthContext();
  const [posts, setPosts] = useState<{ id: string; content: string | null; created_at: string; is_hidden: boolean }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("posts")
      .select("id, content, created_at, is_hidden")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setPosts(data ?? []));
  }, [user?.id]);

  async function remove(id: string) {
    await supabase.from("posts").delete().eq("id", id);
    setPosts((p) => p.filter((x) => x.id !== id));
    toast.success("Rant deleted");
  }

  return (
    <Card title="Posts and content" desc="Everything you've shared from this account.">
      {posts.length === 0 && <p className="py-4 text-sm text-muted-foreground">No rants yet.</p>}
      {posts.map((p) => (
        <Row key={p.id} title={p.content?.slice(0, 70) || "Media rant"} desc={new Date(p.created_at).toLocaleString()}>
          <button onClick={() => remove(p.id)} className="rounded-full glass px-4 py-2 text-sm text-destructive">
            Delete
          </button>
        </Row>
      ))}
    </Card>
  );
}

interface MiniProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

function ConnectionsSection() {
  const { user } = useAuthContext();
  const [pending, setPending] = useState<MiniProfile[]>([]);
  const [followers, setFollowers] = useState<MiniProfile[]>([]);
  const [following, setFollowing] = useState<MiniProfile[]>([]);

  async function load() {
    if (!user) return;
    const [inc, out] = await Promise.all([
      supabase
        .from("follows")
        .select("status, follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
        .eq("following_id", user.id),
      supabase
        .from("follows")
        .select("status, target:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
        .eq("follower_id", user.id),
    ]);
    const incRows = (inc.data ?? []) as unknown as { status: string; follower: MiniProfile }[];
    const outRows = (out.data ?? []) as unknown as { status: string; target: MiniProfile }[];
    setPending(incRows.filter((r) => r.status === "pending").map((r) => r.follower));
    setFollowers(incRows.filter((r) => r.status === "accepted").map((r) => r.follower));
    setFollowing(outRows.filter((r) => r.status === "accepted").map((r) => r.target));
  }

  useEffect(() => {
    void load();
  }, [user?.id]);

  async function respond(id: string, accept: boolean) {
    if (!user) return;
    await respondToRequest(user.id, id, accept);
    toast.success(accept ? "Request accepted" : "Request declined");
    void load();
  }

  const list = (items: MiniProfile[], empty: string) =>
    items.length === 0 ? (
      <p className="py-4 text-sm text-muted-foreground">{empty}</p>
    ) : (
      items.map((p) => (
        <Row key={p.id} title={p.display_name || p.username} desc={`@${p.username}`}>
          <FollowButton targetId={p.id} username={p.username} onChange={load} />
        </Row>
      ))
    );

  return (
    <>
      <Card title="Follow requests" desc="People waiting for you to accept.">
        {pending.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          pending.map((p) => (
            <Row key={p.id} title={p.display_name || p.username} desc={`@${p.username}`}>
              <div className="flex gap-2">
                <button
                  onClick={() => respond(p.id, true)}
                  className="rounded-full bg-gradient-vivid px-4 py-2 text-sm font-semibold text-white shadow-glow"
                >
                  Accept
                </button>
                <button onClick={() => respond(p.id, false)} className="rounded-full glass px-4 py-2 text-sm font-medium">
                  Decline
                </button>
              </div>
            </Row>
          ))
        )}
      </Card>
      <Card title="Followers" desc="Follow them back to become mutual connections and see each other's rants.">
        {list(followers, "No followers yet.")}
      </Card>
      <Card title="Following">{list(following, "You're not following anyone yet.")}</Card>
    </>
  );
}

function BlockingSection() {
  const { user } = useAuthContext();
  const [blocked, setBlocked] = useState<MiniProfile[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MiniProfile[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("blocks")
      .select("blocked:profiles!blocks_blocked_id_fkey(id, username, display_name, avatar_url)")
      .eq("blocker_id", user.id);
    setBlocked(((data ?? []) as unknown as { blocked: MiniProfile }[]).map((r) => r.blocked));
  }

  useEffect(() => {
    void load();
  }, [user?.id]);

  useEffect(() => {
    if (!query.trim()) return setResults([]);
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `%${query.trim()}%`)
      .limit(5)
      .then(({ data }) => setResults((data ?? []) as MiniProfile[]));
  }, [query]);

  async function block(id: string) {
    if (!user) return;
    await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: id } as never);
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
    await supabase.from("follows").delete().eq("follower_id", id).eq("following_id", user.id);
    setQuery("");
    toast.success("User blocked");
    void load();
  }

  async function unblock(id: string) {
    if (!user) return;
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    toast.success("User unblocked");
    void load();
  }

  return (
    <Card title="Blocking" desc="Blocked people can't reach you, and any connection between you is removed.">
      <div className="py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a username to block"
          className="w-full rounded-xl bg-input border border-border px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary"
        />
        {results
          .filter((r) => r.id !== user?.id)
          .map((r) => (
            <Row key={r.id} title={r.display_name || r.username} desc={`@${r.username}`}>
              <button onClick={() => block(r.id)} className="rounded-full glass px-4 py-2 text-sm font-medium">
                Block
              </button>
            </Row>
          ))}
      </div>
      {blocked.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">You haven't blocked anyone.</p>
      ) : (
        blocked.map((b) => (
          <Row key={b.id} title={b.display_name || b.username} desc={`@${b.username}`}>
            <button onClick={() => unblock(b.id)} className="rounded-full glass px-4 py-2 text-sm font-medium">
              Unblock
            </button>
          </Row>
        ))
      )}
    </Card>
  );
}

function ActivitySection() {
  const { user } = useAuthContext();
  const [counts, setCounts] = useState({ posts: 0, comments: 0, reactions: 0, bookmarks: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, c, r, b] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("reactions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("bookmarks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setCounts({ posts: p.count ?? 0, comments: c.count ?? 0, reactions: r.count ?? 0, bookmarks: b.count ?? 0 });
    })();
  }, [user?.id]);

  return (
    <Card title="Activity and history" desc="A summary of what this account has done.">
      <Row title="Rants posted">{counts.posts}</Row>
      <Row title="Comments written">{counts.comments}</Row>
      <Row title="Reactions given">{counts.reactions}</Row>
      <Row title="Bookmarks saved">{counts.bookmarks}</Row>
    </Card>
  );
}

function ConnectedSection() {
  const { user } = useAuthContext();
  const providers = (user?.identities ?? []).map((i) => i.provider);
  return (
    <Card title="Connected accounts" desc="Sign-in methods linked to this account.">
      <Row title="Email and password">{providers.includes("email") ? "Connected" : "Not connected"}</Row>
      <Row title="Google">{providers.includes("google") ? "Connected" : "Not connected"}</Row>
    </Card>
  );
}

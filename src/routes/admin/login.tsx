import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin, adminExists, provisionAdmin, adminLogEvent } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ShieldCheck, Lock, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  component: AdminLogin,
  head: () => ({
    meta: [
      { title: "Administrator Console — RantSphere" },
      { name: "description", content: "Secure administrator sign-in for the RantSphere moderation console." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Administrator Console — RantSphere" },
      { property: "og:description", content: "Secure administrator sign-in for the RantSphere moderation console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminExists().then((r) => {
      if (!r.exists) setMode("setup");
    });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error("Invalid administrator credentials");
    }
    try {
      const res = await amIAdmin();
      if (!res.isAdmin) {
        await supabase.auth.signOut();
        setLoading(false);
        return toast.error("This account has no administrator privileges");
      }
      await adminLogEvent({ data: { action: "admin_login" } });
    } catch {
      await supabase.auth.signOut();
      setLoading(false);
      return toast.error("Access denied");
    }
    setLoading(false);
    toast.success("Administrator session started");
    navigate({ to: "/admin" });
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await provisionAdmin({ data: { email, password, setupKey } });
      toast.success("Administrator account created. Sign in now.");
      setMode("login");
      setSetupKey("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-[radial-gradient(ellipse_at_top,hsl(var(--muted)/0.5),hsl(var(--background)))]">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to RantSphere
        </Link>
        <div className="rounded-3xl border border-border bg-card/80 backdrop-blur p-8 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border border-border grid place-items-center bg-muted">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Admin Console</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Restricted access</p>
            </div>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleSetup} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium">Administrator email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg bg-input border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg bg-input border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {mode === "setup" && (
              <div>
                <label className="text-sm font-medium">Setup key</label>
                <input
                  required
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  placeholder="ADMIN_SETUP_KEY value"
                  className="mt-1 w-full rounded-lg bg-input border border-border px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  One-time provisioning. Only one administrator account can exist.
                </p>
              </div>
            )}
            <button
              disabled={loading}
              className="w-full rounded-lg bg-foreground text-background py-3 font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {loading ? "Verifying..." : mode === "login" ? "Enter console" : "Create administrator"}
            </button>
          </form>

          <p className="mt-6 text-xs text-center text-muted-foreground">
            User accounts cannot sign in here. Members log in at{" "}
            <Link to="/login" className="text-primary hover:underline">
              /login
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

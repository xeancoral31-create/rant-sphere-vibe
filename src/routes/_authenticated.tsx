import { Outlet, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Sidebar, MobileNav } from "@/components/layout/Sidebar";
import { ComposeDialog } from "@/components/post/ComposeDialog";
import { ConnectionBanner } from "@/components/layout/ConnectionBanner";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <ConnectionBanner />
      <Sidebar onCompose={() => setComposeOpen(true)} />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}

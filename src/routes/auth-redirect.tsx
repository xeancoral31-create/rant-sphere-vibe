import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUser } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/auth-redirect")({
  component: AuthRedirectPage,
});

function AuthRedirectPage() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }

    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress;

    if (email === "xeancoral31@gmail.com") {
      navigate({ to: "/admin", replace: true });
    } else {
      navigate({ to: "/home", replace: true });
    }
  }, [user, isLoaded, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

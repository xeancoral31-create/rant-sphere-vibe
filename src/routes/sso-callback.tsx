import { createFileRoute } from "@tanstack/react-router";
import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/sso-callback")({
  component: SSOCallbackPage,
});

function SSOCallbackPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <AuthenticateWithRedirectCallback
          signUpFallbackRedirectUrl="/auth-redirect"
          signInFallbackRedirectUrl="/auth-redirect"
        />
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Completing authentication...</p>
      </div>
    </div>
  );
}

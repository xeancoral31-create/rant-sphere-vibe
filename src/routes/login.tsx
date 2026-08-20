import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { SignIn, useUser } from "@clerk/tanstack-react-start";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/login")({ component: LoginPage });

export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
      if (email === "xeancoral31@gmail.com") {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/home" });
      }
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-vivid relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-start gap-8">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <Link to="/" className="flex items-center gap-2 text-white">
            <Logo className="w-6 h-6" plain />
            <span className="font-display font-bold text-2xl">OutLoud</span>
          </Link>
        </div>
        <div className="relative z-10">
          <h2 className="font-display text-5xl font-bold text-white leading-tight">
            Welcome back to the noise.
          </h2>
          <p className="mt-4 text-white/80 text-lg">Your feed is waiting.</p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md flex flex-col items-center">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-6 self-start text-sm font-medium text-muted-foreground hover:text-foreground transition bg-secondary px-4 py-2 rounded-full">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 self-start">
            <Logo className="w-6 h-6 text-primary" plain />
            <span className="font-display font-bold text-xl">OutLoud</span>
          </Link>
          
          <SignIn routing="path" path="/login" fallbackRedirectUrl="/auth-redirect" signUpFallbackRedirectUrl="/auth-redirect" />
        </div>
      </div>
    </div>
  );
}

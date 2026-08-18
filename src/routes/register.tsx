import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { SignUp, useUser } from "@clerk/tanstack-react-start";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    if (user) navigate({ to: "/home" });
  }, [user, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-vivid relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col items-start gap-8">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <Link to="/" className="flex items-center gap-2 text-white">
            <Logo className="w-6 h-6" plain />
            <span className="font-display font-bold text-2xl">RantSphere</span>
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="font-display text-5xl font-bold text-white leading-tight">
            Your voice deserves a sphere.
          </h2>
          <p className="mt-4 text-white/80 text-lg">Join the unfiltered conversation.</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md flex flex-col items-center">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-6 self-end text-sm font-medium text-muted-foreground hover:text-foreground transition bg-secondary px-4 py-2 rounded-full">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 self-start">
            <Logo className="w-6 h-6 text-primary" plain />
            <span className="font-display font-bold text-xl">RantSphere</span>
          </Link>
          
          <SignUp routing="path" path="/register" fallbackRedirectUrl="/home" signInFallbackRedirectUrl="/home" />
        </div>
      </div>
    </div>
  );
}

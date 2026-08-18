import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Search, Bell, MessageCircle, User, Settings, TrendingUp, Compass, Shield, LogOut, PlusCircle } from "lucide-react";
import { SignInButton, UserButton, useUser } from "@clerk/tanstack-react-start";
import { Logo } from "@/components/brand/Logo";

const navItems = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/explore", icon: Compass, label: "Explore" },
  { to: "/trending", icon: TrendingUp, label: "Trending" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
];

export function Sidebar({ onCompose }: { onCompose?: () => void }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-64 lg:w-72 flex-col p-5 border-r border-border/40 bg-sidebar">
      <Link to="/home" className="flex items-center gap-2 mb-8 px-2">
        <Logo className="w-8 h-8 text-primary" plain />
        <span className="font-display font-bold text-xl">RantSphere</span>
      </Link>

      <nav className="space-y-1 flex-1">
        {navItems.map((it) => {
          const active = loc.pathname === it.to || (it.to !== "/home" && loc.pathname.startsWith(it.to));
          return (
            <Link key={it.to} to={it.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${active ? "bg-gradient-vivid text-white shadow-glow" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
              <it.icon className="w-5 h-5" />
              <span>{it.label}</span>
            </Link>
          );
        })}
        {user && (
          <Link to="/profile/$username" params={{ username: user.username || user.firstName || "user" }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${loc.pathname.startsWith("/profile") ? "bg-gradient-vivid text-white shadow-glow" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
            <User className="w-5 h-5" />
            <span>Profile</span>
          </Link>
        )}
        <Link to="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${loc.pathname === "/settings" ? "bg-gradient-vivid text-white shadow-glow" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </Link>
        {(user?.primaryEmailAddress?.emailAddress === "xeancoral31@gmail.com" || user?.emailAddresses?.some(e => e.emailAddress === "xeancoral31@gmail.com")) && (
          <Link to="/admin" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${loc.pathname === "/admin" ? "bg-gradient-vivid text-white shadow-glow" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
            <Shield className="w-5 h-5 text-amber-400" />
            <span>Admin</span>
          </Link>
        )}
      </nav>

      <button onClick={onCompose} className="mt-4 w-full rounded-full bg-gradient-vivid py-3 font-semibold text-white shadow-glow hover:scale-105 transition flex items-center justify-center gap-2">
        <PlusCircle className="w-5 h-5" /> Rant
      </button>

      {isSignedIn ? (
        <div className="mt-4 flex items-center justify-between p-3 rounded-xl glass">
          <UserButton showName appearance={{ elements: { userButtonBox: "flex-row-reverse" } }} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 p-3 rounded-xl glass">
          <SignInButton mode="modal">
            <button className="w-full rounded-full bg-gradient-vivid py-2 font-semibold text-white shadow-glow hover:scale-105 transition">
              Sign In
            </button>
          </SignInButton>
        </div>
      )}
    </aside>
  );
}

export function MobileNav() {
  const loc = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/40">
      <div className="flex justify-around py-2">
        {navItems.slice(0, 5).map((it) => {
          const active = loc.pathname === it.to || (it.to !== "/home" && loc.pathname.startsWith(it.to));
          return (
            <Link key={it.to} to={it.to} className={`p-3 rounded-xl ${active ? "text-primary" : "text-muted-foreground"}`}>
              <it.icon className="w-6 h-6" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

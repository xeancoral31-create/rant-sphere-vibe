import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Search,
  Bell,
  MessageCircle,
  User,
  Settings,
  TrendingUp,
  Compass,
  Shield,
  PlusCircle,
  Users,
} from "lucide-react";
import { SignInButton, UserButton, useUser } from "@clerk/tanstack-react-start";
import { Logo } from "@/components/brand/Logo";

const navItems = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/explore", icon: Compass, label: "Explore" },
  { to: "/trending", icon: TrendingUp, label: "Trending" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/friends", icon: Users, label: "Groups" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ onCompose }: { onCompose?: () => void }) {
  const loc = useLocation();
  const { user, isSignedIn } = useUser();

  return (
    <aside className="hidden md:flex sticky top-0 h-screen flex-col border-r border-border/40 bg-sidebar w-16 lg:w-64 xl:w-72 transition-all duration-300 overflow-hidden shrink-0">
      {/* Logo */}
      <Link to="/home" className="flex items-center gap-2 mb-6 px-3 lg:px-4 pt-5 min-w-0">
        <Logo className="w-8 h-8 text-primary shrink-0" plain />
        <span className="font-display font-bold text-xl hidden lg:block truncate">OutLoud</span>
      </Link>

      {/* Nav */}
      <nav className="space-y-0.5 flex-1 px-2" aria-label="Main navigation">
        {navItems.map((it) => {
          const active = loc.pathname === it.to || (it.to !== "/home" && loc.pathname.startsWith(it.to));
          return (
            <Link
              key={it.to}
              to={it.to}
              title={it.label}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-vivid text-white shadow-glow"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <it.icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block truncate">{it.label}</span>
            </Link>
          );
        })}
        {user && (
          <Link
            to="/profile/$username"
            params={{ username: user.username || user.firstName || "user" }}
            title="Profile"
            aria-label="Profile"
            aria-current={loc.pathname.startsWith("/profile") ? "page" : undefined}
            className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
              loc.pathname.startsWith("/profile")
                ? "bg-gradient-vivid text-white shadow-glow"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <User className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">Profile</span>
          </Link>
        )}
        {(user?.primaryEmailAddress?.emailAddress === "xeancoral31@gmail.com" ||
          user?.emailAddresses?.some((e) => e.emailAddress === "xeancoral31@gmail.com")) && (
          <Link
            to="/admin"
            title="Admin"
            aria-label="Admin"
            aria-current={loc.pathname === "/admin" ? "page" : undefined}
            className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
              loc.pathname === "/admin"
                ? "bg-gradient-vivid text-white shadow-glow"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Shield className="w-5 h-5 shrink-0 text-amber-400" />
            <span className="hidden lg:block">Admin</span>
          </Link>
        )}
      </nav>

      {/* Compose Button */}
      <div className="px-2 pb-2 mt-2">
        <button
          onClick={onCompose}
          aria-label="Create a Note"
          className="w-full rounded-full bg-gradient-vivid py-3 font-semibold text-white shadow-glow hover:scale-105 transition flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-5 h-5 shrink-0" />
          <span className="hidden lg:block">Note</span>
        </button>
      </div>

    </aside>
  );
}

export function MobileNav() {
  const loc = useLocation();
  const { user } = useUser();

  const mobileItems = [
    { to: "/home", icon: Home, label: "Home" },
    { to: "/explore", icon: Compass, label: "Explore" },
    { to: "/notifications", icon: Bell, label: "Alerts" },
    { to: "/messages", icon: MessageCircle, label: "Chat" },
    {
      to: user ? `/profile/${user.username || user.firstName || "user"}` : "/login",
      icon: User,
      label: "Profile",
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/40"
      aria-label="Mobile navigation"
    >
      <div className="flex justify-around py-1.5 px-1">
        {mobileItems.map((it) => {
          const active =
            loc.pathname === it.to ||
            (it.to !== "/home" && !it.to.includes("profile") && loc.pathname.startsWith(it.to));
          return (
            <Link
              key={it.label}
              to={it.to as any}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[44px] min-h-[44px] justify-center ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <it.icon
                className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`}
              />
              <span className="text-[10px] font-medium">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

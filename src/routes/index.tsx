import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Zap, MessageCircle, Camera, TrendingUp, Shield } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="w-8 h-8 text-primary" plain />
            <span className="font-display font-bold text-xl">RantSphere</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium hover:text-primary">Log in</Link>
            <Link to="/register" className="rounded-full bg-gradient-vivid px-5 py-2 text-sm font-semibold text-white shadow-glow hover:scale-105 transition">
              Join now
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-40 pb-24 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Real-time. Unfiltered. Yours.
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95]">
            Speak your mind.<br />
            <span className="text-gradient">Loud and unfiltered.</span>
          </h1>
          <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            The social platform built for raw thoughts, hot takes, and disappearing MyDay stories.
            No algorithms hiding your voice.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register" className="rounded-full bg-gradient-vivid px-8 py-3.5 font-semibold text-white shadow-glow hover:scale-105 transition">
              Create your sphere
            </Link>
            <Link to="/login" className="rounded-full glass px-8 py-3.5 font-semibold hover:bg-card transition">
              I already have one
            </Link>
          </div>
        </div>

        <div className="mt-20 mx-auto max-w-5xl">
          <div className="glass rounded-3xl p-2 shadow-card">
            <div className="rounded-2xl bg-gradient-mesh aspect-[16/9] grid place-items-center bg-card/40">
              <div className="grid grid-cols-3 gap-4 p-8 w-full max-w-3xl">
                {[
                  { author: "@maya", text: "monday meetings should be illegal", reacts: 234 },
                  { author: "@theo", text: "hot take: pineapple on pizza is elite", reacts: 1240 },
                  { author: "@jules", text: "my flat white was $9 this is a hate crime", reacts: 89 },
                ].map((p, i) => (
                  <div key={i} className="glass rounded-2xl p-4 text-left animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="text-xs text-primary font-semibold">{p.author}</div>
                    <div className="mt-2 text-sm">{p.text}</div>
                    <div className="mt-3 text-xs text-muted-foreground">♥ {p.reacts}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-center">
            Everything you need to <span className="text-gradient">rant freely</span>
          </h2>
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: "Live Feed", desc: "Real-time rants, reactions, and reposts. See the world react as it happens." },
              { icon: Camera, title: "MyDay Stories", desc: "Share moments that vanish in 24h. Media, music, stickers, viewers list." },
              { icon: MessageCircle, title: "DMs & Groups", desc: "One-on-one chats and group threads with typing indicators and reactions." },
              { icon: TrendingUp, title: "Trending Now", desc: "Personalized for you. Discover viral takes and rising voices." },
              { icon: Shield, title: "Smart Moderation", desc: "AI-powered protection from spam, hate, and harassment." },
              { icon: Sparkles, title: "Anonymous Mode", desc: "Sometimes you need to vent without a face attached." },
            ].map((f, i) => (
              <div key={i} className="glass rounded-3xl p-8 hover:shadow-glow transition group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-vivid grid place-items-center mb-4 group-hover:scale-110 transition">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-12 md:p-16 text-center shadow-card">
          <h2 className="font-display text-4xl md:text-5xl font-bold">
            Ready to <span className="text-gradient">let it out?</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">Join thousands rant-storming right now.</p>
          <Link to="/register" className="mt-8 inline-flex rounded-full bg-gradient-vivid px-10 py-4 font-semibold text-white shadow-glow hover:scale-105 transition">
            Get started — it's free
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-border/40 text-sm text-muted-foreground text-center">
        © {new Date().getFullYear()} RantSphere. Speak loud.
      </footer>
    </div>
  );
}

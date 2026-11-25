import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Clock, IndianRupee, ShieldCheck } from "lucide-react";
import { SERVICES } from "@/lib/api";

const POINTS = [
  { icon: IndianRupee, title: "Upfront fares", text: "See the exact price before you book. No surge surprises." },
  { icon: ShieldCheck, title: "OTP-verified rides", text: "Your trip starts only when you share the OTP with your driver." },
  { icon: BadgeCheck, title: "Verified partners", text: "Every driver's licence and vehicle is checked before approval." },
  { icon: Clock, title: "Rentals by the hour", text: "Keep a cab or bike with you for 1 to 12 hours." },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <img src="/img/hero.jpg" alt="Indian city street with taxis and rickshaws" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
        <header className="mx-auto flex max-w-6xl items-center px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-display text-lg font-extrabold text-foreground">S</span>
          <span className="ml-2 font-display text-xl font-extrabold">Safar</span>
          <Link to="/sign-in" data-testid="landing-signin-link" className="press ml-auto rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">Sign in</Link>
        </header>
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-28">
          <p className="rise text-xs font-bold uppercase tracking-[0.25em] text-brand">Rides · Parcels · Rentals</p>
          <h1 className="rise mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl" style={{ animationDelay: ".08s" }}>
            Move anything, anywhere in your city.
          </h1>
          <p className="rise mt-5 max-w-xl text-base text-white/80 md:text-lg" style={{ animationDelay: ".16s" }}>
            Book a cab, bike or e-rickshaw in seconds, send a parcel across town, or rent a vehicle by the hour.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: ".24s" }}>
            <Link to="/sign-up" data-testid="landing-get-started" className="press inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 font-bold text-foreground">
              Book your first ride <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/sign-up" data-testid="landing-drive-cta" className="press inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3.5 font-semibold backdrop-blur">
              Drive & earn with Safar
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">One app, five ways to move</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SERVICES.map((s, i) => (
            <Link key={s.id} to="/sign-up" data-testid={`landing-service-${s.id}`} className="press rise group overflow-hidden rounded-3xl border bg-card" style={{ animationDelay: `${i * 0.05}s` }}>
              <img src={s.img} alt={s.title} className="aspect-square w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105" />
              <div className="border-t p-4">
                <p className="font-display text-lg font-bold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <div key={p.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand"><p.icon className="h-5 w-5" /></span>
              <p className="mt-4 font-display text-lg font-bold">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Safar Mobility. Fares in INR, inclusive of taxes.
      </footer>
    </div>
  );
}

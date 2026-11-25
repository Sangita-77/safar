import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, ShieldCheck } from "lucide-react";
import { SERVICES, fmtDate, inr, useApi } from "@/lib/api";
import { useMe } from "@/lib/me";
import { StatusBadge } from "@/components/StatusBadge";

function ActiveBanner() {
  const api = useApi();
  const { data } = useQuery({ queryKey: ["active-booking"], queryFn: async () => (await api.get("/bookings/active")).data, refetchInterval: 8000 });
  if (!data) return null;
  return (
    <Link to={`/trip/${data.id}`} data-testid="active-booking-banner" className="press rise flex items-center gap-4 rounded-3xl bg-primary p-4 text-primary-foreground">
      <span className="relative flex h-3 w-3"><span className="pulse-ring absolute inset-0 rounded-full bg-brand" /><span className="relative h-3 w-3 rounded-full bg-brand" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{data.vehicle_label} · {inr(data.fare)}</p>
        <p className="truncate text-xs text-primary-foreground/70">{data.pickup.address}</p>
      </div>
      <StatusBadge status={data.status} />
      <ChevronRight className="h-5 w-5" />
    </Link>
  );
}

function Recent() {
  const api = useApi();
  const { data = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: async () => (await api.get("/bookings")).data });
  if (!data.length) return null;
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Recent</h2>
        <Link to="/trips" data-testid="see-all-trips" className="text-sm font-semibold text-muted-foreground">See all</Link>
      </div>
      <div className="mt-3 divide-y rounded-3xl border bg-card">
        {data.slice(0, 3).map((b) => (
          <Link key={b.id} to={`/trip/${b.id}`} data-testid={`recent-trip-${b.id}`} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.drop?.address || b.pickup.address}</p>
              <p className="text-xs text-muted-foreground">{b.vehicle_label} · {fmtDate(b.created_at)}</p>
            </div>
            <p className="tabular text-sm font-bold">{inr(b.fare)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function CustomerHome() {
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted-foreground">Namaste, {me?.name?.split(" ")[0] || "there"}</p>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Where are you headed?</h1>
      <Link to="/book/ride" data-testid="where-to-button" className="press mt-5 flex h-14 items-center gap-3 rounded-2xl bg-secondary px-4 text-base font-semibold text-muted-foreground">
        <Search className="h-5 w-5 text-foreground" /> Search destination
      </Link>
      <div className="mt-4"><ActiveBanner /></div>
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SERVICES.map((s, i) => (
          <Link
            key={s.id}
            to={s.to}
            data-testid={`service-tile-${s.id}`}
            className={`press rise group relative overflow-hidden rounded-3xl border bg-white ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <img src={s.img} alt={s.title} className={`w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105 ${i === 0 ? "h-40 sm:h-36" : "h-28 sm:h-36"}`} />
            <div className="px-4 pb-4">
              <p className="font-display text-lg font-bold">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          </Link>
        ))}
      </section>
      <div className="mt-6 flex items-start gap-3 rounded-3xl bg-brand/15 p-4" style={{ backgroundColor: "hsl(var(--brand) / .15)" }}>
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm"><b>Ride safe.</b> Share your 4-digit OTP only after you've met your driver and checked the vehicle number.</p>
      </div>
      <Recent />
    </div>
  );
}

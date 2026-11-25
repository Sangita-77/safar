import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { fmtDate, inr, useApi } from "@/lib/api";
import { useMe } from "@/lib/me";
import { StatusBadge } from "@/components/StatusBadge";

function TripList({ rows, money }) {
  if (!rows.length) return <p data-testid="trips-empty" className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">No trips yet.</p>;
  return (
    <div className="divide-y rounded-3xl border bg-card">
      {rows.map((b) => (
        <Link key={b.id} to={`/trip/${b.id}`} data-testid={`trip-row-${b.id}`} className="flex items-center gap-3 p-4 hover:bg-secondary/50">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{b.drop?.address || b.pickup.address}</p>
            <p className="text-xs text-muted-foreground">{b.vehicle_label} · {fmtDate(b.created_at)}</p>
            <div className="mt-1.5"><StatusBadge status={b.status} /></div>
          </div>
          <p className="tabular text-sm font-bold">{inr(money(b))}</p>
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value, testId }) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p data-testid={testId} className="tabular mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function DriverTrips() {
  const api = useApi();
  const { data, isLoading } = useQuery({ queryKey: ["driver-trips"], queryFn: async () => (await api.get("/driver/trips")).data });
  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  const s = data?.summary || {};
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Today" value={inr(s.earnings_today)} testId="earn-today" />
        <Stat label="Trips today" value={s.trips_today || 0} testId="trips-today" />
        <Stat label="Total earned" value={inr(s.earnings_total)} testId="earn-total" />
        <Stat label="Completed" value={s.completed || 0} testId="trips-completed" />
      </div>
      <h2 className="mt-8 font-display text-xl font-bold">Trip history</h2>
      <div className="mt-3"><TripList rows={data?.trips || []} money={(b) => b.driver_earning ?? b.fare} /></div>
    </>
  );
}

function CustomerTrips() {
  const api = useApi();
  const { data = [], isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: async () => (await api.get("/bookings")).data });
  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  return <TripList rows={data} money={(b) => b.fare} />;
}

export default function Trips() {
  const { data: me } = useMe();
  const driver = me?.role === "driver";
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 font-display text-3xl font-extrabold">{driver ? "Earnings" : "Your trips"}</h1>
      {driver ? <DriverTrips /> : <CustomerTrips />}
    </div>
  );
}

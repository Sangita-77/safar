import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { fmtDate, inr, useApi } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

const STATUSES = ["", "searching", "accepted", "arrived", "ongoing", "completed", "cancelled"];
const SERVICES = ["", "ride", "parcel", "rental"];

function Filter({ value, options, onChange, testId, all }) {
  return (
    <select data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl border bg-card px-3 text-base capitalize">
      {options.map((o) => <option key={o} value={o}>{o || all}</option>)}
    </select>
  );
}

export default function AdminBookings() {
  const api = useApi();
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-bookings", status, service],
    refetchInterval: 10000,
    queryFn: async () => (await api.get("/admin/bookings", { params: { status: status || undefined, service: service || undefined } })).data,
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold">All bookings</h1>
      <div className="flex flex-wrap gap-2">
        <Filter value={status} options={STATUSES} onChange={setStatus} testId="bookings-status-filter" all="All statuses" />
        <Filter value={service} options={SERVICES} onChange={setService} testId="bookings-service-filter" all="All services" />
      </div>
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      {!isLoading && !data.length && <p data-testid="bookings-empty" className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">No bookings found.</p>}
      <div className="divide-y rounded-3xl border bg-card">
        {data.map((b) => (
          <Link key={b.id} to={`/trip/${b.id}`} data-testid={`admin-booking-${b.id}`} className="grid gap-2 p-4 hover:bg-secondary/50 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-bold">#{b.code} · {b.vehicle_label} <span className="font-normal text-muted-foreground">· {fmtDate(b.created_at)}</span></p>
              <p className="truncate text-xs text-muted-foreground">{b.pickup.address}{b.drop ? ` → ${b.drop.address}` : ""}</p>
              <p className="mt-1 text-xs">Customer: <b>{b.customer_name || "—"}</b> · Driver: <b>{b.driver?.name || "—"}</b></p>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <p className="tabular font-display text-lg font-extrabold">{inr(b.fare)}</p>
              <StatusBadge status={b.status} />
              <span className="text-xs capitalize text-muted-foreground">{b.payment_method} · {b.payment_status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

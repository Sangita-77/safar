import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, MapPin, Power } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { errMsg, fmtDate, inr, useApi } from "@/lib/api";
import { useMe } from "@/lib/me";
import { StatusBadge } from "@/components/StatusBadge";

function RequestCard({ r, onAccept, busy }) {
  return (
    <div data-testid={`request-${r.id}`} className="rise rounded-3xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold">{r.vehicle_label}{r.service === "parcel" ? " · Parcel" : r.service === "rental" ? ` · ${r.hours} hrs` : ""}</p>
        <p className="tabular font-display text-xl font-extrabold">{inr(Math.round(r.fare * 0.8))}<span className="ml-1 text-xs font-medium text-muted-foreground">you earn</span></p>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <p className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-go" />{r.pickup.address}</p>
        {r.drop && <p className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" />{r.drop.address}</p>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {r.distance_km > 0 && `${r.distance_km} km trip · `}{r.pickup_km != null && `${r.pickup_km} km away · `}{r.payment_method === "cash" ? "Cash" : "Online"} · {fmtDate(r.created_at)}
      </p>
      <button data-testid={`accept-${r.id}`} disabled={busy} onClick={onAccept} className="press mt-3 h-12 w-full rounded-2xl bg-go font-bold text-white disabled:opacity-50">Accept</button>
    </div>
  );
}

function NotApproved({ me }) {
  const d = me.driver;
  return (
    <div data-testid="driver-not-approved" className="mx-auto max-w-xl rounded-3xl border bg-card p-6 text-center">
      <p className="font-display text-xl font-bold">{d?.status === "pending" ? "Verification in progress" : "Complete your driver profile"}</p>
      <p className="mt-2 text-sm text-muted-foreground">{d?.status === "pending" ? "You'll be able to go online once our team approves your documents." : "Add your vehicle and licence details to start receiving trips."}</p>
      {!d || d.status === "rejected" ? <Link to="/driver/apply" data-testid="driver-apply-link" className="press mt-4 inline-block rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground">Add details</Link> : null}
    </div>
  );
}

export default function DriverHome() {
  const { data: me } = useMe();
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const approved = me?.driver?.status === "approved";
  const online = !!me?.driver?.online;
  const active = useQuery({ queryKey: ["driver-active"], enabled: approved, refetchInterval: 8000, queryFn: async () => (await api.get("/driver/active")).data });
  const reqs = useQuery({ queryKey: ["driver-requests"], enabled: approved && online && !active.data, refetchInterval: 5000, queryFn: async () => (await api.get("/driver/requests")).data });
  const summary = useQuery({ queryKey: ["driver-trips"], enabled: approved, queryFn: async () => (await api.get("/driver/trips")).data });
  const toggle = useMutation({
    mutationFn: async (v) => (await api.post("/driver/status", { online: v })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  const accept = useMutation({
    mutationFn: async (id) => (await api.post(`/driver/bookings/${id}/accept`)).data,
    onSuccess: (b) => { toast.success("Trip accepted"); qc.invalidateQueries({ queryKey: ["driver-active"] }); navigate(`/trip/${b.id}`); },
    onError: (e) => { toast.error(errMsg(e)); qc.invalidateQueries({ queryKey: ["driver-requests"] }); },
  });

  if (!approved) return <NotApproved me={me} />;
  const s = summary.data?.summary || {};
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className={`rounded-3xl p-5 transition-colors ${online ? "bg-go text-white" : "bg-primary text-primary-foreground"}`}>
        <div className="flex items-center gap-4">
          <Power className="h-6 w-6" />
          <div className="flex-1">
            <p data-testid="driver-online-state" className="font-display text-2xl font-extrabold">{online ? "You're online" : "You're offline"}</p>
            <p className="text-sm opacity-80">{online ? "Receiving trip requests near you" : "Go online to start earning"}</p>
          </div>
          <Switch data-testid="driver-online-toggle" checked={online} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
          <div><p className="text-xs opacity-70">Today's earnings</p><p data-testid="driver-earn-today" className="tabular font-display text-2xl font-extrabold">{inr(s.earnings_today)}</p></div>
          <div><p className="text-xs opacity-70">Trips today</p><p className="tabular font-display text-2xl font-extrabold">{s.trips_today || 0}</p></div>
        </div>
      </section>
      {online && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Keep this app open — your location is shared with customers during trips.</p>}
      {active.data && (
        <Link to={`/trip/${active.data.id}`} data-testid="driver-active-trip" className="press flex items-center gap-3 rounded-3xl border-2 border-foreground bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="font-bold">Current trip · {inr(active.data.fare)}</p>
            <p className="truncate text-sm text-muted-foreground">{active.data.pickup.address}</p>
          </div>
          <StatusBadge status={active.data.status} />
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}
      {online && !active.data && (
        <section>
          <h2 className="font-display text-xl font-bold">Trip requests</h2>
          {reqs.isLoading && <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin" />}
          {reqs.data?.length === 0 && <p data-testid="no-requests" className="mt-3 rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">No requests right now. Hang tight — new trips appear here automatically.</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(reqs.data || []).map((r) => <RequestCard key={r.id} r={r} busy={accept.isPending} onAccept={() => accept.mutate(r.id)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { errMsg, fmtDate, useApi } from "@/lib/api";

const FILTERS = ["pending", "approved", "rejected"];

function DriverRow({ d, onDecide, busy }) {
  return (
    <div data-testid={`admin-driver-${d.user_id}`} className="rounded-3xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{d.name || d.email}</p>
          <p className="text-xs text-muted-foreground">{d.email} · {d.phone} · {d.city}</p>
        </div>
        {d.status === "approved" && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${d.online ? "bg-emerald-100 text-emerald-900" : "bg-secondary"}`}>{d.online ? "Online" : "Offline"}</span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Vehicle</dt><dd className="font-semibold capitalize">{d.vehicle_type} · {d.vehicle_model}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Reg. no.</dt><dd className="font-mono font-semibold">{d.vehicle_number}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Licence</dt><dd className="font-mono font-semibold">{d.license_number}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Applied</dt><dd className="font-semibold">{fmtDate(d.applied_at)}</dd></div>
      </dl>
      {d.rating && <p className="mt-2 flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{d.rating} ({d.ratings_count})</p>}
      <div className="mt-3 flex gap-2">
        {d.status !== "approved" && <button data-testid={`approve-${d.user_id}`} disabled={busy} onClick={() => onDecide(true)} className="press h-11 flex-1 rounded-xl bg-go font-bold text-white disabled:opacity-50">Approve</button>}
        {d.status !== "rejected" && <button data-testid={`reject-${d.user_id}`} disabled={busy} onClick={() => onDecide(false)} className="press h-11 flex-1 rounded-xl border border-red-200 font-bold text-red-700 disabled:opacity-50">{d.status === "approved" ? "Suspend" : "Reject"}</button>}
      </div>
    </div>
  );
}

export default function AdminDrivers() {
  const api = useApi();
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-drivers", status], queryFn: async () => (await api.get("/admin/drivers", { params: { status } })).data });
  const decide = useMutation({
    mutationFn: async ({ id, approve }) => (await api.post(`/admin/drivers/${id}/decision`, { approve })).data,
    onSuccess: (_, v) => { toast.success(v.approve ? "Driver approved" : "Driver updated"); qc.invalidateQueries({ queryKey: ["admin-drivers"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold">Driver partners</h1>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} data-testid={`driver-filter-${f}`} onClick={() => setStatus(f)} className={`press rounded-full px-4 py-2 text-sm font-semibold capitalize ${status === f ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{f}</button>
        ))}
      </div>
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      {!isLoading && !data.length && <p data-testid="drivers-empty" className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">No {status} drivers.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.map((d) => <DriverRow key={d.user_id} d={d} busy={decide.isPending} onDecide={(approve) => decide.mutate({ id: d.user_id, approve })} />)}
      </div>
    </div>
  );
}

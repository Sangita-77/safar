import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { VEHICLE_IMG, errMsg, useApi } from "@/lib/api";

const FIELDS = [
  { k: "base", label: "Base ₹", services: ["ride", "parcel"] },
  { k: "per_km", label: "Per km ₹", services: ["ride", "parcel"] },
  { k: "per_min", label: "Per min ₹", services: ["ride", "parcel"] },
  { k: "per_hour", label: "Per hour ₹", services: ["rental"] },
  { k: "min_fare", label: "Minimum ₹", services: ["ride", "parcel", "rental"] },
];

function FareRow({ fare }) {
  const api = useApi();
  const qc = useQueryClient();
  const [f, setF] = useState(fare);
  const save = useMutation({
    mutationFn: async () => (await api.put(`/admin/fares/${fare.key}`, {
      base: +f.base, per_km: +f.per_km, per_min: +f.per_min, min_fare: +f.min_fare, per_hour: +f.per_hour, active: f.active,
    })).data,
    onSuccess: () => { toast.success(`${fare.label} pricing saved`); qc.invalidateQueries({ queryKey: ["fares"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div data-testid={`fare-row-${fare.key}`} className="rounded-3xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <img src={VEHICLE_IMG[fare.vehicle]} alt="" className="h-12 w-12 rounded-xl bg-white object-contain" />
        <div className="flex-1"><p className="font-bold">{fare.label}</p><p className="text-xs capitalize text-muted-foreground">{fare.service} · {fare.vehicle}</p></div>
        <Switch data-testid={`fare-active-${fare.key}`} checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELDS.filter((x) => x.services.includes(fare.service)).map((x) => (
          <label key={x.k} className="text-xs font-semibold text-muted-foreground">{x.label}
            <input data-testid={`fare-${fare.key}-${x.k}`} type="number" min="0" step="0.5" inputMode="decimal" value={f[x.k]}
              onChange={(e) => setF({ ...f, [x.k]: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-base text-foreground" />
          </label>
        ))}
      </div>
      <button data-testid={`fare-save-${fare.key}`} disabled={save.isPending} onClick={() => save.mutate()} className="press mt-3 h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">Save</button>
    </div>
  );
}

export default function AdminFares() {
  const api = useApi();
  const { data = [], isLoading } = useQuery({ queryKey: ["fares"], queryFn: async () => (await api.get("/fares")).data });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Pricing</h1>
        <p className="text-sm text-muted-foreground">Fare = max(minimum, base + per km × distance + per min × time). Rentals = per hour × hours. Platform commission: 20%.</p>
      </div>
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      <div className="grid gap-3 lg:grid-cols-2">{data.map((f) => <FareRow key={f.key} fare={f} />)}</div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { VEHICLE_IMG, errMsg, useApi } from "@/lib/api";
import { useMe } from "@/lib/me";

const TYPES = [
  { id: "bike", label: "Bike" },
  { id: "erickshaw", label: "E-Rickshaw" },
  { id: "car", label: "Car" },
  { id: "van", label: "Mini Van" },
];

export default function DriverApply() {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [f, setF] = useState({ vehicle_type: "bike", vehicle_model: "", vehicle_number: "", license_number: "", phone: me?.phone || "", city: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const apply = useMutation({
    mutationFn: async () => (await api.post("/driver/apply", f)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); toast.success("Application submitted for verification"); navigate("/account"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const cls = "mt-1 h-12 w-full rounded-xl border bg-card px-3 text-base outline-none focus:ring-2 ring-brand";
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/account" data-testid="apply-back" className="press rounded-full p-2 hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-2xl font-extrabold">Become a driver partner</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Fill in your vehicle and licence details. Our team verifies them before you can go online.</p>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {TYPES.map((t) => (
          <button key={t.id} data-testid={`apply-vehicle-${t.id}`} onClick={() => setF({ ...f, vehicle_type: t.id })}
            className={`press overflow-hidden rounded-2xl border bg-white text-xs font-bold ${f.vehicle_type === t.id ? "ring-2 ring-foreground" : ""}`}>
            <img src={VEHICLE_IMG[t.id]} alt="" className="aspect-square w-full object-contain p-1" />
            <span className="block pb-2">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Vehicle make & model<input data-testid="apply-model" className={cls} placeholder="e.g. Hero Splendor" value={f.vehicle_model} onChange={set("vehicle_model")} /></label>
        <label className="text-sm font-semibold">Registration number<input data-testid="apply-number" className={`${cls} uppercase`} placeholder="e.g. DL01AB1234" value={f.vehicle_number} onChange={set("vehicle_number")} /></label>
        <label className="text-sm font-semibold">Driving licence number<input data-testid="apply-license" className={`${cls} uppercase`} placeholder="e.g. DL0420110012345" value={f.license_number} onChange={set("license_number")} /></label>
        <label className="text-sm font-semibold">Mobile number<input data-testid="apply-phone" className={cls} type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} /></label>
        <label className="text-sm font-semibold sm:col-span-2">City<input data-testid="apply-city" className={cls} placeholder="e.g. New Delhi" value={f.city} onChange={set("city")} /></label>
      </div>
      <button data-testid="apply-submit" disabled={apply.isPending} onClick={() => apply.mutate()}
        className="press mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
        {apply.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit application
      </button>
    </div>
  );
}

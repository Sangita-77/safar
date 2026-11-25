import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useClerk } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Car, ChevronRight, Clock, LogOut, XCircle } from "lucide-react";
import { toast } from "sonner";
import { errMsg, useApi } from "@/lib/api";
import { useMe } from "@/lib/me";

function DriverSection({ me }) {
  const d = me.driver;
  if (me.role === "admin") return null;
  if (!d || d.status === "rejected") {
    return (
      <Link to="/driver/apply" data-testid="become-driver-link" className="press flex items-center gap-4 rounded-3xl bg-primary p-5 text-primary-foreground">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-foreground"><Car className="h-6 w-6" /></span>
        <div className="flex-1">
          <p className="font-display text-lg font-bold">{d ? "Re-apply as driver partner" : "Drive & earn with Safar"}</p>
          <p className="text-sm text-primary-foreground/70">{d ? "Your last application was not approved." : "Keep 80% of every fare. Work when you want."}</p>
        </div>
        <ChevronRight className="h-5 w-5" />
      </Link>
    );
  }
  const Icon = d.status === "pending" ? Clock : d.status === "approved" ? Car : XCircle;
  return (
    <div data-testid="driver-status-card" className="flex items-center gap-4 rounded-3xl border bg-card p-5">
      <Icon className="h-6 w-6" />
      <div>
        <p className="font-bold">Driver partner · <span className="capitalize">{d.status}</span></p>
        <p className="text-sm text-muted-foreground">{d.vehicle_model} · {d.vehicle_number}</p>
        {d.status === "pending" && <p className="text-xs text-muted-foreground">Our team is verifying your documents.</p>}
      </div>
    </div>
  );
}

export default function Account() {
  const { data: me } = useMe();
  const { signOut } = useClerk();
  const api = useApi();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "" });
  useEffect(() => { if (me) setForm({ name: me.name || "", phone: me.phone || "" }); }, [me]);
  const save = useMutation({
    mutationFn: async () => (await api.put("/me", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); toast.success("Profile saved"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!me) return null;
  const cls = "h-12 w-full rounded-xl border bg-card px-3 text-base outline-none focus:ring-2 ring-brand";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Account</h1>
      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <p className="text-sm text-muted-foreground" data-testid="account-email">{me.email}</p>
        <label className="block text-sm font-semibold">Full name
          <input data-testid="profile-name" className={`${cls} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block text-sm font-semibold">Mobile number
          <input data-testid="profile-phone" className={`${cls} mt-1`} type="tel" inputMode="tel" placeholder="10-digit mobile" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <button data-testid="profile-save" disabled={save.isPending || !form.name} onClick={() => save.mutate()} className="press h-12 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-50">Save</button>
      </section>
      <DriverSection me={me} />
      <button data-testid="sign-out-button" onClick={() => signOut()} className="press flex items-center gap-2 text-sm font-semibold text-red-700">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

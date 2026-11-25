import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Package, Star } from "lucide-react";
import { toast } from "sonner";
import { errMsg, fmtDate, inr, useApi } from "@/lib/api";
import { useMe } from "@/lib/me";
import { MapView } from "@/components/MapView";
import { StatusBadge } from "@/components/StatusBadge";
import { Directions, DriverCard, OtpCard, PayOnline, RateCard, Steps } from "@/components/TripParts";

const ACTIVE = ["searching", "accepted", "arrived", "ongoing"];

function DriverActions({ b, act, busy, onRelease }) {
  const [otp, setOtp] = useState("");
  const btn = "press flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold disabled:opacity-50";
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {["accepted", "arrived"].includes(b.status) && <Directions to={b.pickup} label="Navigate to pickup" />}
        {b.status === "ongoing" && b.drop && <Directions to={b.drop} label="Navigate to drop" />}
        {b.customer_phone && <a href={`tel:${b.customer_phone}`} data-testid="call-customer" className="press rounded-full bg-secondary px-4 py-2 text-sm font-semibold">Call customer</a>}
      </div>
      {b.status === "accepted" && <button data-testid="driver-arrived" disabled={busy} onClick={() => act("arrived")} className={`${btn} bg-secondary`}>I've arrived at pickup</button>}
      {["accepted", "arrived"].includes(b.status) && (
        <div className="flex gap-2">
          <input data-testid="driver-otp-input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric"
            placeholder="Customer OTP" className="h-14 min-w-0 flex-1 rounded-2xl border bg-background px-4 text-center font-mono text-xl tracking-[0.4em] outline-none" />
          <button data-testid="driver-start-trip" disabled={otp.length !== 4 || busy} onClick={() => act("start", { otp })} className={`${btn} w-auto bg-go px-6 text-white`}>Start</button>
        </div>
      )}
      {["accepted", "arrived"].includes(b.status) && (
        <button data-testid="driver-release-trip" disabled={busy} onClick={() => window.confirm("Release this trip? It will be offered to another driver.") && onRelease()}
          className="press h-11 w-full rounded-2xl border border-red-200 text-sm font-semibold text-red-700">Can't make it — release trip</button>
      )}
      {b.status === "ongoing" && (
        <button data-testid="driver-complete-trip" disabled={busy} onClick={() => act("complete")} className={`${btn} bg-primary text-primary-foreground`}>
          Complete trip {b.payment_method === "cash" ? `· Collect ${inr(b.fare)} cash` : ""}
        </button>
      )}
    </div>
  );
}

function Summary({ b }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
      <div className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-go" /><p data-testid="trip-pickup">{b.pickup.address}</p></div>
      {b.drop && <div className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" /><p data-testid="trip-drop">{b.drop.address}</p></div>}
      {b.parcel && (
        <div className="flex gap-3 rounded-xl bg-secondary p-3"><Package className="h-4 w-4 shrink-0" />
          <p>{b.parcel.item} ({b.parcel.weight_kg} kg) → {b.parcel.receiver_name}, {b.parcel.receiver_phone}</p></div>
      )}
      <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
        <div><p className="text-xs text-muted-foreground">Fare</p><p data-testid="trip-fare" className="tabular font-display text-lg font-extrabold">{inr(b.fare)}</p></div>
        <div><p className="text-xs text-muted-foreground">{b.service === "rental" ? "Duration" : "Distance"}</p><p className="font-bold">{b.service === "rental" ? `${b.hours} hrs` : `${b.distance_km} km`}</p></div>
        <div><p className="text-xs text-muted-foreground">Payment</p><p data-testid="trip-payment" className="font-bold capitalize">{b.payment_method === "online" ? "Online" : "Cash"} · {b.payment_status}</p></div>
      </div>
    </div>
  );
}

export default function Trip() {
  const { id } = useParams();
  const api = useApi();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const { data: b, isLoading, isError, error } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => (await api.get(`/bookings/${id}`)).data,
    refetchInterval: (q) => (ACTIVE.includes(q.state.data?.status) ? 4000 : false),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["booking", id] }); qc.invalidateQueries({ queryKey: ["active-booking"] }); qc.invalidateQueries({ queryKey: ["driver-active"] }); };
  const mutate = useMutation({
    mutationFn: async ({ path, body }) => (await api.post(path, body || {})).data,
    onSuccess: (data) => { qc.setQueryData(["booking", id], (old) => ({ ...old, ...data })); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (isError) return <p className="p-6 text-center text-sm text-muted-foreground">{errMsg(error)}</p>;

  const isCustomer = me?.user_id === b.customer_id;
  const isDriver = me?.user_id === b.driver_id;
  const act = (a, body) => mutate.mutate({ path: `/driver/bookings/${b.id}/${a}`, body });
  const release = async () => {
    try { await api.post(`/driver/bookings/${b.id}/release`); qc.invalidateQueries({ queryKey: ["driver-active"] }); navigate("/"); toast.success("Trip released"); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link to={isDriver ? "/" : me?.role === "admin" ? "/admin/bookings" : "/trips"} data-testid="trip-back" className="press rounded-full p-2 hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold">{b.vehicle_label}</h1>
            <p className="text-xs text-muted-foreground">#{b.code} · {fmtDate(b.created_at)}</p>
          </div>
          <StatusBadge status={b.status} testId="trip-status" />
        </div>
        {b.status !== "cancelled" && <Steps status={b.status} />}
        {b.status === "cancelled" && b.cancel_reason && <p data-testid="cancel-reason" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{b.cancel_reason}. Please try booking again.</p>}
        {b.status === "searching" && (
          <div data-testid="searching-card" className="flex items-center gap-4 rounded-2xl bg-brand p-4" >
            <span className="relative flex h-4 w-4"><span className="pulse-ring absolute inset-0 rounded-full bg-foreground" /><span className="relative h-4 w-4 rounded-full bg-foreground" /></span>
            <p className="text-sm font-semibold">Connecting you to nearby {b.vehicle} partners…</p>
          </div>
        )}
        {isCustomer && ["accepted", "arrived"].includes(b.status) && <OtpCard otp={b.otp} />}
        {!isDriver && <DriverCard driver={b.driver} />}
        {isDriver && ACTIVE.includes(b.status) && <DriverActions b={b} act={act} busy={mutate.isPending} onRelease={release} />}
        <Summary b={b} />
        {isCustomer && b.status === "completed" && b.payment_method === "online" && b.payment_status === "pending" && <PayOnline booking={b} api={api} onPaid={refresh} />}
        {isCustomer && b.status === "completed" && !b.rating && (
          <RateCard busy={mutate.isPending} onRate={(rating, comment) => mutate.mutate({ path: `/bookings/${b.id}/rate`, body: { rating, comment } })} />
        )}
        {b.rating && <p data-testid="trip-rating" className="flex items-center gap-1 text-sm font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Rated {b.rating}/5</p>}
        {isDriver && b.status === "completed" && <p data-testid="driver-earning" className="rounded-2xl bg-secondary p-4 text-sm font-semibold">You earned {inr(b.driver_earning)} on this trip.</p>}
        {isCustomer && ["searching", "accepted", "arrived"].includes(b.status) && (
          <button data-testid="cancel-booking" disabled={mutate.isPending} onClick={() => window.confirm("Cancel this booking?") && mutate.mutate({ path: `/bookings/${b.id}/cancel` })}
            className="press h-12 w-full rounded-2xl border border-red-200 font-semibold text-red-700">Cancel booking</button>
        )}
      </div>
      <MapView pickup={b.pickup} drop={b.drop} driver={b.driver_location} className="h-72 lg:sticky lg:top-24 lg:h-[70vh]" />
    </div>
  );
}

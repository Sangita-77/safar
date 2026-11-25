import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, CreditCard, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { VEHICLE_IMG, errMsg, inr, useApi } from "@/lib/api";
import { MapView } from "@/components/MapView";
import { PlaceInput } from "@/components/PlaceInput";

const TITLES = { ride: "Book a ride", parcel: "Send a parcel", rental: "Rent by the hour" };

function ParcelForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const cls = "h-12 w-full rounded-xl border bg-card px-3 text-base outline-none focus:ring-2 ring-brand";
  return (
    <div className="grid gap-2 rounded-2xl border bg-card/60 p-3 sm:grid-cols-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:col-span-2">Receiver & package</p>
      <input data-testid="parcel-receiver-name" className={cls} placeholder="Receiver name" value={value.receiver_name} onChange={set("receiver_name")} />
      <input data-testid="parcel-receiver-phone" className={cls} placeholder="Receiver phone" inputMode="tel" type="tel" value={value.receiver_phone} onChange={set("receiver_phone")} />
      <input data-testid="parcel-item" className={cls} placeholder="What are you sending?" value={value.item} onChange={set("item")} />
      <input data-testid="parcel-weight" className={cls} placeholder="Weight (kg)" inputMode="decimal" type="number" min="0.1" value={value.weight_kg} onChange={set("weight_kg")} />
    </div>
  );
}

function HoursPicker({ hours, setHours }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Package</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[1, 2, 4, 6, 8, 12].map((h) => (
          <button key={h} data-testid={`rental-hours-${h}`} onClick={() => setHours(h)}
            className={`press rounded-full px-4 py-2 text-sm font-semibold ${hours === h ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {h} hr{h > 1 ? "s" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionRow({ o, selected, onSelect }) {
  return (
    <button data-testid={`fare-option-${o.fare_key}`} onClick={onSelect}
      className={`press flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${selected ? "border-foreground bg-card ring-2 ring-foreground" : "bg-card/60"}`}>
      <img src={VEHICLE_IMG[o.vehicle]} alt="" className="h-14 w-14 rounded-xl bg-white object-contain" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{o.label}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {o.capacity > 0 && <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{o.capacity}</span>}
          {o.distance_km > 0 && <span>{o.distance_km} km · ~{o.duration_min} min</span>}
          <span className={o.drivers_online ? "text-go font-semibold" : ""}>{o.drivers_online} nearby</span>
        </p>
      </div>
      <p className="tabular font-display text-lg font-extrabold">{inr(o.fare)}</p>
    </button>
  );
}

function PayMethod({ method, setMethod, onlineEnabled }) {
  const opts = [
    { id: "cash", label: "Cash", sub: "Pay the driver", icon: Banknote },
    { id: "online", label: "UPI / Card", sub: onlineEnabled ? "Pay securely after trip" : "Coming soon", icon: CreditCard },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map((o) => (
        <button key={o.id} data-testid={`pay-method-${o.id}`} disabled={o.id === "online" && !onlineEnabled} onClick={() => setMethod(o.id)}
          className={`press flex items-center gap-2 rounded-2xl border p-3 text-left disabled:opacity-50 ${method === o.id ? "border-foreground bg-card ring-2 ring-foreground" : "bg-card/60"}`}>
          <o.icon className="h-5 w-5" />
          <span><span className="block text-sm font-bold">{o.label}</span><span className="block text-xs text-muted-foreground">{o.sub}</span></span>
        </button>
      ))}
    </div>
  );
}

export default function Book() {
  const { service = "ride" } = useParams();
  const [params] = useSearchParams();
  const pick = params.get("pick");
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [hours, setHours] = useState(2);
  const [parcel, setParcel] = useState({ receiver_name: "", receiver_phone: "", item: "", weight_kg: "1" });
  const [selected, setSelected] = useState(null);
  const [method, setMethod] = useState("cash");
  const needsDrop = service !== "rental";
  const ready = pickup && (!needsDrop || drop);

  const { data: pay } = useQuery({ queryKey: ["pay-config"], queryFn: async () => (await api.get("/payments/config")).data });
  const est = useQuery({
    queryKey: ["estimate", service, pickup, drop, hours],
    enabled: !!ready,
    queryFn: async () => (await api.post("/bookings/estimate", { service, pickup, drop: needsDrop ? drop : null, hours })).data,
  });

  useEffect(() => {
    const list = est.data || [];
    if (!list.length) return;
    if (!selected || !list.find((o) => o.fare_key === selected)) {
      setSelected((list.find((o) => o.vehicle === pick) || list[0]).fare_key);
    }
  }, [est.data, pick, selected]);

  const book = useMutation({
    mutationFn: async () => (await api.post("/bookings", {
      service, pickup, drop: needsDrop ? drop : null, hours, fare_key: selected, payment_method: method,
      parcel: service === "parcel" ? { ...parcel, weight_kg: Number(parcel.weight_kg) || 1 } : null,
    })).data,
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["active-booking"] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success("Booking confirmed. Finding a driver…");
      navigate(`/trip/${b.id}`, { replace: true });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const choice = (est.data || []).find((o) => o.fare_key === selected);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link to="/" data-testid="book-back" className="press rounded-full p-2 hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="font-display text-2xl font-extrabold">{TITLES[service] || TITLES.ride}</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.keys(TITLES).map((s) => (
            <Link key={s} to={`/book/${s}`} data-testid={`book-tab-${s}`} className={`press shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize ${s === service ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              {s}
            </Link>
          ))}
        </div>
        <PlaceInput label="Pickup location" value={pickup} onChange={setPickup} dot="bg-go" allowLocate testId="pickup" />
        {needsDrop && <PlaceInput label={service === "parcel" ? "Delivery location" : "Where to?"} value={drop} onChange={setDrop} dot="bg-red-600" testId="drop" />}
        {service === "rental" && <HoursPicker hours={hours} setHours={setHours} />}
        {service === "parcel" && <ParcelForm value={parcel} onChange={setParcel} />}
        <div className="lg:hidden"><MapView pickup={pickup} drop={needsDrop ? drop : null} className="h-52" /></div>

        {ready && (
          <section className="space-y-2 pt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Choose a vehicle</p>
            {est.isLoading && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {est.isError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errMsg(est.error)}</p>}
            {(est.data || []).map((o) => <OptionRow key={o.fare_key} o={o} selected={o.fare_key === selected} onSelect={() => setSelected(o.fare_key)} />)}
            <p className="pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Payment</p>
            <PayMethod method={method} setMethod={setMethod} onlineEnabled={!!pay?.enabled} />
            <button data-testid="confirm-booking" disabled={!choice || book.isPending} onClick={() => book.mutate()}
              className="press mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-50">
              {book.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {choice ? `Book ${choice.label} · ${inr(choice.fare)}` : "Select a vehicle"}
            </button>
          </section>
        )}
      </div>
      <div className="hidden lg:block"><MapView pickup={pickup} drop={needsDrop ? drop : null} className="sticky top-24 h-[70vh]" /></div>
    </div>
  );
}

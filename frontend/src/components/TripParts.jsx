import { useState } from "react";
import { Check, Loader2, Navigation, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { errMsg, inr } from "@/lib/api";

const STEPS = ["searching", "accepted", "arrived", "ongoing", "completed"];
const STEP_LABEL = { searching: "Requested", accepted: "Accepted", arrived: "Arrived", ongoing: "On trip", completed: "Done" };

export function Steps({ status }) {
  const idx = STEPS.indexOf(status);
  return (
    <ol data-testid="trip-steps" className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col items-center gap-1">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${i <= idx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {i < idx ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">{STEP_LABEL[s]}</span>
        </li>
      ))}
    </ol>
  );
}

export function DriverCard({ driver }) {
  if (!driver) return null;
  return (
    <div data-testid="driver-card" className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand font-display text-lg font-extrabold">{(driver.name || "D")[0]}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{driver.name}</p>
        <p className="text-xs text-muted-foreground">{driver.vehicle_model} · {driver.rating ? <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-current" />{driver.rating}</span> : "New partner"}</p>
        <p data-testid="driver-vehicle-number" className="mt-1 inline-block rounded-md border-2 border-foreground px-1.5 font-mono text-sm font-bold tracking-wider">{driver.vehicle_number}</p>
      </div>
      {driver.phone && (
        <a href={`tel:${driver.phone}`} data-testid="call-driver" className="press flex h-11 w-11 items-center justify-center rounded-full bg-go text-white" aria-label="Call driver">
          <Phone className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}

export function OtpCard({ otp }) {
  return (
    <div data-testid="otp-card" className="flex items-center justify-between rounded-2xl bg-primary p-4 text-primary-foreground">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">Share OTP to start</p>
        <p className="text-xs text-primary-foreground/70">Only after you meet your driver</p>
      </div>
      <p data-testid="trip-otp" className="tabular font-mono text-3xl font-extrabold tracking-[0.3em] text-brand">{otp}</p>
    </div>
  );
}

export function Directions({ to, label }) {
  if (!to) return null;
  return (
    <a href={`https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}`} target="_blank" rel="noopener noreferrer"
      data-testid="open-directions" className="press inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold">
      <Navigation className="h-4 w-4" /> {label}
    </a>
  );
}

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load payment window"));
    document.body.appendChild(s);
  });
}

export function PayOnline({ booking, api, onPaid }) {
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      await loadRazorpay();
      const { data } = await api.post("/payments/order", { booking_id: booking.id });
      const rz = new window.Razorpay({
        key: data.key_id, amount: data.amount, currency: "INR", order_id: data.order_id,
        name: "Safar", description: `Trip ${booking.code}`,
        prefill: { name: data.name, email: data.email, contact: data.contact },
        theme: { color: "#FFB800" },
        handler: async (r) => {
          try { await api.post("/payments/verify", { booking_id: booking.id, ...r }); toast.success("Payment successful"); onPaid(); }
          catch (e) { toast.error(errMsg(e)); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.open();
    } catch (e) {
      toast.error(e.response ? errMsg(e) : e.message);
      setBusy(false);
    }
  };
  return (
    <button data-testid="pay-online-button" onClick={pay} disabled={busy}
      className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold disabled:opacity-60">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />} Pay {inr(booking.fare)} online
    </button>
  );
}

export function RateCard({ onRate, busy }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <div data-testid="rate-card" className="rounded-2xl border bg-card p-4">
      <p className="font-bold">How was your trip?</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} data-testid={`rate-star-${n}`} onClick={() => setStars(n)} className="press p-1" aria-label={`${n} stars`}>
            <Star className={`h-8 w-8 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-stone-300"}`} />
          </button>
        ))}
      </div>
      <textarea data-testid="rate-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (optional)"
        className="mt-2 w-full rounded-xl border bg-background p-3 text-base outline-none" rows={2} maxLength={300} />
      <button data-testid="rate-submit" disabled={!stars || busy} onClick={() => onRate(stars, comment)}
        className="press mt-2 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">Submit rating</button>
    </div>
  );
}

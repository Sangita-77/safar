import { useEffect, useState } from "react";
import { Crosshair, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { errMsg, useApi } from "@/lib/api";

function useLocate(api, onChange) {
  const [busy, setBusy] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return toast.error("Location is not supported on this device");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data } = await api.get("/geo/reverse", { params: { lat: pos.coords.latitude, lon: pos.coords.longitude } });
          onChange(data);
        } catch (e) {
          toast.error(errMsg(e));
        } finally {
          setBusy(false);
        }
      },
      () => { setBusy(false); toast.error("Allow location access to use your current location"); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };
  return [busy, locate];
}

export function PlaceInput({ label, value, onChange, dot, allowLocate, testId }) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, locate] = useLocate(api, onChange);

  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return undefined; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults((await api.get("/geo/search", { params: { q } })).data); }
      catch (e) { toast.error(errMsg(e)); }
      finally { setLoading(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [q, api]);

  if (value) {
    return (
      <div data-testid={`${testId}-selected`} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="line-clamp-2 text-sm font-medium">{value.address}</p>
        </div>
        <button data-testid={`${testId}-clear`} onClick={() => { onChange(null); setQ(""); }} className="press rounded-full p-2 hover:bg-secondary" aria-label="Change">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-2xl border bg-card px-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        <input
          data-testid={`${testId}-input`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={label}
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {allowLocate && (
          <button data-testid={`${testId}-locate`} onClick={locate} className="press flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs font-semibold">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />} Current
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul data-testid={`${testId}-results`} className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border bg-popover p-1 shadow-xl">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                data-testid={`${testId}-result-${i}`}
                onClick={() => { onChange(r); setResults([]); }}
                className="flex w-full items-start gap-3 rounded-xl p-3 text-left text-sm hover:bg-secondary"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

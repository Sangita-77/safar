import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { inr, useApi } from "@/lib/api";

function Stat({ label, value, testId, dark }) {
  return (
    <div className={`rounded-3xl p-4 ${dark ? "bg-primary text-primary-foreground" : "border bg-card"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${dark ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
      <p data-testid={testId} className="tabular mt-1 font-display text-2xl font-extrabold sm:text-3xl">{value}</p>
    </div>
  );
}

export default function AdminOverview() {
  const api = useApi();
  const { data: s, isLoading } = useQuery({ queryKey: ["admin-stats"], refetchInterval: 15000, queryFn: async () => (await api.get("/admin/stats")).data });
  if (isLoading || !s) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin" />;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Overview</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat dark label="Gross revenue" value={inr(s.gross_revenue)} testId="stat-revenue" />
        <Stat label="Platform earnings" value={inr(s.platform_earnings)} testId="stat-platform" />
        <Stat label="Total bookings" value={s.bookings_total} testId="stat-bookings" />
        <Stat label="Active now" value={s.bookings_active} testId="stat-active" />
        <Stat label="Customers" value={s.customers} testId="stat-customers" />
        <Stat label="Drivers approved" value={s.drivers_approved} testId="stat-drivers" />
        <Stat label="Pending approval" value={s.drivers_pending} testId="stat-pending" />
        <Stat label="Drivers online" value={s.drivers_online} testId="stat-online" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-3xl border bg-card p-5">
          <p className="font-bold">Bookings · last 7 days</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.daily}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} />
                <Bar dataKey="bookings" fill="#FFB800" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-3xl border bg-card p-5">
          <p className="font-bold">By service</p>
          <div className="mt-4 space-y-3">
            {Object.entries(s.by_service).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-sm"><span className="capitalize">{k}</span><span className="tabular font-bold">{v}</span></div>
                <div className="mt-1 h-2 rounded-full bg-secondary"><div className="h-2 rounded-full bg-primary" style={{ width: `${s.bookings_total ? (v / s.bookings_total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">{s.bookings_completed} completed · {s.bookings_cancelled} cancelled</p>
        </section>
      </div>
    </div>
  );
}

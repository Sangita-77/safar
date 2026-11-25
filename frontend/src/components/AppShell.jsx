import { useEffect, useRef } from "react";
import { NavLink, Link } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { BarChart3, Car, ClipboardList, Home, IndianRupee, Loader2, Route, User, Users } from "lucide-react";
import { useApi } from "@/lib/api";
import { useMe } from "@/lib/me";

const TABS = {
  customer: [
    { to: "/", label: "Home", icon: Home },
    { to: "/trips", label: "Trips", icon: Route },
    { to: "/account", label: "Account", icon: User },
  ],
  driver: [
    { to: "/", label: "Drive", icon: Car },
    { to: "/trips", label: "Earnings", icon: IndianRupee },
    { to: "/account", label: "Account", icon: User },
  ],
  admin: [
    { to: "/", label: "Overview", icon: BarChart3 },
    { to: "/admin/drivers", label: "Drivers", icon: Car },
    { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
    { to: "/admin/fares", label: "Pricing", icon: IndianRupee },
    { to: "/admin/users", label: "Users", icon: Users },
  ],
};

function LocationReporter() {
  const api = useApi();
  const last = useRef(0);
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last.current < 10000) return;
        last.current = Date.now();
        api.post("/driver/location", { lat: pos.coords.latitude, lon: pos.coords.longitude }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [api]);
  return null;
}

function Tab({ to, label, icon: Icon, desktop }) {
  const base = desktop
    ? "press flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
    : "press flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold";
  return (
    <NavLink
      to={to}
      end={to === "/"}
      data-testid={`nav-${label.toLowerCase()}${desktop ? "-desktop" : ""}`}
      className={({ isActive }) =>
        `${base} ${isActive ? (desktop ? "bg-primary text-primary-foreground" : "text-foreground") : "text-muted-foreground"}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-5 w-5 ${isActive && !desktop ? "text-foreground" : ""}`} strokeWidth={isActive ? 2.4 : 1.8} />
          {label}
          {isActive && !desktop && <span className="h-1 w-6 rounded-full bg-brand" />}
        </>
      )}
    </NavLink>
  );
}

export function AppShell({ children }) {
  const { data: me, isLoading, isError, refetch } = useMe();
  if (isLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (isError || !me) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">We couldn't load your account.</p>
        <button data-testid="retry-me" onClick={() => refetch()} className="press rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Retry</button>
      </div>
    );
  }
  const tabs = TABS[me.role] || TABS.customer;
  return (
    <div className="min-h-[100dvh] bg-background">
      {me.role === "driver" && me.driver?.online && <LocationReporter />}
      <header className="sticky top-0 z-40 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" data-testid="brand-logo" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-display text-lg font-extrabold">S</span>
            <span className="font-display text-xl font-extrabold">Safar</span>
          </Link>
          {me.role !== "customer" && (
            <span data-testid="role-chip" className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
              {me.role === "admin" ? "Super admin" : "Driver partner"}
            </span>
          )}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {tabs.map((t) => <Tab key={t.to} {...t} desktop />)}
          </nav>
          <div className="ml-auto md:ml-2"><UserButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 md:pb-12">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {tabs.map((t) => <Tab key={t.to} {...t} />)}
      </nav>
    </div>
  );
}

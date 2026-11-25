import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div data-testid="offline-banner" className="fixed inset-x-0 top-0 z-50 bg-amber-500 pt-[env(safe-area-inset-top)] text-center text-sm text-black">
      You're offline. Bookings need a connection.
    </div>
  );
}

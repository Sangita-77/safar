import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

const pin = (color, label) =>
  L.divIcon({ className: "", html: `<div class="map-pin" style="background:${color}">${label}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

const ICONS = { pickup: pin("#0F8A55", "A"), drop: pin("#D93025", "B"), driver: pin("#0E1A1F", "●") };
const DEFAULT_CENTER = [28.6139, 77.209];

function Fit({ points }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
  }, [map, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function MapView({ pickup, drop, driver, className = "h-64" }) {
  const pts = [pickup, drop, driver].filter(Boolean).map((p) => [p.lat, p.lon]);
  return (
    <div data-testid="map-view" className={`relative isolate overflow-hidden rounded-2xl border bg-secondary ${className}`}>
      <MapContainer center={pts[0] || DEFAULT_CENTER} zoom={12} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pickup && <Marker position={[pickup.lat, pickup.lon]} icon={ICONS.pickup} />}
        {drop && <Marker position={[drop.lat, drop.lon]} icon={ICONS.drop} />}
        {driver && <Marker position={[driver.lat, driver.lon]} icon={ICONS.driver} />}
        {pickup && drop && (
          <Polyline positions={[[pickup.lat, pickup.lon], [drop.lat, drop.lon]]} pathOptions={{ color: "#0E1A1F", weight: 4, dashArray: "6 8" }} />
        )}
        <Fit points={pts} />
      </MapContainer>
    </div>
  );
}

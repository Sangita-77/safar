import { useEffect, useRef } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';

const isPoint = (point) =>
  Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lon));

export default function NativeMap({ pickup, drop, driver, style }) {
  const map = useRef(null);
  const points = [pickup, drop, driver].filter(isPoint);
  const first = points[0] || { lat: 28.6139, lon: 77.209 };
  const region = {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    latitudeDelta: points.length > 1 ? 0.08 : 0.025,
    longitudeDelta: points.length > 1 ? 0.08 : 0.025,
  };
  const positions = [pickup, drop].filter(isPoint).map((point) => ({
    latitude: Number(point.lat),
    longitude: Number(point.lon),
  }));

  useEffect(() => {
    if (points.length > 1) {
      map.current?.fitToCoordinates(
        points.map((point) => ({ latitude: Number(point.lat), longitude: Number(point.lon) })),
        { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true },
      );
    }
  }, [JSON.stringify(points)]);

  return (
    <MapView
      ref={map}
      accessibilityLabel="Trip locations map"
      initialRegion={region}
      style={[{ height: 230, borderRadius: 20 }, style]}
    >
      {isPoint(pickup) && <Marker coordinate={{ latitude: Number(pickup.lat), longitude: Number(pickup.lon) }} title="Pickup" pinColor="#0F8A55" />}
      {isPoint(drop) && <Marker coordinate={{ latitude: Number(drop.lat), longitude: Number(drop.lon) }} title="Destination" pinColor="#B42318" />}
      {isPoint(driver) && <Marker coordinate={{ latitude: Number(driver.lat), longitude: Number(driver.lon) }} title="Driver" />}
      {positions.length === 2 && <Polyline coordinates={positions} strokeColor="#0E1A1F" strokeWidth={4} />}
    </MapView>
  );
}

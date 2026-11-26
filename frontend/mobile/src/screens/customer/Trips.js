import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Button, C, errMsg, fmtDate, inr, Page, S, Status, Txt } from './Common';

function Stat({ label, value }) {
  return (
    <View style={[S.card, { flex: 1 }]}>
      <Txt style={S.small}>{label}</Txt>
      <Txt style={{ color: C.dark, fontSize: 21, fontWeight: '900' }}>{value}</Txt>
    </View>
  );
}

export default function TripsScreen({ api, me, onNavigate }) {
  const isDriver = me?.role === 'driver';
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      if (isDriver) {
        const response = await api.get('/driver/trips');
        setRows(response.data?.trips || []);
        setSummary(response.data?.summary || {});
      } else {
        const response = await api.get('/bookings');
        setRows(response.data || []);
      }
    } catch (cause) {
      setError(errMsg(cause));
    } finally {
      setLoading(false);
    }
  }, [api, isDriver]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page>
      <Txt style={S.title}>{isDriver ? 'Earnings' : 'Your trips'}</Txt>
      {isDriver && (
        <View style={[S.row, { alignItems: 'stretch' }]}>
          <Stat label="Today" value={inr(summary.earnings_today)} />
          <Stat label="Trips today" value={summary.trips_today || 0} />
        </View>
      )}
      {isDriver && (
        <View style={[S.row, { alignItems: 'stretch' }]}>
          <Stat label="Total earned" value={inr(summary.earnings_total)} />
          <Stat label="Completed" value={summary.completed || 0} />
        </View>
      )}
      {loading && <ActivityIndicator color={C.green} />}
      {!!error && (
        <View style={S.card}>
          <Txt style={{ color: C.red }}>{error}</Txt>
          <Button title="Try again" secondary onPress={load} />
        </View>
      )}
      {!loading && !error && !rows.length && (
        <View style={[S.card, { alignItems: 'center', padding: 28 }]}>
          <Txt style={S.bold}>{isDriver ? 'No completed trips yet' : 'No trips yet'}</Txt>
          <Txt style={S.small}>{isDriver ? 'Your earnings and completed trips will appear here.' : 'Your completed and upcoming bookings will appear here.'}</Txt>
        </View>
      )}
      {rows.map((booking) => (
        <Pressable
          key={booking.id}
          accessibilityRole="button"
          onPress={() => onNavigate?.('trip', { id: booking.id })}
          style={[S.card, S.row]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Txt style={S.bold} numberOfLines={1}>{booking.drop?.address || booking.pickup?.address}</Txt>
            <Txt style={S.small}>{booking.vehicle_label} · {fmtDate(booking.created_at)}</Txt>
            <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Status status={booking.status} /></View>
          </View>
          <Txt style={{ fontWeight: '800' }}>{inr(isDriver ? booking.driver_earning ?? booking.fare : booking.fare)}</Txt>
        </Pressable>
      ))}
    </Page>
  );
}

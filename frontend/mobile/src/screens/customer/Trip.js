import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, TextInput, View } from 'react-native';
import { Button, C, errMsg, fmtDate, inr, Page, S, Status, Txt } from './Common';
import NativeMap from '../../components/NativeMap';
import PaymentCheckout from '../../components/PaymentCheckout';

const ACTIVE = ['searching', 'accepted', 'arrived', 'ongoing'];
const STEPS = [
  ['searching', 'Requested'],
  ['accepted', 'Accepted'],
  ['arrived', 'Arrived'],
  ['ongoing', 'On trip'],
  ['completed', 'Done'],
];

function confirm(message, action) {
  const { Platform } = require('react-native');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(message)) action?.();
    return;
  }
  Alert.alert('Please confirm', message, [
    { text: 'Keep booking', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: action },
  ]);
}

function TripProgress({ status }) {
  const active = STEPS.findIndex(([step]) => step === status);
  return (
    <View style={S.between}>
      {STEPS.map(([step, label], index) => (
        <View key={step} style={{ alignItems: 'center', flex: 1, gap: 5 }}>
          <View style={{
            width: 25,
            height: 25,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: index <= active ? C.green : '#DCE2DC',
          }}>
            <Txt style={{ color: index <= active ? C.white : C.muted, fontSize: 11, fontWeight: '800' }}>
              {index + 1}
            </Txt>
          </View>
          <Txt style={{ fontSize: 9, color: C.muted, textAlign: 'center' }}>{label}</Txt>
        </View>
      ))}
    </View>
  );
}

function openUrl(url) {
  Linking.openURL(url).catch(() => Alert.alert('Unable to open', 'No compatible app is available on this device.'));
}

export default function TripScreen({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const id = params?.id;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [otp, setOtp] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = async () => {
    try {
      const response = await api.get(`/bookings/${id}`);
      setBooking(response.data);
      setError('');
    } catch (cause) {
      setError(errMsg(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchBooking = async () => {
      try {
        const response = await api.get(`/bookings/${id}`);
        if (active) {
          setBooking(response.data);
          setError('');
        }
      } catch (cause) {
        if (active) setError(errMsg(cause));
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) fetchBooking();
    const timer = setInterval(() => {
      if (active && ACTIVE.includes(booking?.status)) fetchBooking();
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, api, booking?.status]);

  const mutate = async (path, body = {}, success) => {
    setBusy(true);
    try {
      await api.post(path, body);
      await load();
      if (success) Alert.alert('Safar', success);
    } catch (cause) {
      Alert.alert("Couldn't update trip", errMsg(cause));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Page><Txt style={S.subtitle}>Loading trip…</Txt></Page>;
  if (error || !booking) {
    return (
      <Page>
        <Txt style={{ color: C.red }}>{error || 'Trip not found.'}</Txt>
        <Button title="Try again" onPress={load} />
        <Button title="Go back" secondary onPress={onBack} />
      </Page>
    );
  }

  const b = booking;
  const isCustomer = me?.user_id === b.customer_id;
  const isDriver = me?.user_id === b.driver_id;
  const call = (phone) => phone && openUrl(`tel:${phone}`);
  const directions = (place) => place && openUrl(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`);
  const driverAction = (action, body = {}, success) => mutate(`/driver/bookings/${b.id}/${action}`, body, success);
  const releaseTrip = () => {
    setBusy(true);
    api.post(`/driver/bookings/${b.id}/release`)
      .then(() => {
        Alert.alert('Trip released', 'The trip has been offered to another driver.');
        onNavigate?.('driver-home');
      })
      .catch((cause) => Alert.alert("Couldn't release trip", errMsg(cause)))
      .finally(() => setBusy(false));
  };

  return (
    <Page>
      <View style={S.between}>
        <Pressable onPress={onBack || (() => onNavigate?.(isDriver ? 'driver-home' : 'trips'))} accessibilityRole="button">
          <Txt style={{ color: C.green, fontWeight: '800' }}>‹ Back</Txt>
        </Pressable>
        <Status status={b.status} />
      </View>
      <View style={{ gap: 4 }}>
        <Txt style={S.title}>{b.vehicle_label}</Txt>
        <Txt style={S.small}>#{b.code} · {fmtDate(b.created_at)}</Txt>
      </View>
      {b.status !== 'cancelled' && <View style={S.card}><TripProgress status={b.status} /></View>}
      {b.status === 'cancelled' && !!b.cancel_reason && (
        <View style={[S.card, { backgroundColor: '#FDE7E5' }]}>
          <Txt style={{ color: C.red }}>{b.cancel_reason}. Please try booking again.</Txt>
        </View>
      )}
      {b.status === 'searching' && (
        <View style={[S.card, { backgroundColor: C.gold }]}>
          <Txt style={S.bold}>Connecting you to nearby {b.vehicle} partners…</Txt>
        </View>
      )}
      {isCustomer && ['accepted', 'arrived'].includes(b.status) && (
        <View style={[S.card, { backgroundColor: C.dark }]}>
          <Txt style={{ color: '#D5DEDA', fontSize: 12, fontWeight: '700' }}>
            SHARE OTP TO START · ONLY AFTER MEETING YOUR DRIVER
          </Txt>
          <Txt style={{ color: C.gold, fontSize: 34, fontWeight: '900', letterSpacing: 7 }}>{b.otp}</Txt>
        </View>
      )}
      {!!b.driver && (
        <View style={[S.card, S.row]}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ fontSize: 22, fontWeight: '900' }}>{(b.driver.name || 'D')[0]}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={S.bold}>{b.driver.name}</Txt>
            <Txt style={S.small}>{b.driver.vehicle_model}{b.driver.rating ? ` · ★ ${b.driver.rating}` : ' · New partner'}</Txt>
            <Txt style={{ fontWeight: '800', marginTop: 4 }}>{b.driver.vehicle_number}</Txt>
          </View>
          {!!b.driver.phone && <Button title="Call" onPress={() => call(b.driver.phone)} style={{ minHeight: 42, paddingHorizontal: 13, backgroundColor: C.green }} />}
        </View>
      )}
      {isDriver && ACTIVE.includes(b.status) && (
        <View style={S.card}>
          <View style={S.row}>
            {['accepted', 'arrived'].includes(b.status) && (
              <Button title="Navigate to pickup" secondary onPress={() => directions(b.pickup)} />
            )}
            {b.status === 'ongoing' && b.drop && (
              <Button title="Navigate to drop" secondary onPress={() => directions(b.drop)} />
            )}
            {!!b.customer_phone && <Button title="Call customer" secondary onPress={() => call(b.customer_phone)} />}
          </View>
          {b.status === 'accepted' && (
            <Button title="I've arrived at pickup" secondary loading={busy} onPress={() => driverAction('arrived', {}, 'Pickup arrival recorded.')} />
          )}
          {['accepted', 'arrived'].includes(b.status) && (
            <View style={S.row}>
              <TextInput
                accessibilityLabel="Customer OTP"
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Customer OTP"
                keyboardType="number-pad"
                maxLength={4}
                style={[S.input, { flex: 1, textAlign: 'center', letterSpacing: 6 }]}
              />
              <Button title="Start trip" disabled={otp.length !== 4} loading={busy} onPress={() => driverAction('start', { otp }, 'Trip started.')} />
            </View>
          )}
          {b.status === 'ongoing' && (
            <Button
              title={`Complete trip${b.payment_method === 'cash' ? ` · Collect ${inr(b.fare)} cash` : ''}`}
              loading={busy}
              onPress={() => driverAction('complete', {}, 'Trip completed.')}
            />
          )}
          {['accepted', 'arrived'].includes(b.status) && (
            <Button
              title="Can't make it — release trip"
              secondary
              loading={busy}
              onPress={() => confirm('Release this trip? It will be offered to another driver.', releaseTrip)}
              style={{ borderWidth: 1, borderColor: '#E7B8B4' }}
            />
          )}
        </View>
      )}
      <View style={S.card}>
        <View style={S.row}>
          <Txt style={{ color: C.green }}>●</Txt>
          <Txt style={{ flex: 1 }}>{b.pickup?.address}</Txt>
          <Button title="Directions" secondary onPress={() => directions(b.pickup)} style={{ minHeight: 38, paddingHorizontal: 10 }} />
        </View>
        {!!b.drop && (
          <View style={[S.row, { borderTopWidth: 1, borderColor: C.border, paddingTop: 12 }]}>
            <Txt style={{ color: C.red }}>●</Txt>
            <Txt style={{ flex: 1 }}>{b.drop.address}</Txt>
            <Button title="Directions" secondary onPress={() => directions(b.drop)} style={{ minHeight: 38, paddingHorizontal: 10 }} />
          </View>
        )}
        {!!b.parcel && (
          <View style={{ backgroundColor: C.pale, padding: 11, borderRadius: 12 }}>
            <Txt>{b.parcel.item} ({b.parcel.weight_kg} kg) → {b.parcel.receiver_name}, {b.parcel.receiver_phone}</Txt>
          </View>
        )}
        <View style={[S.between, { borderTopWidth: 1, borderColor: C.border, paddingTop: 12 }]}>
          <View><Txt style={S.small}>Fare</Txt><Txt style={{ fontSize: 19, fontWeight: '900' }}>{inr(b.fare)}</Txt></View>
          <View><Txt style={S.small}>{b.service === 'rental' ? 'Duration' : 'Distance'}</Txt><Txt style={S.bold}>{b.service === 'rental' ? `${b.hours} hrs` : `${b.distance_km} km`}</Txt></View>
          <View><Txt style={S.small}>Payment</Txt><Txt style={S.bold}>{b.payment_method === 'online' ? 'Online' : 'Cash'} · {b.payment_status}</Txt></View>
        </View>
      </View>
      {isCustomer && b.status === 'completed' && b.payment_method === 'online' && b.payment_status === 'pending' && (
        <View style={S.card}>
          <Txt style={S.bold}>Online payment due · {inr(b.fare)}</Txt>
          <Button title="Pay securely" loading={busy} onPress={() => setPaymentOpen(true)} />
        </View>
      )}
      {isCustomer && b.status === 'completed' && !b.rating && (
        <View style={S.card}>
          <Txt style={S.section}>How was your trip?</Txt>
          <View style={S.row}>
            {[1, 2, 3, 4, 5].map((number) => (
              <Pressable key={number} accessibilityRole="button" accessibilityLabel={`${number} stars`} onPress={() => setStars(number)} hitSlop={6}>
                <Txt style={{ fontSize: 31, color: number <= stars ? C.gold : '#BDC5C0' }}>★</Txt>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Rating comment"
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment (optional)"
            maxLength={300}
            multiline
            style={[S.input, { minHeight: 75, paddingTop: 10 }]}
          />
          <Button title="Submit rating" disabled={!stars} loading={busy} onPress={() => mutate(`/bookings/${b.id}/rate`, { rating: stars, comment }, 'Thanks for rating your trip.')} />
        </View>
      )}
      {!!b.rating && <Txt style={S.bold}>★ Rated {b.rating}/5</Txt>}
      {isDriver && b.status === 'completed' && <View style={S.card}><Txt style={S.bold}>You earned {inr(b.driver_earning)} on this trip.</Txt></View>}
      {isCustomer && ['searching', 'accepted', 'arrived'].includes(b.status) && (
        <Button title="Cancel booking" secondary onPress={() => confirm('Cancel this booking?', () => mutate(`/bookings/${b.id}/cancel`, {}, 'Booking cancelled.'))} loading={busy} style={{ borderWidth: 1, borderColor: '#E7B8B4' }} />
      )}
      <NativeMap pickup={b.pickup} drop={b.drop} driver={b.driver_location} />
      {isCustomer && (
        <PaymentCheckout
          visible={paymentOpen}
          booking={b}
          api={api}
          onClose={() => setPaymentOpen(false)}
          onPaid={load}
        />
      )}
    </Page>
  );
}

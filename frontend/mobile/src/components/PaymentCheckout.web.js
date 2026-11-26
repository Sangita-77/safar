import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { errMsg } from '../lib/api';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load the payment window.'));
    document.body.appendChild(script);
  });
}

export default function PaymentCheckout({ visible, booking, api, onClose, onPaid }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const callbacks = useRef({ onClose, onPaid });

  useEffect(() => {
    callbacks.current = { onClose, onPaid };
  }, [onClose, onPaid]);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    const pay = async () => {
      setBusy(true);
      setError('');
      try {
        await loadRazorpay();
        const { data } = await api.post('/payments/order', { booking_id: booking.id });
        if (!active) return;
        const checkout = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency || 'INR',
          order_id: data.order_id,
          name: 'Safar',
          description: `Trip ${booking.code}`,
          prefill: { name: data.name, email: data.email, contact: data.contact },
          theme: { color: '#FFB800' },
          handler: async (response) => {
            try {
              await api.post('/payments/verify', { booking_id: booking.id, ...response });
              Alert.alert('Payment successful', 'Your trip payment has been confirmed.');
              callbacks.current.onPaid();
              callbacks.current.onClose();
            } catch (cause) {
              setError(errMsg(cause));
            }
          },
          modal: { ondismiss: () => callbacks.current.onClose() },
        });
        checkout.open();
      } catch (cause) {
        if (active) setError(cause?.response ? errMsg(cause) : cause.message);
      } finally {
        if (active) setBusy(false);
      }
    };
    pay();
    return () => { active = false; };
  }, [api, booking.id, booking.code, visible]);

  if (!visible) return null;
  return (
    <View style={styles.container}>
      {busy ? <ActivityIndicator color={colors.green} /> : null}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!error && (
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.card },
  error: { color: colors.danger, lineHeight: 20 },
  button: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.secondary },
  buttonText: { color: colors.foreground, fontWeight: '700' },
});

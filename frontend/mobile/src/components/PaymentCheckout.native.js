import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';
import { errMsg } from '../lib/api';

function checkoutHtml(order, booking) {
  const options = JSON.stringify({
    key: order.key_id,
    amount: order.amount,
    currency: order.currency || 'INR',
    order_id: order.order_id,
    name: 'Safar',
    description: `Trip ${booking.code}`,
    prefill: { name: order.name, email: order.email, contact: order.contact },
    theme: { color: '#FFB800' },
  }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      const options = ${options};
      options.handler = response => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', response }));
      options.modal = { ondismiss: () => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' })) };
      options.method = { netbanking: true, card: true, upi: true, wallet: true };
      const checkout = new Razorpay(options);
      checkout.on('payment.failed', response => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', description: response.error.description })));
      checkout.open();
    </script>
  </body></html>`;
}

export default function PaymentCheckout({ visible, booking, api, onClose, onPaid }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const processing = useRef(false);

  useEffect(() => {
    if (!visible) {
      setOrder(null);
      setError('');
      processing.current = false;
      return;
    }

    let active = true;
    api.post('/payments/order', { booking_id: booking.id })
      .then(({ data }) => { if (active) setOrder(data); })
      .catch((cause) => { if (active) setError(errMsg(cause)); });
    return () => { active = false; };
  }, [api, booking.id, visible]);

  const handleMessage = async (event) => {
    if (processing.current) return;
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      setError('The payment response could not be read. Please try again.');
      return;
    }
    if (message.type === 'dismiss') {
      onClose();
      return;
    }
    if (message.type === 'error') {
      setError(message.description || 'The payment did not complete.');
      return;
    }
    if (message.type !== 'success') return;

    processing.current = true;
    setBusy(true);
    try {
      await api.post('/payments/verify', { booking_id: booking.id, ...message.response });
      Alert.alert('Payment successful', 'Your trip payment has been confirmed.');
      onPaid();
      onClose();
    } catch (cause) {
      setError(errMsg(cause));
      processing.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pay {`₹${Math.round(Number(booking.fare || 0)).toLocaleString('en-IN')}`}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {busy || (!order && !error) ? <ActivityIndicator style={styles.loader} color={colors.green} /> : null}
        {order && !error ? (
          <WebView
            source={{ html: checkoutHtml(order, booking), baseUrl: 'https://checkout.razorpay.com' }}
            originWhitelist={['*']}
            onMessage={handleMessage}
            onError={() => setError('The payment window could not be loaded. Check your connection and try again.')}
            javaScriptEnabled
            domStorageEnabled
            style={styles.webview}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.foreground, fontSize: 17, fontWeight: '800' },
  close: { color: colors.green, fontWeight: '800', padding: 8 },
  error: { margin: 18, color: colors.danger, lineHeight: 20 },
  loader: { marginTop: 22 },
  webview: { flex: 1, backgroundColor: colors.background },
});

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BACKEND_URL } from '../src/lib/api';
import { ClerkAppProvider, CredentialsAppProvider } from '../src/context/AppContext';
import { colors } from '../src/theme';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (Array.isArray(buttons) && buttons.length >= 2) {
      const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
      const confirmBtn = buttons.find((b) => b !== cancelBtn) || buttons[buttons.length - 1];
      if (window.confirm(text)) {
        confirmBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
      return;
    }
    window.alert(text);
    if (Array.isArray(buttons) && buttons[0]?.onPress) {
      buttons[0].onPress();
    }
  };
}

function ConfigScreen({ error, retry, busy }) {
  return (
    <SafeAreaProvider>
      <View style={styles.configScreen}>
        {busy ? <ActivityIndicator size="large" color={colors.green} /> : null}
        <Text style={styles.title}>{busy ? 'Connecting to Safar' : 'Safar setup needed'}</Text>
        <Text style={styles.message}>{error}</Text>
        {!busy && (
          <Pressable onPress={retry} style={styles.button}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaProvider>
  );
}

function AuthenticatedLayout({ config }) {
  if (config.mode !== 'clerk') {
    return (
      <CredentialsAppProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </SafeAreaProvider>
      </CredentialsAppProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={config.publishable_key}
      proxyUrl={config.proxy_url || undefined}
      tokenCache={Platform.OS === 'web' ? undefined : tokenCache}
    >
      <ClerkAppProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </SafeAreaProvider>
      </ClerkAppProvider>
    </ClerkProvider>
  );
}

export default function RootLayout() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/clerk/config`);
      if (!response.ok) throw new Error(`Backend returned ${response.status} from ${BACKEND_URL}.`);
      const result = await response.json();
      setConfig(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} (Backend URL: ${BACKEND_URL})`
          : 'Could not load Safar configuration.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (!config) return <ConfigScreen error={error} retry={loadConfig} busy={busy} />;
  return <AuthenticatedLayout config={config} />;
}

const styles = StyleSheet.create({
  configScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 28,
    backgroundColor: colors.background,
  },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  message: { maxWidth: 420, color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { marginTop: 8, borderRadius: 16, backgroundColor: colors.foreground, paddingHorizontal: 22, paddingVertical: 13 },
  buttonText: { color: colors.white, fontWeight: '700' },
});

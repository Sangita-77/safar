import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import AppShell from './AppShell';
import AuthScreen from '../screens/AuthScreen';
import Landing from '../screens/customer/Landing';
import CustomerHome from '../screens/customer/CustomerHome';
import Book from '../screens/customer/Book';
import Trip from '../screens/customer/Trip';
import Trips from '../screens/customer/Trips';
import Account from '../screens/customer/Account';
import DriverApply from '../screens/customer/DriverApply';
import DriverHome from '../screens/driver/DriverHome';
import AdminOverview from '../screens/admin/AdminOverview';
import AdminDrivers from '../screens/admin/AdminDrivers';
import AdminBookings from '../screens/admin/AdminBookings';
import AdminFares from '../screens/admin/AdminFares';
import AdminUsers from '../screens/admin/AdminUsers';
import { colors } from '../theme';

const ROUTES = {
  landing: '/',
  auth: '/auth',
  'sign-in': '/auth',
  'sign-up': '/auth',
  CustomerHome: '/',
  'customer-home': '/',
  booking: '/book/[service]',
  trip: '/trip/[id]',
  trips: '/trips',
  account: '/account',
  'driver-apply': '/driver-apply',
  'driver-home': '/driver',
  'admin-overview': '/admin',
  'admin-drivers': '/admin/drivers',
  'admin-bookings': '/admin/bookings',
  'admin-fares': '/admin/fares',
  'admin-users': '/admin/users',
};

function routeParams(name, params = {}) {
  if (name === 'booking') return { service: params.service || 'ride', pick: params.pick };
  if (name === 'trip') return { id: params.id };
  if (name === 'auth' || name === 'sign-in' || name === 'sign-up') {
    const out = { mode: params.mode || (name === 'sign-up' ? 'sign-up' : 'sign-in') };
    if (params.intent) out.intent = params.intent;
    return out;
  }
  return params;
}

export function navigateTo(router, name, params) {
  const pathname = ROUTES[name] || ROUTES[String(name).toLowerCase()];
  if (!pathname) return;
  router.push({ pathname, params: routeParams(name, params) });
}

export function LoadingScreen({ message = 'Loading Safar…' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.green} size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

export function ErrorScreen({ message, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>We couldn't load your Safar account.</Text>
      <Text style={styles.message}>{message}</Text>
      <Text accessibilityRole="button" onPress={onRetry} style={styles.retry}>Tap to retry</Text>
    </View>
  );
}

export default function ScreenRenderer({ screen, params = {} }) {
  const router = useRouter();
  const context = useApp();
  const { api, me, meLoading, meError, isSignedIn, refreshMe, retryMe, signOut, getCurrentLocation, locationError } = context;
  const onNavigate = (name, nextParams) => navigateTo(router, name, nextParams);
  const onBack = () => router.canGoBack() ? router.back() : router.replace('/');
  const sharedProps = {
    api,
    me,
    onNavigate,
    onBack,
    params: { ...params, getCurrentLocation },
    onRefreshMe: refreshMe,
    onSignOut: signOut,
  };

  if (screen === 'auth') return <AuthScreen />;
  if (screen === 'landing') {
    if (isSignedIn && me) return <Redirect href="/" />;
    return <Landing {...sharedProps} />;
  }
  if (!isSignedIn) return <Redirect href="/" />;
  if (meLoading) return <LoadingScreen />;
  if (meError || !me) return <ErrorScreen message={meError?.message || 'Account data is unavailable.'} onRetry={retryMe} />;

  const screens = {
    home: me.role === 'admin' ? AdminOverview : me.role === 'driver' ? DriverHome : CustomerHome,
    'customer-home': CustomerHome,
    booking: Book,
    trip: Trip,
    trips: Trips,
    account: Account,
    'driver-apply': DriverApply,
    'driver-home': DriverHome,
    'admin-overview': AdminOverview,
    'admin-drivers': AdminDrivers,
    'admin-bookings': AdminBookings,
    'admin-fares': AdminFares,
    'admin-users': AdminUsers,
  };
  const Screen = screens[screen];
  if (!Screen) return <Redirect href="/" />;
  return (
    <AppShell me={me} onNavigate={onNavigate} locationError={locationError}>
      <Screen {...sharedProps} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24, backgroundColor: colors.background },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errorTitle: { color: colors.foreground, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  retry: { marginTop: 6, color: colors.green, fontWeight: '800' },
});

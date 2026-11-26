import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';

const TABS = {
  customer: [
    ['Home', 'CustomerHome'],
    ['Trips', 'trips'],
    ['Account', 'account'],
  ],
  driver: [
    ['Drive', 'driver-home'],
    ['Earnings', 'trips'],
    ['Account', 'account'],
  ],
  admin: [
    ['Overview', 'admin-overview'],
    ['Drivers', 'admin-drivers'],
    ['Bookings', 'admin-bookings'],
    ['Pricing', 'admin-fares'],
    ['Users', 'admin-users'],
    ['Account', 'account'],
  ],
};

export default function AppShell({ me, onNavigate, children, locationError }) {
  const { signOut } = useApp();
  const tabs = TABS[me?.role] || TABS.customer;
  const roleBadge = me?.role === 'admin' ? 'Super admin' : me?.role === 'driver' ? 'Driver partner' : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
        <Text style={styles.brand}>Safar</Text>
        {roleBadge ? (
          <View style={[styles.roleBadge, me?.role === 'admin' && styles.roleBadgeAdmin]}>
            <Text style={[styles.roleBadgeText, me?.role === 'admin' && styles.roleBadgeTextAdmin]}>{roleBadge}</Text>
          </View>
        ) : null}
        <View style={styles.userArea}>
          <Text numberOfLines={1} style={styles.user}>{me?.name || me?.email || ''}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() => signOut?.()}
            style={styles.signOutBtn}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      {me?.role === 'driver' && me.driver?.online && locationError ? (
        <Text accessibilityRole="alert" style={styles.locationError}>{locationError}</Text>
      ) : null}
      <View style={styles.content}>{children}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map(([label, target]) => (
          <Pressable
            key={target}
            accessibilityRole="button"
            onPress={() => onNavigate(target)}
            style={styles.tab}
          >
            <Text style={styles.tabText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  logo: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.foreground, fontSize: 19, fontWeight: '900' },
  brand: { color: colors.foreground, fontSize: 20, fontWeight: '900' },
  roleBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: '#DDF3E6',
  },
  roleBadgeAdmin: {
    backgroundColor: '#FFF1C2',
  },
  roleBadgeText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
  },
  roleBadgeTextAdmin: {
    color: colors.foreground,
  },
  userArea: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  user: { maxWidth: 160, color: colors.muted, fontSize: 12, textAlign: 'right', fontWeight: '600' },
  signOutBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#E8EEE9',
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  locationError: { paddingHorizontal: 18, paddingVertical: 8, color: colors.danger, backgroundColor: '#FEE2E2', fontSize: 12 },
  tabs: { flexGrow: 1, justifyContent: 'space-around', paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.card },
  tab: { minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 7 },
  tabText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
});

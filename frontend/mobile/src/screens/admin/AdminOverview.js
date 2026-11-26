import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const COLORS = { dark: "#0E1A1F", green: "#0F8A55", background: "#F6F7F2", gold: "#FFB800", white: "#FFFFFF", muted: "#687579", border: "#DCE3DF" };
const inr = (value) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

function Stat({ label, value, dark }) {
  return (
    <View style={[styles.stat, dark && styles.statDark]}>
      <Text style={[styles.statLabel, dark && styles.statLabelDark]}>{label}</Text>
      <Text style={[styles.statValue, dark && styles.statValueDark]}>{value ?? 0}</Text>
    </View>
  );
}

export default function AdminOverview({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const response = await api.get("/admin/stats");
      setStats(response.data || {});
      setFailed(false);
    } catch (error) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const maxBookings = Math.max(1, ...(stats?.daily || []).map((item) => Number(item.bookings || 0)));
  const serviceEntries = Object.entries(stats?.by_service || {});
  const total = Number(stats?.bookings_total || 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Overview</Text>
      {loading && !stats ? (
        <ActivityIndicator style={styles.loader} color={COLORS.green} />
      ) : failed && !stats ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>Dashboard stats couldn't be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <Stat dark label="Gross revenue" value={inr(stats?.gross_revenue)} />
            <Stat label="Platform earnings" value={inr(stats?.platform_earnings)} />
            <Stat label="Total bookings" value={stats?.bookings_total} />
            <Stat label="Active now" value={stats?.bookings_active} />
            <Stat label="Customers" value={stats?.customers} />
            <Stat label="Drivers approved" value={stats?.drivers_approved} />
            <Stat label="Pending approval" value={stats?.drivers_pending} />
            <Stat label="Drivers online" value={stats?.drivers_online} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Bookings · last 7 days</Text>
            <View style={styles.chart}>
              {(stats?.daily || []).map((item, index) => {
                const count = Number(item.bookings || 0);
                return (
                  <View key={`${item.day}-${index}`} style={styles.barColumn}>
                    <Text style={styles.barCount}>{count}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${Math.max(4, (count / maxBookings) * 100)}%` }]} />
                    </View>
                    <Text numberOfLines={1} style={styles.barLabel}>{item.day}</Text>
                  </View>
                );
              })}
              {!(stats?.daily || []).length && <Text style={styles.bodyText}>No daily booking data.</Text>}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>By service</Text>
            {serviceEntries.length ? serviceEntries.map(([service, count]) => {
              const percent = total ? Math.min(100, (Number(count || 0) / total) * 100) : 0;
              return (
                <View key={service} style={styles.serviceRow}>
                  <View style={styles.serviceLabels}>
                    <Text style={styles.serviceName}>{service}</Text>
                    <Text style={styles.serviceCount}>{count}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${percent}%` }]} />
                  </View>
                </View>
              );
            }) : <Text style={styles.bodyText}>No service totals available.</Text>}
            <Text style={styles.footerText}>{stats?.bookings_completed || 0} completed · {stats?.bookings_cancelled || 0} cancelled</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  title: { color: COLORS.dark, fontSize: 30, fontWeight: "900", marginBottom: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", minHeight: 94, flexGrow: 1, backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 19, padding: 14 },
  statDark: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  statLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  statLabelDark: { color: "#CFD8D6" },
  statValue: { color: COLORS.dark, fontSize: 23, fontWeight: "900", marginTop: 5 },
  statValueDark: { color: COLORS.white },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 22, padding: 16 },
  sectionTitle: { color: COLORS.dark, fontSize: 17, fontWeight: "800" },
  chart: { minHeight: 170, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", gap: 4, paddingTop: 18 },
  barColumn: { flex: 1, alignItems: "center", height: 150, justifyContent: "flex-end" },
  barCount: { color: COLORS.muted, fontSize: 10, marginBottom: 4 },
  barTrack: { width: "70%", height: 106, justifyContent: "flex-end", backgroundColor: "#F1F3EE", borderRadius: 8, overflow: "hidden" },
  bar: { width: "100%", backgroundColor: COLORS.gold, borderTopLeftRadius: 8, borderTopRightRadius: 8, minHeight: 4 },
  barLabel: { color: COLORS.muted, fontSize: 10, marginTop: 6, maxWidth: "100%" },
  serviceRow: { marginTop: 14 },
  serviceLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  serviceName: { color: COLORS.dark, fontSize: 14, textTransform: "capitalize" },
  serviceCount: { color: COLORS.dark, fontSize: 14, fontWeight: "800" },
  progressTrack: { height: 8, backgroundColor: "#E9EDE8", borderRadius: 20, overflow: "hidden" },
  progressBar: { height: 8, backgroundColor: COLORS.green, borderRadius: 20 },
  footerText: { color: COLORS.muted, fontSize: 12, marginTop: 18 },
  bodyText: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  retryButton: { marginTop: 12, paddingVertical: 10 },
  retryText: { color: COLORS.green, fontWeight: "800" },
  loader: { marginTop: 30 },
});

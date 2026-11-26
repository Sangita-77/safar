import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const COLORS = { dark: "#0E1A1F", green: "#0F8A55", background: "#F6F7F2", white: "#FFFFFF", muted: "#687579", border: "#DCE3DF" };
const STATUSES = ["", "searching", "accepted", "arrived", "ongoing", "completed", "cancelled"];
const SERVICES = ["", "ride", "parcel", "rental"];
const inr = (value) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const fmtDate = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const statusLabel = (status) => ({
  searching: "Finding your driver",
  accepted: "Driver on the way",
  arrived: "Driver has arrived",
  ongoing: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
}[status] || status || "Unknown");
const statusColor = (status) => ({
  searching: ["#FFF4D6", "#745300"],
  accepted: ["#E1F2F9", "#155B77"],
  arrived: ["#EAE6FA", "#4D3B83"],
  ongoing: ["#DDF3E6", COLORS.green],
  completed: ["#E9ECE9", COLORS.dark],
  cancelled: ["#FBE6E4", "#A3261C"],
}[status] || ["#E9ECE9", COLORS.dark]);

function FilterGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option || "all"}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option || `All ${label.toLowerCase()}`}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AdminBookings({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const response = await api.get("/admin/bookings", {
        params: { status: status || undefined, service: service || undefined },
      });
      setBookings(Array.isArray(response.data) ? response.data : []);
      setFailed(false);
    } catch (error) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api, status, service]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>All bookings</Text>
      <FilterGroup label="Statuses" options={STATUSES} value={status} onChange={setStatus} />
      <FilterGroup label="Services" options={SERVICES} value={service} onChange={setService} />
      {loading && !bookings.length ? <ActivityIndicator style={styles.loader} color={COLORS.green} /> : failed && !bookings.length ? (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>Bookings couldn't be loaded.</Text><Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>No bookings found.</Text></View>
      ) : bookings.map((booking) => {
        const tone = statusColor(booking.status);
        return (
          <Pressable
            key={booking.id}
            accessibilityRole="button"
            accessibilityLabel={`Booking ${booking.code}, ${booking.status}, ${inr(booking.fare)}`}
            onPress={() => onNavigate?.("trip", { id: booking.id })}
            style={({ pressed }) => [styles.bookingCard, pressed && styles.pressed]}
          >
            <View style={styles.bookingHeader}>
              <Text style={styles.bookingTitle}>#{booking.code} · {booking.vehicle_label || "Trip"}</Text>
              <Text style={styles.fare}>{inr(booking.fare)}</Text>
            </View>
            <Text style={styles.dateText}>{fmtDate(booking.created_at)}</Text>
            <Text style={styles.address} numberOfLines={3}>
              {booking.pickup?.address || "Pickup unavailable"}{booking.drop?.address ? `  →  ${booking.drop.address}` : ""}
            </Text>
            <Text style={styles.peopleText}>Customer: <Text style={styles.strong}>{booking.customer_name || "—"}</Text> · Driver: <Text style={styles.strong}>{booking.driver?.name || "—"}</Text></Text>
            <View style={styles.bookingFooter}>
              <View style={[styles.statusBadge, { backgroundColor: tone[0] }]}>
                <Text style={[styles.statusText, { color: tone[1] }]}>{statusLabel(booking.status)}</Text>
              </View>
              <Text style={styles.paymentText}>{booking.payment_method || "—"} · {booking.payment_status || "—"}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36 },
  title: { color: COLORS.dark, fontSize: 29, fontWeight: "900", marginBottom: 12 },
  filterGroup: { marginBottom: 10 },
  filterLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 7 },
  chipRow: { gap: 7, paddingRight: 18 },
  chip: { backgroundColor: "#E8ECE8", borderRadius: 30, minHeight: 38, justifyContent: "center", paddingHorizontal: 13 },
  chipSelected: { backgroundColor: COLORS.dark },
  chipText: { color: COLORS.dark, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  chipTextSelected: { color: COLORS.white },
  bookingCard: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 20, padding: 15, marginTop: 10 },
  bookingHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  bookingTitle: { flex: 1, color: COLORS.dark, fontSize: 15, fontWeight: "800" },
  fare: { color: COLORS.dark, fontSize: 18, fontWeight: "900" },
  dateText: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  address: { color: COLORS.dark, fontSize: 13, lineHeight: 19, marginTop: 12 },
  peopleText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  strong: { color: COLORS.dark, fontWeight: "700" },
  bookingFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 },
  statusBadge: { borderRadius: 25, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 11, fontWeight: "700" },
  paymentText: { color: COLORS.muted, fontSize: 11, textTransform: "capitalize", textAlign: "right", flexShrink: 1 },
  emptyCard: { padding: 24, marginTop: 12, backgroundColor: COLORS.white, borderRadius: 20, borderColor: COLORS.border, borderWidth: 1 },
  emptyText: { color: COLORS.muted, fontSize: 14, textAlign: "center" },
  retry: { alignSelf: "center", padding: 12 },
  retryText: { color: COLORS.green, fontWeight: "800" },
  loader: { marginTop: 28 },
  pressed: { opacity: 0.76 },
});

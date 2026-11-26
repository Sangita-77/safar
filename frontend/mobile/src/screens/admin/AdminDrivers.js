import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const COLORS = { dark: "#0E1A1F", green: "#0F8A55", background: "#F6F7F2", white: "#FFFFFF", muted: "#687579", border: "#DCE3DF", red: "#B42318" };
const FILTERS = ["pending", "approved", "rejected"];
const fmtDate = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
const errorMessage = (error) => {
  if (!error?.response) return "You're offline or the server is unreachable. Please retry.";
  const detail = error.response.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  return detail || "Something went wrong";
};

function DriverCard({ driver, busy, onDecision }) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.identity}>
          <Text style={styles.name}>{driver.name || driver.email || "Driver"}</Text>
          <Text style={styles.contact}>{driver.email || "—"}{driver.phone ? ` · ${driver.phone}` : ""}{driver.city ? ` · ${driver.city}` : ""}</Text>
        </View>
        {driver.status === "approved" && (
          <View style={[styles.onlinePill, driver.online && styles.onlinePillActive]}>
            <Text style={[styles.onlineText, driver.online && styles.onlineTextActive]}>{driver.online ? "Online" : "Offline"}</Text>
          </View>
        )}
      </View>
      <View style={styles.details}>
        <Detail label="Vehicle" value={`${driver.vehicle_type || "—"} · ${driver.vehicle_model || "—"}`} />
        <Detail label="Reg. no." value={driver.vehicle_number || "—"} />
        <Detail label="Licence" value={driver.license_number || "—"} />
        <Detail label="Applied" value={fmtDate(driver.applied_at)} />
      </View>
      {!!driver.rating && (
        <Text style={styles.rating}>★ {driver.rating} ({driver.ratings_count || 0} ratings)</Text>
      )}
      <View style={styles.actions}>
        {driver.status !== "approved" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Approve ${driver.name || "driver"}`}
            disabled={busy}
            onPress={() => onDecision(true)}
            style={({ pressed }) => [styles.approveButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.buttonText}>{busy ? "Updating…" : "Approve"}</Text>
          </Pressable>
        )}
        {driver.status !== "rejected" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${driver.status === "approved" ? "Suspend" : "Reject"} ${driver.name || "driver"}`}
            disabled={busy}
            onPress={() => onDecision(false)}
            style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.rejectText}>{driver.status === "approved" ? "Suspend" : "Reject"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function AdminDrivers({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const [status, setStatus] = useState("pending");
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const response = await api.get("/admin/drivers", { params: { status } });
      setDrivers(Array.isArray(response.data) ? response.data : []);
      setFailed(false);
    } catch (error) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => { load(); }, [load]);

  const decide = async (driver, approve) => {
    if (!api || busyId != null) return;
    setBusyId(driver.user_id);
    try {
      await api.post(`/admin/drivers/${driver.user_id}/decision`, { approve });
      Alert.alert(approve ? "Driver approved" : "Driver updated", approve ? "The driver can now accept trips." : "The driver status has been updated.");
      await load();
    } catch (error) {
      Alert.alert("Couldn't update driver", errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Driver partners</Text>
      <View accessibilityLabel="Driver status filters" style={styles.filters}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter}
            accessibilityRole="tab"
            accessibilityState={{ selected: status === filter }}
            onPress={() => setStatus(filter)}
            style={({ pressed }) => [styles.filter, status === filter && styles.filterSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.filterText, status === filter && styles.filterTextSelected]}>{filter}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={COLORS.green} /> : failed ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Driver list couldn't be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : drivers.length === 0 ? (
        <View style={styles.card}><Text style={styles.emptyText}>No {status} drivers.</Text></View>
      ) : drivers.map((driver) => (
        <DriverCard
          key={driver.user_id}
          driver={driver}
          busy={busyId === driver.user_id}
          onDecision={(approve) => decide(driver, approve)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36 },
  title: { color: COLORS.dark, fontSize: 29, fontWeight: "900", marginBottom: 16 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filter: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, backgroundColor: "#E8ECE8", minHeight: 42, justifyContent: "center" },
  filterSelected: { backgroundColor: COLORS.dark },
  filterText: { color: COLORS.dark, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  filterTextSelected: { color: COLORS.white },
  card: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  identity: { flex: 1 },
  name: { color: COLORS.dark, fontSize: 17, fontWeight: "800" },
  contact: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  onlinePill: { backgroundColor: "#EDF0ED", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  onlinePillActive: { backgroundColor: "#DDF3E6" },
  onlineText: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  onlineTextActive: { color: COLORS.green },
  details: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, rowGap: 12 },
  detail: { width: "50%", paddingRight: 8 },
  detailLabel: { color: COLORS.muted, fontSize: 11 },
  detailValue: { color: COLORS.dark, fontSize: 13, fontWeight: "700", marginTop: 3 },
  rating: { color: "#8A6400", fontSize: 12, fontWeight: "700", marginTop: 12 },
  actions: { flexDirection: "row", gap: 9, marginTop: 16 },
  approveButton: { flex: 1, minHeight: 46, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.green, borderRadius: 13 },
  buttonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  rejectButton: { flex: 1, minHeight: 46, justifyContent: "center", alignItems: "center", borderColor: "#E6B9B5", borderWidth: 1, borderRadius: 13 },
  rejectText: { color: COLORS.red, fontWeight: "800", fontSize: 14 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  loader: { marginTop: 30 },
  emptyText: { color: COLORS.muted, textAlign: "center", fontSize: 14, lineHeight: 20 },
  retry: { alignSelf: "center", padding: 12 },
  retryText: { color: COLORS.green, fontWeight: "800" },
});

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

const COLORS = {
  dark: "#0E1A1F",
  green: "#0F8A55",
  background: "#F6F7F2",
  gold: "#FFB800",
  white: "#FFFFFF",
  muted: "#687579",
  border: "#DCE3DF",
  red: "#B42318",
};

const inr = (value) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
const errorMessage = (error) => {
  if (!error?.response) {
    if (!error?.isAxiosError && error?.message) return error.message;
    return "You're offline or the server is unreachable. Please retry.";
  }
  const detail = error.response.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  return detail || "Something went wrong";
};

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatusBadge({ status }) {
  const label = {
    searching: "Finding driver",
    accepted: "Driver on the way",
    arrived: "Driver has arrived",
    ongoing: "On trip",
    completed: "Completed",
    cancelled: "Cancelled",
  }[status] || status || "Unknown";
  return (
    <View accessible accessibilityLabel={`Trip status: ${label}`} style={styles.statusBadge}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function RequestCard({ request, busy, onAccept }) {
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>
          {request.vehicle_label}
          {request.service === "parcel" ? " · Parcel" : request.service === "rental" ? ` · ${request.hours} hrs` : ""}
        </Text>
        <Text style={styles.requestFare}>{inr(Math.round(Number(request.fare || 0) * 0.8))}</Text>
      </View>
      <Text style={styles.earnHint}>your earnings · 80% of fare</Text>
      <View style={styles.locationRow}>
        <Text style={styles.locationDot}>●</Text>
        <Text style={styles.locationText}>{request.pickup?.address || "Pickup location unavailable"}</Text>
      </View>
      {!!request.drop?.address && (
        <View style={styles.locationRow}>
          <Text style={[styles.locationDot, styles.dropDot]}>●</Text>
          <Text style={styles.locationText}>{request.drop.address}</Text>
        </View>
      )}
      <Text style={styles.metaText}>
        {request.distance_km > 0 ? `${request.distance_km} km trip · ` : ""}
        {request.pickup_km != null ? `${request.pickup_km} km away · ` : ""}
        {request.payment_method === "cash" ? "Cash" : "Online"}
        {fmtDate(request.created_at) ? ` · ${fmtDate(request.created_at)}` : ""}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Accept trip request ${request.id}`}
        disabled={busy}
        onPress={onAccept}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
      >
        {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Accept request</Text>}
      </Pressable>
    </Card>
  );
}

function NotApproved({ driver, onNavigate }) {
  const pending = driver?.status === "pending";
  return (
    <View style={styles.centeredWrap}>
      <Card style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>
          {pending ? "Verification in progress" : driver?.status === "rejected" ? "Update your driver profile" : "Complete your driver profile"}
        </Text>
        <Text style={styles.bodyText}>
          {pending
            ? "You'll be able to go online once our team approves your documents."
            : driver?.status === "rejected"
              ? "Your application needs updated details. Review your vehicle and licence information to get started."
              : "Add your vehicle and licence details to start receiving trips."}
        </Text>
        {!pending && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigate?.("driver-apply")}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Add or update details</Text>
          </Pressable>
        )}
      </Card>
    </View>
  );
}

export default function DriverHome({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const approved = me?.driver?.status === "approved";
  const [online, setOnline] = useState(!!me?.driver?.online);
  const [active, setActive] = useState(null);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({});
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [pollError, setPollError] = useState('');

  useEffect(() => {
    setOnline(!!me?.driver?.online);
  }, [me?.driver?.online]);

  const loadActive = useCallback(async (showLoading = false) => {
    if (!api || !approved) return;
    if (showLoading) setLoadingActive(true);
    try {
      const response = await api.get("/driver/active");
      setActive(response.data || null);
      setPollError('');
    } catch (error) {
      setPollError(errorMessage(error));
    } finally {
      if (showLoading) setLoadingActive(false);
    }
  }, [api, approved]);

  const loadRequests = useCallback(async (showLoading = false) => {
    if (!api || !approved || !online || active) {
      setRequests([]);
      return;
    }
    if (showLoading) setLoadingRequests(true);
    try {
      const response = await api.get("/driver/requests");
      setRequests(Array.isArray(response.data) ? response.data : []);
      setPollError('');
    } catch (error) {
      setPollError(errorMessage(error));
    } finally {
      if (showLoading) setLoadingRequests(false);
    }
  }, [api, approved, online, active]);

  useEffect(() => {
    if (!approved || !api) return undefined;
    let mounted = true;
    const fetchSummary = async () => {
      try {
        const response = await api.get("/driver/trips");
        if (mounted) {
          setSummary(response.data?.summary || {});
          setPollError('');
        }
      } catch (error) {
        if (mounted) setPollError(errorMessage(error));
      }
    };
    fetchSummary();
    return () => {
      mounted = false;
    };
  }, [api, approved]);

  useEffect(() => {
    if (!approved || !api) return undefined;
    loadActive(true);
    const timer = setInterval(() => loadActive(), 8000);
    return () => clearInterval(timer);
  }, [api, approved, loadActive]);

  useEffect(() => {
    if (!approved || !api || !online || active) {
      setRequests([]);
      return undefined;
    }
    loadRequests(true);
    const timer = setInterval(() => loadRequests(), 5000);
    return () => clearInterval(timer);
  }, [api, approved, online, active, loadRequests]);

  const toggleOnline = async (value) => {
    if (!api || busy) return;
    const previous = online;
    setOnline(value);
    setBusy(true);
    try {
      await api.post("/driver/status", { online: value });
      await onRefreshMe?.();
    } catch (error) {
      setOnline(previous);
      Alert.alert("Couldn't update status", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const acceptRequest = async (id) => {
    if (!api || acceptingId != null) return;
    setAcceptingId(id);
    try {
      const response = await api.post(`/driver/bookings/${id}/accept`);
      const booking = response.data;
      Alert.alert("Trip accepted", "This trip has been added to your active trips.");
      await loadActive(true);
      await loadRequests();
      onNavigate?.("trip", { id: booking?.id || id });
    } catch (error) {
      Alert.alert("Couldn't accept trip", errorMessage(error));
      await loadRequests();
    } finally {
      setAcceptingId(null);
    }
  };

  if (!approved) return <NotApproved driver={me?.driver} onNavigate={onNavigate} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.onlinePanel, online && styles.onlinePanelActive]}>
        <View style={styles.rowBetween}>
          <View style={styles.statusCopy}>
            <Text style={styles.onlineHeading}>{online ? "You're online" : "You're offline"}</Text>
            <Text style={styles.onlineSubheading}>
              {online ? "Receiving trip requests near you" : "Go online to start earning"}
            </Text>
          </View>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel="Go online to receive trip requests"
            value={online}
            disabled={busy}
            onValueChange={toggleOnline}
            trackColor={{ false: "#8B989A", true: "#A8DEC1" }}
            thumbColor={online ? COLORS.green : COLORS.white}
          />
        </View>
        <View style={styles.earningsRow}>
          <View style={styles.earningsItem}>
            <Text style={styles.panelLabel}>Today's earnings</Text>
            <Text accessibilityLabel={`Today's earnings ${inr(summary.earnings_today)}`} style={styles.earningsValue}>
              {inr(summary.earnings_today)}
            </Text>
          </View>
          <View style={styles.earningsItem}>
            <Text style={styles.panelLabel}>Trips today</Text>
            <Text style={styles.earningsValue}>{summary.trips_today || 0}</Text>
          </View>
        </View>
      </View>

      {online && (
        <Text style={styles.locationNotice}>
          ● Keep this app open — your location is shared with customers during trips.
        </Text>
      )}
      {!!pollError && <Text accessibilityRole="alert" style={styles.pollError}>{pollError}</Text>}

      {active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open current trip"
          onPress={() => onNavigate?.("trip", { id: active.id })}
          style={({ pressed }) => [styles.activeTrip, pressed && styles.pressed]}
        >
          <View style={styles.flexOne}>
            <Text style={styles.cardTitle}>Current trip · {inr(active.fare)}</Text>
            <Text numberOfLines={2} style={styles.bodyText}>{active.pickup?.address || "Pickup location unavailable"}</Text>
          </View>
          <StatusBadge status={active.status} />
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : online ? (
        <View>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Trip requests</Text>
            {loadingActive && <ActivityIndicator size="small" color={COLORS.green} />}
          </View>
          {loadingRequests && requests.length === 0 ? (
            <ActivityIndicator style={styles.loader} color={COLORS.green} />
          ) : requests.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No requests right now. Hang tight — new trips appear here automatically.</Text>
            </Card>
          ) : (
            requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                busy={acceptingId != null}
                onAccept={() => acceptRequest(request.id)}
              />
            ))
          )}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>Switch online when you're ready to receive nearby trip requests.</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  centeredWrap: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 12 },
  noticeCard: { padding: 22, alignItems: "center" },
  noticeTitle: { color: COLORS.dark, fontSize: 21, fontWeight: "800", textAlign: "center" },
  bodyText: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  primaryButton: { backgroundColor: COLORS.green, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 14, paddingHorizontal: 16 },
  primaryButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
  onlinePanel: { backgroundColor: COLORS.dark, borderRadius: 24, padding: 20 },
  onlinePanelActive: { backgroundColor: COLORS.green },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  statusCopy: { flex: 1 },
  onlineHeading: { color: COLORS.white, fontSize: 23, fontWeight: "900" },
  onlineSubheading: { color: "#E5EFEA", fontSize: 14, marginTop: 4 },
  earningsRow: { flexDirection: "row", borderTopColor: "rgba(255,255,255,0.28)", borderTopWidth: 1, marginTop: 18, paddingTop: 14 },
  earningsItem: { flex: 1 },
  panelLabel: { color: "#D9E7E0", fontSize: 12, fontWeight: "600" },
  earningsValue: { color: COLORS.white, fontSize: 24, fontWeight: "900", marginTop: 4 },
  locationNotice: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  pollError: { color: COLORS.red, backgroundColor: '#FDE7E5', borderRadius: 12, padding: 11, fontSize: 12, lineHeight: 18 },
  activeTrip: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 20, borderWidth: 2, borderColor: COLORS.dark, backgroundColor: COLORS.white },
  flexOne: { flex: 1 },
  cardTitle: { color: COLORS.dark, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  statusBadge: { backgroundColor: "#E9F4ED", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: COLORS.green, fontWeight: "700", fontSize: 11 },
  chevron: { color: COLORS.dark, fontSize: 28, lineHeight: 30 },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sectionTitle: { color: COLORS.dark, fontSize: 21, fontWeight: "900" },
  loader: { marginTop: 22 },
  emptyCard: { paddingVertical: 24, alignItems: "center" },
  emptyText: { color: COLORS.muted, textAlign: "center", fontSize: 14, lineHeight: 21 },
  requestFare: { color: COLORS.dark, fontSize: 19, fontWeight: "900" },
  earnHint: { color: COLORS.muted, fontSize: 11, textAlign: "right", marginTop: -2 },
  locationRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 12, gap: 8 },
  locationDot: { color: COLORS.green, fontSize: 13, lineHeight: 19 },
  dropDot: { color: COLORS.red },
  locationText: { color: COLORS.dark, fontSize: 14, lineHeight: 20, flex: 1 },
  metaText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
});

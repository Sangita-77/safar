import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, Pressable, View } from "react-native";

const COLORS = { dark: "#0E1A1F", green: "#0F8A55", background: "#F6F7F2", white: "#FFFFFF", muted: "#687579", border: "#DCE3DF" };
const FIELDS = [
  { key: "base", label: "Base fare", services: ["ride", "parcel"] },
  { key: "per_km", label: "Per km", services: ["ride", "parcel"] },
  { key: "per_min", label: "Per min", services: ["ride", "parcel"] },
  { key: "per_hour", label: "Per hour", services: ["rental"] },
  { key: "min_fare", label: "Minimum fare", services: ["ride", "parcel", "rental"] },
];
const errorMessage = (error) => {
  if (!error?.response) return "You're offline or the server is unreachable. Please retry.";
  const detail = error.response.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  return detail || "Something went wrong";
};

function FareCard({ fare, api }) {
  const [draft, setDraft] = useState(() => ({ ...fare }));
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft({ ...fare }), [fare]);

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!api || saving) return;
    setSaving(true);
    try {
      await api.put(`/admin/fares/${fare.key}`, {
        base: Number(draft.base),
        per_km: Number(draft.per_km),
        per_min: Number(draft.per_min),
        min_fare: Number(draft.min_fare),
        per_hour: Number(draft.per_hour),
        active: !!draft.active,
      });
      Alert.alert("Pricing saved", `${fare.label} pricing has been updated.`);
    } catch (error) {
      Alert.alert("Couldn't save pricing", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const fields = FIELDS.filter((field) => field.services.includes(fare.service));

  return (
    <View style={styles.card}>
      <View style={styles.fareHeader}>
        <View style={styles.vehicleIcon} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.vehicleIconText}>{fare.vehicle === "bike" ? "B" : fare.vehicle === "erickshaw" ? "E" : fare.vehicle === "van" ? "V" : "C"}</Text>
        </View>
        <View style={styles.fareIdentity}>
          <Text style={styles.fareName}>{fare.label}</Text>
          <Text style={styles.fareMeta}>{fare.service} · {fare.vehicle}</Text>
        </View>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={`Enable ${fare.label} pricing`}
          value={!!draft.active}
          onValueChange={(value) => update("active", value)}
          trackColor={{ false: "#A5AFAC", true: "#A8DEC1" }}
          thumbColor={draft.active ? COLORS.green : COLORS.white}
        />
      </View>
      <View style={styles.fieldGrid}>
        {fields.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={styles.fieldLabel}>{field.label} (₹)</Text>
            <TextInput
              accessibilityLabel={`${fare.label} ${field.label} in rupees`}
              keyboardType="decimal-pad"
              value={draft[field.key] == null ? "" : String(draft[field.key])}
              onChangeText={(value) => update(field.key, value)}
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#9AA5A1"
            />
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={save}
        style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, saving && styles.disabled]}
      >
        {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>Save pricing</Text>}
      </Pressable>
    </View>
  );
}

export default function AdminFares({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const [fares, setFares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const response = await api.get("/fares");
      setFares(Array.isArray(response.data) ? response.data : []);
      setFailed(false);
    } catch (error) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pricing</Text>
      <Text style={styles.description}>
        Fare = max(minimum, base + per km × distance + per min × time). Rentals = per hour × hours. Platform commission: 20%.
      </Text>
      {loading ? <ActivityIndicator style={styles.loader} color={COLORS.green} /> : failed && !fares.length ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Pricing couldn't be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : fares.map((fare) => <FareCard key={fare.key} fare={fare} api={api} />)}
      {!loading && !failed && fares.length === 0 && <View style={styles.card}><Text style={styles.emptyText}>No fare options available.</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36 },
  title: { color: COLORS.dark, fontSize: 29, fontWeight: "900" },
  description: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 16 },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 12 },
  fareHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  vehicleIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: "#F1F3EE", justifyContent: "center", alignItems: "center" },
  vehicleIconText: { color: COLORS.green, fontSize: 18, fontWeight: "900" },
  fareIdentity: { flex: 1 },
  fareName: { color: COLORS.dark, fontSize: 16, fontWeight: "800" },
  fareMeta: { color: COLORS.muted, textTransform: "capitalize", fontSize: 12, marginTop: 3 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  field: { width: "47%", flexGrow: 1 },
  fieldLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  input: { height: 46, marginTop: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: "#FBFCF9", paddingHorizontal: 12, color: COLORS.dark, fontSize: 16 },
  saveButton: { minHeight: 46, borderRadius: 13, backgroundColor: COLORS.dark, alignItems: "center", justifyContent: "center", marginTop: 15 },
  saveText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  loader: { marginTop: 28 },
  emptyText: { color: COLORS.muted, textAlign: "center", fontSize: 14 },
  retry: { alignSelf: "center", padding: 12 },
  retryText: { color: COLORS.green, fontWeight: "800" },
});

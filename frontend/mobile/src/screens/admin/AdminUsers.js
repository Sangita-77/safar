import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const COLORS = { dark: "#0E1A1F", green: "#0F8A55", background: "#F6F7F2", white: "#FFFFFF", muted: "#687579", border: "#DCE3DF" };
const fmtDate = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
const errorMessage = (error) => {
  if (!error?.response) return "You're offline or the server is unreachable. Please retry.";
  const detail = error.response.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  return detail || "Something went wrong";
};

export default function AdminUsers({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
      setRoles(Array.isArray(response.data?.roles) ? response.data.roles : []);
      setFailed(false);
    } catch (error) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const setRole = async (user, role) => {
    if (!api || busyId != null || role === user.role) return;
    setBusyId(user.user_id);
    try {
      await api.patch(`/users/${user.user_id}/role`, { role });
      Alert.alert("Role updated", `${user.name || user.email || "User"} is now ${role}.`);
      await load();
    } catch (error) {
      Alert.alert("Couldn't update role", errorMessage(error));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Users</Text>
      <Text style={styles.description}>Drivers are normally added by approving their application on the Drivers page.</Text>
      {loading ? <ActivityIndicator style={styles.loader} color={COLORS.green} /> : failed && !users.length ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Users couldn't be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.card}><Text style={styles.emptyText}>No users found.</Text></View>
      ) : users.map((user) => {
        const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase() || "?";
        return (
          <View key={user.user_id} style={styles.card}>
            <View style={styles.userRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.userName}>{user.name || "—"}</Text>
                <Text numberOfLines={2} style={styles.userMeta}>
                  {user.email || "—"}{user.phone ? ` · ${user.phone}` : ""} · joined {fmtDate(user.created_at)}
                </Text>
              </View>
            </View>
            <Text style={styles.roleLabel}>User role</Text>
            <View style={styles.roles}>
              {roles.map((role) => {
                const selected = user.role === role;
                const disabled = busyId != null;
                return (
                  <Pressable
                    key={role}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    accessibilityLabel={`Set ${user.name || user.email || "user"} role to ${role}`}
                    disabled={disabled}
                    onPress={() => setRole(user, role)}
                    style={({ pressed }) => [styles.roleButton, selected && styles.roleSelected, pressed && styles.pressed, disabled && !selected && styles.disabled]}
                  >
                    {busyId === user.user_id && selected ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                      <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{role}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36 },
  title: { color: COLORS.dark, fontSize: 29, fontWeight: "900" },
  description: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 14 },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 21, padding: 15, marginBottom: 11 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 43, height: 43, borderRadius: 30, backgroundColor: "#E8ECE8", alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.dark, fontSize: 17, fontWeight: "800" },
  identity: { flex: 1 },
  userName: { color: COLORS.dark, fontSize: 15, fontWeight: "800" },
  userMeta: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  roleLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "700", marginTop: 15, marginBottom: 7 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  roleButton: { minHeight: 39, minWidth: 76, justifyContent: "center", alignItems: "center", paddingHorizontal: 13, borderRadius: 11, backgroundColor: "#EDF0ED", borderWidth: 1, borderColor: "#E1E6E1" },
  roleSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  roleText: { color: COLORS.dark, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  roleTextSelected: { color: COLORS.white },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  loader: { marginTop: 28 },
  emptyText: { color: COLORS.muted, textAlign: "center", fontSize: 14 },
  retry: { alignSelf: "center", padding: 12 },
  retryText: { color: COLORS.green, fontWeight: "800" },
});

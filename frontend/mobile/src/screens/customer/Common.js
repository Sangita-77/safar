import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export const C = { dark: "#0E1A1F", green: "#0F8A55", bg: "#F6F7F2", gold: "#FFB800", muted: "#66736F", border: "#DCE2DC", white: "#FFFFFF", red: "#B42318", pale: "#E8EEE9" };
export const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  title: { color: C.dark, fontSize: 28, lineHeight: 34, fontWeight: "800" }, subtitle: { color: C.muted, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 22, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 }, between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  text: { color: C.dark, fontSize: 15 }, small: { color: C.muted, fontSize: 12, lineHeight: 18 }, bold: { color: C.dark, fontSize: 15, fontWeight: "700" },
  button: { minHeight: 50, borderRadius: 16, paddingHorizontal: 18, backgroundColor: C.dark, alignItems: "center", justifyContent: "center" },
  buttonText: { color: C.white, fontWeight: "700", fontSize: 15 }, secondary: { backgroundColor: C.pale }, secondaryText: { color: C.dark, fontWeight: "700", fontSize: 14 },
  fieldLabel: { color: C.dark, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, borderRadius: 13, paddingHorizontal: 13, color: C.dark, fontSize: 16 },
  section: { color: C.dark, fontSize: 17, fontWeight: "800" }, divider: { height: 1, backgroundColor: C.border },
});
export function Page({ children, scroll = true }) {
  return <View style={S.page}>{scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={S.scroll}>{children}</ScrollView> : children}</View>;
}
export function Txt({ children, style, ...props }) { return <Text {...props} style={[{ color: C.dark, fontSize: 15 }, style]}>{children}</Text>; }
export function Button({ title, onPress, secondary = false, disabled = false, loading = false, style, accessibilityLabel }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} accessibilityState={{ disabled, busy: loading }} disabled={disabled || loading} onPress={onPress} style={[S.button, secondary && S.secondary, (disabled || loading) && { opacity: 0.55 }, style]}>
    {loading ? <ActivityIndicator color={secondary ? C.dark : C.white} /> : <Text style={secondary ? S.secondaryText : S.buttonText}>{title}</Text>}
  </Pressable>;
}
export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline = false, autoCapitalize = "sentences", accessibilityLabel, style, containerStyle, ...props }) {
  return <View style={containerStyle}><Text style={S.fieldLabel}>{label}</Text><TextInput accessibilityLabel={accessibilityLabel || label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#87928D" keyboardType={keyboardType} multiline={multiline} autoCapitalize={autoCapitalize} {...props} style={[S.input, multiline && { minHeight: 76, paddingTop: 12, textAlignVertical: "top" }, style]} /></View>;
}
export function Header({ title, onBack, right }) {
  return <View style={S.between}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} hitSlop={10}><Txt style={{ color: C.green, fontWeight: "800" }}>‹  Back</Txt></Pressable> : <View />}<Txt style={{ fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" }}>{title}</Txt>{right || <View style={{ width: 42 }} />}</View>;
}
export const inr = (n) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");
export const fmtDate = (v) => v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
export function errMsg(e) {
  if (!e?.response) {
    if (!e?.isAxiosError && e?.message) return e.message;
    return "You're offline or the server is unreachable. Please retry.";
  }
  const d = e.response.data?.detail;
  return Array.isArray(d) ? d.map((x) => x.msg).join(", ") : d || "Something went wrong";
}
export function feedback(title, message) {
  const { Alert, Platform } = require("react-native");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
export function confirmAction(title, message, onConfirm) {
  const { Alert, Platform } = require("react-native");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) {
      onConfirm?.();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: title, style: "destructive", onPress: onConfirm },
  ]);
}
export const STATUS = { searching: "Finding your driver", accepted: "Driver on the way", arrived: "Driver has arrived", ongoing: "On trip", completed: "Completed", cancelled: "Cancelled" };
export function Status({ status }) {
  const tone = status === "cancelled" ? "#FDE7E5" : status === "completed" ? "#E9EBE8" : "#FFF1C2";
  return <View accessibilityLabel={STATUS[status] || status} style={{ backgroundColor: tone, borderRadius: 30, paddingVertical: 6, paddingHorizontal: 11 }}><Txt style={{ fontSize: 12, fontWeight: "700" }}>{STATUS[status] || status}</Txt></View>;
}

import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Button, C, errMsg, fmtDate, inr, Page, S, Status, Txt } from "./Common";

const SERVICES = [
  { id: "car", title: "Cab", sub: "Mini, Sedan, SUV", icon: "🚕", service: "ride", pick: "car" },
  { id: "bike", title: "Bike", sub: "Beat the traffic", icon: "🏍️", service: "ride", pick: "bike" },
  { id: "erickshaw", title: "E-Rickshaw", sub: "Green & affordable", icon: "🛺", service: "ride", pick: "erickshaw" },
  { id: "parcel", title: "Parcel", sub: "Send anything", icon: "📦", service: "parcel" },
  { id: "rental", title: "Rentals", sub: "By the hour", icon: "🕒", service: "rental" },
];
export default function CustomerHomeScreen({ api, me, onNavigate, onBack, params, onRefreshMe, onSignOut }) {
  const [active, setActive] = useState(null), [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [activeResult, bookingsResult] = await Promise.allSettled([api.get("/bookings/active"), api.get("/bookings")]);
        if (!alive) return;
        const failures = [];
        if (activeResult.status === "fulfilled") setActive(activeResult.value.data);
        else failures.push(errMsg(activeResult.reason));
        if (bookingsResult.status === "fulfilled") setRows(bookingsResult.value.data || []);
        else failures.push(errMsg(bookingsResult.reason));
        setError(failures.join(" "));
      } catch (cause) {
        if (alive) setError(errMsg(cause));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load(); const timer = setInterval(load, 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [api]);
  return <Page>
    <View style={{ gap: 5 }}><Txt style={S.subtitle}>Namaste, {me?.name?.split(" ")[0] || "there"}</Txt><Txt style={S.title}>Where are you headed?</Txt></View>
    <Pressable accessibilityRole="button" onPress={() => onNavigate?.("booking", { service: "ride" })} style={[S.card, S.row, { backgroundColor: "#E8EEE9" }]}><Txt style={{ fontSize: 20 }}>⌕</Txt><Txt style={[S.text, { color: C.muted, fontWeight: "600" }]}>Search destination</Txt></Pressable>
    {active && <Pressable accessibilityRole="button" onPress={() => onNavigate?.("trip", { id: active.id })} style={[S.card, { backgroundColor: C.dark, borderColor: C.dark }]}>
      <View style={S.between}><Txt style={{ color: C.gold, fontWeight: "800" }}>●  Active booking</Txt><Status status={active.status} /></View>
      <Txt style={{ color: C.white, fontWeight: "800" }}>{active.vehicle_label} · {inr(active.fare)}</Txt><Txt style={{ color: "#D5DEDA" }} numberOfLines={1}>{active.pickup?.address}</Txt>
    </Pressable>}
    {!!error && <View style={[S.card, { backgroundColor: "#FDE7E5" }]}><Txt style={{ color: C.red }}>{error}</Txt></View>}
    <View style={S.between}><Txt style={S.section}>Choose a service</Txt></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{SERVICES.map((s, i) => <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.title}: ${s.sub}`} onPress={() => onNavigate?.("booking", { service: s.service, pick: s.pick })} style={[S.card, { width: i === 0 ? "100%" : "48%", minHeight: 125, justifyContent: "space-between" }]}><Txt style={{ fontSize: 29 }}>{s.icon}</Txt><View><Txt style={S.bold}>{s.title}</Txt><Txt style={S.small}>{s.sub}</Txt></View></Pressable>)}</View>
    <View style={[S.card, { backgroundColor: "#FFF1C2", borderColor: "#FFF1C2" }]}><Txt style={S.bold}>Ride safe</Txt><Txt style={S.text}>Share your 4-digit OTP only after meeting your driver and checking the vehicle number.</Txt></View>
    {rows.length > 0 && <View style={{ gap: 10 }}><View style={S.between}><Txt style={S.section}>Recent</Txt><Pressable onPress={() => onNavigate?.("trips")}><Txt style={{ color: C.green, fontWeight: "700" }}>See all</Txt></Pressable></View>
      <View style={S.card}>{rows.slice(0, 3).map((b, i) => <Pressable key={b.id} onPress={() => onNavigate?.("trip", { id: b.id })} style={[S.between, i > 0 && { borderTopWidth: 1, borderColor: C.border, paddingTop: 12 }]}><View style={{ flex: 1 }}><Txt style={S.bold} numberOfLines={1}>{b.drop?.address || b.pickup?.address}</Txt><Txt style={S.small}>{b.vehicle_label} · {fmtDate(b.created_at)}</Txt></View><Txt style={S.bold}>{inr(b.fare)}</Txt></Pressable>)}</View></View>}
    {loading && !active && <ActivityIndicator color={C.green} />}
    <Button title="Account & profile" secondary onPress={() => onNavigate?.("account")} />
  </Page>;
}

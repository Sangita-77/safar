import React from "react";
import { Pressable, View } from "react-native";
import { Button, C, Page, S, Txt } from "./Common";

const SERVICES = [["🚕", "Cab", "Mini, Sedan, SUV"], ["🏍️", "Bike", "Beat the traffic"], ["🛺", "E-Rickshaw", "Green & affordable"], ["📦", "Parcel", "Send across town"], ["🕒", "Rentals", "By the hour"]];
const POINTS = [["₹", "Upfront fares", "Know your fare before you book."], ["✓", "OTP-verified rides", "Your trip starts with a secure OTP."], ["♢", "Verified partners", "Partners and vehicles are checked."], ["◷", "Hourly rentals", "Keep a vehicle for 1 to 12 hours."]];
export default function LandingScreen({ api, me, onNavigate, onBack, params, onRefreshMe, onSignOut }) {
  return <Page>
    <View style={{ backgroundColor: C.dark, borderRadius: 28, padding: 22, gap: 17 }}>
      <View style={S.row}><View style={{ backgroundColor: C.gold, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 7 }}><Txt style={{ fontSize: 20, fontWeight: "900" }}>S</Txt></View><Txt style={{ color: C.white, fontSize: 21, fontWeight: "900" }}>Safar</Txt>
        <Pressable onPress={() => onNavigate?.("auth", { mode: "sign-in" })} style={{ marginLeft: "auto", padding: 10 }}><Txt style={{ color: C.white, fontWeight: "700" }}>Sign in</Txt></Pressable></View>
      <Txt style={{ color: C.gold, letterSpacing: 1.5, fontSize: 12, fontWeight: "800" }}>RIDES · PARCELS · RENTALS</Txt>
      <Txt style={{ color: C.white, fontSize: 36, lineHeight: 41, fontWeight: "900" }}>Move anything, anywhere in your city.</Txt>
      <Txt style={{ color: "#D5DEDA", fontSize: 15, lineHeight: 23 }}>Book a cab, bike or e-rickshaw, send a parcel, or rent a vehicle by the hour.</Txt>
      <Button title="Book your first ride  →" onPress={() => onNavigate?.("auth", { mode: "sign-up" })} style={{ backgroundColor: C.gold }} />
      <Button title="Drive & earn with Safar" secondary onPress={() => onNavigate?.("auth", { mode: "sign-up", intent: "driver" })} />
    </View>
    <Txt style={S.title}>One app, five ways to move</Txt>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{SERVICES.map(([icon, name, sub]) => <Pressable key={name} accessibilityRole="button" onPress={() => onNavigate?.("auth", { mode: "sign-up" })} style={[S.card, { width: "48%", minHeight: 112 }]}><Txt style={{ fontSize: 26 }}>{icon}</Txt><Txt style={S.bold}>{name}</Txt><Txt style={S.small}>{sub}</Txt></Pressable>)}</View>
    <View style={{ gap: 14, paddingVertical: 8 }}>{POINTS.map(([icon, title, text]) => <View key={title} style={S.row}><View style={{ backgroundColor: C.gold, width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" }}><Txt style={{ fontSize: 20, fontWeight: "800" }}>{icon}</Txt></View><View style={{ flex: 1 }}><Txt style={S.bold}>{title}</Txt><Txt style={S.small}>{text}</Txt></View></View>)}</View>
    <Txt style={[S.small, { textAlign: "center" }]}>© {new Date().getFullYear()} Safar Mobility · Fares in INR</Txt>
  </Page>;
}

import React from "react";
import { View } from "react-native";
import { Button, C, Page, S, Txt } from "./Common";
export default function AuthEntryScreen({ api, me, onNavigate, onBack, params, onRefreshMe, onSignOut }) {
  const mode = params?.mode === "sign-up" ? "Create your Safar account" : "Welcome back";
  return <Page><View style={[S.card, { marginTop: 40, padding: 24, gap: 18 }]}>
    <View style={{ backgroundColor: C.gold, width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" }}><Txt style={{ fontSize: 25, fontWeight: "900" }}>S</Txt></View>
    <Txt style={S.title}>{mode}</Txt>
    <Txt style={S.subtitle}>Sign in or create an account to book a Safar ride, parcel delivery or rental.</Txt>
    <Button title="Continue to sign in" onPress={() => onNavigate?.("sign-in", { mode: "sign-in" })} />
    <Button title="Create an account" secondary onPress={() => onNavigate?.("sign-up", { mode: "sign-up" })} />
    <Button title="Back to Safar" secondary onPress={onBack} />
    <Txt style={S.small}>Account verification is handled by the host application's configured authentication provider.</Txt>
  </View></Page>;
}

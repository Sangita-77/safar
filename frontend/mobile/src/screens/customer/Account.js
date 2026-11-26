import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, C, confirmAction, errMsg, feedback, Field, Page, S, Txt } from "./Common";

export default function AccountScreen({ api, me, onNavigate, onBack, params, onRefreshMe, onSignOut }) {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) setForm({ name: me.name || "", phone: me.phone || "" });
  }, [me]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/me", form);
      await onRefreshMe?.();
      feedback("Safar", "Profile saved.");
    } catch (e) {
      feedback("Couldn't save profile", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    confirmAction("Sign out", "Are you sure you want to sign out?", async () => {
      await onSignOut?.();
    });
  };

  const driver = me?.driver;
  return (
    <Page>
      <Txt style={S.title}>Account</Txt>
      {!me ? (
        <Txt style={S.subtitle}>Loading your account…</Txt>
      ) : (
        <>
          <View style={S.card}>
            <Txt style={S.small}>{me.email} · {me.role?.toUpperCase()}</Txt>
            <Field label="Full name" value={form.name} onChangeText={(name) => setForm((v) => ({ ...v, name }))} autoCapitalize="words" />
            <Field label="Mobile number" value={form.phone} onChangeText={(phone) => setForm((v) => ({ ...v, phone }))} keyboardType="phone-pad" placeholder="10-digit mobile" />
            <Button title="Save profile" onPress={save} disabled={!form.name} loading={busy} />
          </View>
          {me.role !== "admin" && (!driver || driver.status === "rejected") && (
            <Pressable accessibilityRole="button" onPress={() => onNavigate?.("driver-apply")} style={[S.card, { backgroundColor: C.dark, borderColor: C.dark }]}>
              <Txt style={{ color: C.gold, fontSize: 22 }}>🚘</Txt>
              <Txt style={{ color: C.white, fontSize: 18, fontWeight: "800" }}>{driver ? "Re-apply as driver partner" : "Drive & earn with Safar"}</Txt>
              <Txt style={{ color: "#D5DEDA" }}>{driver ? "Your last application was not approved." : "Keep 80% of every fare. Work when you want."}</Txt>
            </Pressable>
          )}
          {!!driver && driver.status !== "rejected" && (
            <View style={S.card}>
              <Txt style={S.bold}>Driver partner · {driver.status}</Txt>
              <Txt style={S.subtitle}>{driver.vehicle_model} · {driver.vehicle_number}</Txt>
              {driver.status === "pending" && <Txt style={S.small}>Our team is verifying your documents.</Txt>}
            </View>
          )}
          <Button title="Your trips" secondary onPress={() => onNavigate?.("trips")} />
          <Button title="Sign out" secondary onPress={handleSignOut} />
        </>
      )}
    </Page>
  );
}

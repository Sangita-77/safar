import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, C, errMsg, feedback, Field, Page, S, Txt } from "./Common";

const TYPES = [["bike", "Bike", "🏍️"], ["erickshaw", "E-Rickshaw", "🛺"], ["car", "Car", "🚕"], ["van", "Mini Van", "🚐"]];

export default function DriverApplyScreen({ api, me, onNavigate, onBack, params, onRefreshMe }) {
  const [f, setF] = useState({
    vehicle_type: "bike",
    vehicle_model: "",
    vehicle_number: "",
    license_number: "",
    phone: me?.phone || "",
    city: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.phone && !f.phone) setF((v) => ({ ...v, phone: me.phone }));
  }, [me]);

  const set = (key, value) => setF((v) => ({ ...v, [key]: value }));

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/driver/apply", f);
      await onRefreshMe?.();
      feedback("Safar", "Application submitted for verification. Once an admin approves your application, your account will switch to Driver mode.");
      onNavigate?.("account");
    } catch (e) {
      feedback("Application failed", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <View style={S.between}>
        <Pressable onPress={onBack || (() => onNavigate?.("account"))} accessibilityRole="button">
          <Txt style={{ color: C.green, fontWeight: "800" }}>‹ Back</Txt>
        </Pressable>
        <View style={{ width: 40 }} />
      </View>
      <Txt style={S.title}>Become a driver partner</Txt>
      <Txt style={S.subtitle}>Fill in your vehicle and licence details. Our team verifies them before you can go online.</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {TYPES.map(([id, label, icon]) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: f.vehicle_type === id }}
            onPress={() => set("vehicle_type", id)}
            style={[
              S.card,
              {
                width: "48%",
                alignItems: "center",
                borderColor: f.vehicle_type === id ? C.dark : C.border,
                borderWidth: f.vehicle_type === id ? 2 : 1,
              },
            ]}
          >
            <Txt style={{ fontSize: 30 }}>{icon}</Txt>
            <Txt style={S.bold}>{label}</Txt>
          </Pressable>
        ))}
      </View>
      <View style={S.card}>
        <Field label="Vehicle make & model" value={f.vehicle_model} onChangeText={(v) => set("vehicle_model", v)} placeholder="e.g. Maruti Dzire / Hero Splendor" />
        <Field label="Registration number" value={f.vehicle_number} onChangeText={(v) => set("vehicle_number", v.toUpperCase())} placeholder="e.g. DL01AB1234" autoCapitalize="characters" />
        <Field label="Driving licence number" value={f.license_number} onChangeText={(v) => set("license_number", v.toUpperCase())} placeholder="e.g. DL0420110012345" autoCapitalize="characters" />
        <Field label="Mobile number" value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="10-digit mobile number" />
        <Field label="City" value={f.city} onChangeText={(v) => set("city", v)} placeholder="e.g. New Delhi" />
      </View>
      <Button title="Submit application" onPress={submit} loading={busy} />
    </Page>
  );
}

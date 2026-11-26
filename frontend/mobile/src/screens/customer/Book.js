import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Button, C, errMsg, Field, feedback, inr, Page, S, Txt } from "./Common";
import NativeMap from "../../components/NativeMap";

const TITLES = { ride: "Book a ride", parcel: "Send a parcel", rental: "Rent by the hour" };
const HOURS = [1, 2, 4, 6, 8, 12];
const VEHICLES = { car: "🚕", bike: "🏍️", erickshaw: "🛺", van: "📦" };
function PlacePicker({ api, label, value, onChange, allowLocate, params, dot }) {
  const [query, setQuery] = useState(""), [results, setResults] = useState([]), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    let alive = true;
    const t = setTimeout(async () => { setLoading(true); try { const r = await api.get("/geo/search", { params: { q: query } }); if (alive) setResults(r.data || []); }
      catch (e) { feedback("Location search", errMsg(e)); } finally { if (alive) setLoading(false); } }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [query, api]);
  const locate = async () => {
    setLoading(true);
    try {
      let point = params?.currentLocation || params?.location;
      if (!point && typeof params?.getCurrentLocation === "function") point = await params.getCurrentLocation();
      const lat = point?.lat ?? point?.latitude ?? point?.coords?.latitude;
      const lon = point?.lon ?? point?.longitude ?? point?.coords?.longitude;
      if (lat == null || lon == null) { Alert.alert("Current location unavailable", "Allow location access in the Safar app to use your current location."); return; }
      const r = await api.get("/geo/reverse", { params: { lat, lon } }); onChange(r.data);
    }
    catch (e) { feedback("Could not find your location", errMsg(e)); }
    finally { setLoading(false); }
  };
  if (value) return <View style={[S.card, S.row]}><Txt style={{ color: dot, fontSize: 18 }}>●</Txt><View style={{ flex: 1 }}><Txt style={S.small}>{label}</Txt><Txt style={S.text}>{value.address}</Txt></View><Pressable accessibilityRole="button" accessibilityLabel={`Change ${label}`} onPress={() => { onChange(null); setQuery(""); }}><Txt style={{ color: C.green, fontWeight: "800" }}>Change</Txt></Pressable></View>;
  return <View style={{ gap: 8 }}><View style={[S.row, { borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.white, padding: 11 }]}><Txt style={{ color: dot }}>●</Txt><Field label="" accessibilityLabel={label} value={query} onChangeText={setQuery} placeholder={label} containerStyle={{ flex: 1 }} style={{ flex: 1 }} /><Txt style={S.small}>{loading ? "…" : ""}</Txt></View>
    {allowLocate && <Pressable accessibilityRole="button" onPress={locate}><Txt style={{ color: C.green, fontWeight: "700", paddingLeft: 8 }}>⌖  Use current location</Txt></Pressable>}
    {!!results.length && <View style={[S.card, { padding: 6, gap: 0 }]}>{results.map((r, i) => <Pressable key={`${r.lat}-${r.lon}-${i}`} accessibilityRole="button" onPress={() => { onChange(r); setResults([]); }} style={{ padding: 11, borderBottomWidth: i === results.length - 1 ? 0 : 1, borderColor: C.border }}><Txt>{r.address}</Txt></Pressable>)}</View>}
  </View>;
}

export default function BookingScreen({ api, me, onNavigate, onBack, params, onRefreshMe, onSignOut }) {
  const service = ["ride", "parcel", "rental"].includes(params?.service) ? params.service : "ride";
  const [pickup, setPickup] = useState(null), [drop, setDrop] = useState(null), [hours, setHours] = useState(2);
  const [parcel, setParcel] = useState({ receiver_name: "", receiver_phone: "", item: "", weight_kg: "1" });
  const [fares, setFares] = useState([]), [selected, setSelected] = useState(null), [method, setMethod] = useState("cash");
  const [pay, setPay] = useState({}), [estimating, setEstimating] = useState(false), [submitting, setSubmitting] = useState(false), [estimateError, setEstimateError] = useState("");
  const needsDrop = service !== "rental", ready = !!pickup && (!needsDrop || !!drop);
  useEffect(() => { api.get("/payments/config").then((r) => setPay(r.data || {})).catch(() => setPay({})); }, [api]);
  useEffect(() => {
    if (!ready) { setFares([]); setSelected(null); return; }
    let alive = true; setEstimating(true); setEstimateError("");
    api.post("/bookings/estimate", { service, pickup, drop: needsDrop ? drop : null, hours }).then((r) => {
      if (!alive) return; const list = r.data || []; setFares(list);
      setSelected((old) => old && list.some((x) => x.fare_key === old) ? old : (list.find((o) => o.vehicle === params?.pick) || list[0])?.fare_key || null);
    }).catch((e) => { if (alive) setEstimateError(errMsg(e)); }).finally(() => { if (alive) setEstimating(false); });
    return () => { alive = false; };
  }, [api, ready, service, pickup, drop, hours, params?.pick]);
  const choice = useMemo(() => fares.find((f) => f.fare_key === selected), [fares, selected]);
  const book = async () => {
    if (!choice) return;
    setSubmitting(true);
    try {
      const r = await api.post("/bookings", { service, pickup, drop: needsDrop ? drop : null, hours, fare_key: selected, payment_method: method,
        parcel: service === "parcel" ? { ...parcel, weight_kg: Number(parcel.weight_kg) || 1 } : null });
      Alert.alert("Booking confirmed", "Finding a driver…");
      onNavigate?.("trip", { id: r.data.id });
    } catch (e) { feedback("Booking failed", errMsg(e)); } finally { setSubmitting(false); }
  };
  return <Page>
    <View style={S.between}><Pressable onPress={onBack} accessibilityRole="button"><Txt style={{ color: C.green, fontWeight: "800" }}>‹ Back</Txt></Pressable><Txt style={S.title}>{TITLES[service]}</Txt><View style={{ width: 40 }} /></View>
    <View style={S.row}>{Object.keys(TITLES).map((s) => <Pressable key={s} onPress={() => onNavigate?.("booking", { service: s })} accessibilityRole="button" accessibilityState={{ selected: s === service }} style={{ paddingHorizontal: 15, paddingVertical: 9, borderRadius: 30, backgroundColor: s === service ? C.dark : "#E8EEE9" }}><Txt style={{ color: s === service ? C.white : C.dark, fontWeight: "700", textTransform: "capitalize" }}>{s}</Txt></Pressable>)}</View>
    <PlacePicker api={api} label="Pickup location" value={pickup} onChange={setPickup} allowLocate params={params} dot={C.green} />
    {needsDrop && <PlacePicker api={api} label={service === "parcel" ? "Delivery location" : "Where to?"} value={drop} onChange={setDrop} params={params} dot={C.red} />}
    {pickup && <NativeMap pickup={pickup} drop={needsDrop ? drop : null} />}
    {service === "rental" && <View style={S.card}><Txt style={S.section}>Choose rental package</Txt><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{HOURS.map((h) => <Pressable key={h} accessibilityRole="button" accessibilityState={{ selected: h === hours }} onPress={() => setHours(h)} style={{ borderRadius: 30, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: h === hours ? C.dark : C.pale }}><Txt style={{ color: h === hours ? C.white : C.dark, fontWeight: "700" }}>{h} hr{h > 1 ? "s" : ""}</Txt></Pressable>)}</View></View>}
    {service === "parcel" && <View style={S.card}><Txt style={S.section}>Receiver & package</Txt>
      {["receiver_name", "receiver_phone", "item", "weight_kg"].map((k) => <Field key={k} label={{ receiver_name: "Receiver name", receiver_phone: "Receiver phone", item: "What are you sending?", weight_kg: "Weight (kg)" }[k]} value={parcel[k]} onChangeText={(v) => setParcel({ ...parcel, [k]: v })} keyboardType={k === "receiver_phone" ? "phone-pad" : k === "weight_kg" ? "decimal-pad" : "default"} />)}
    </View>}
    {ready && <View style={{ gap: 10 }}><Txt style={S.section}>Choose a vehicle</Txt>{estimating && <Txt style={S.small}>Calculating estimates…</Txt>}
      {!!estimateError && <Txt style={{ color: C.red }}>{estimateError}</Txt>}
      {fares.map((o) => <Pressable key={o.fare_key} accessibilityRole="radio" accessibilityState={{ checked: o.fare_key === selected }} onPress={() => setSelected(o.fare_key)} style={[S.card, S.row, { borderColor: selected === o.fare_key ? C.dark : C.border, borderWidth: selected === o.fare_key ? 2 : 1 }]}>
        <Txt style={{ fontSize: 27 }}>{VEHICLES[o.vehicle] || "🚗"}</Txt><View style={{ flex: 1 }}><Txt style={S.bold}>{o.label}</Txt><Txt style={S.small}>{o.capacity > 0 ? `${o.capacity} seats · ` : ""}{o.distance_km > 0 ? `${o.distance_km} km · ~${o.duration_min} min · ` : ""}{o.drivers_online} nearby</Txt></View><Txt style={{ fontWeight: "900", fontSize: 17 }}>{inr(o.fare)}</Txt>
      </Pressable>)}
      <Txt style={S.section}>Payment</Txt><View style={S.row}>{[["cash", "Cash · Pay driver"], ["online", "UPI / Card"]].map(([id, label]) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: method === id, disabled: id === "online" && !pay.enabled }} disabled={id === "online" && !pay.enabled} onPress={() => setMethod(id)} style={[S.card, { flex: 1, opacity: id === "online" && !pay.enabled ? 0.5 : 1, borderColor: method === id ? C.dark : C.border }]}><Txt style={S.bold}>{label}</Txt>{id === "online" && !pay.enabled && <Txt style={S.small}>Coming soon</Txt>}</Pressable>)}</View>
      <Button title={choice ? `Book ${choice.label} · ${inr(choice.fare)}` : "Select a vehicle"} onPress={book} disabled={!choice} loading={submitting} />
    </View>}
  </Page>;
}

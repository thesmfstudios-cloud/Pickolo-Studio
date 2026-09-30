import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../shared/supabase";
import { api, API_BASE } from "../lib/api";
import {
  Brand,
  Button,
  Card,
  colors,
  Frame,
  Glyph,
  ui,
} from "../components/ui";
import ScheduleInput from "../components/schedule-input";
import VenueMap from "../components/venue-map";
type Item = { id: string; name: string };
const LEVELS = ["Basic", "Standard", "Professional"];
export default function Booking() {
  const params = useLocalSearchParams<{ service?: string }>();
  const [service, setService] = useState(params.service || "Photography");
  const [services, setServices] = useState<Item[]>([]);
  const [levels, setLevels] = useState<Item[]>([]);
  const [level, setLevel] = useState("Standard");
  const [minutes, setMinutes] = useState(120);
  const [when, setWhen] = useState("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const [timing, setTiming] = useState("upfront");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [advancedPin, setAdvancedPin] = useState(false);
  const [error, setError] = useState("");
  const creating = useRef(false);
  async function options() {
    try {
      if (!supabase) throw new Error("Please configure your connection.");
      const [a, b] = await Promise.all([
        supabase.from("services").select("id,name").eq("active", true),
        supabase.from("service_levels").select("id,name").eq("active", true),
      ]);
      if (a.error || b.error)
        throw new Error("Options could not load. Please retry.");
      setServices(a.data || []);
      setLevels(b.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your connection.");
    }
  }
  useEffect(() => {
    options();
  }, []);
  useEffect(() => {
    let active = true;
    setPrice(null);
    const selected = services.find((s) => s.name === service);
    if (!selected) return;
    fetch(
      API_BASE +
        "/api/pricing?level=" +
        level +
        "&duration=" +
        minutes +
        "&service=" +
        selected.id,
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Price unavailable.");
        if (active) {
          setPrice(d.totalPaise);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [service, level, minutes, services]);
  async function locate() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Allow location access or choose the venue on the map.",
        );
      const p = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLat(String(p.coords.latitude));
      setLng(String(p.coords.longitude));
    } catch (e) {
      Alert.alert(
        "Location pin",
        e instanceof Error ? e.message : "Could not read your location.",
      );
    } finally {
      setLocating(false);
    }
  }
  async function submit() {
    if (creating.current) return;
    setError("");
    const selected = services.find((s) => s.name === service),
      selectedLevel = levels.find((s) => s.name === level);
    const start =
      when === "now"
        ? new Date(Date.now() + 60000)
        : new Date(date + "T" + time + "+05:30");
    if (
      !selected ||
      !selectedLevel ||
      price === null ||
      address.trim().length < 3 ||
      !lat.trim() ||
      !lng.trim() ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lng)) ||
      Math.abs(Number(lat)) > 90 ||
      Math.abs(Number(lng)) > 180
    ) {
      Alert.alert(
        "Check your details",
        "Add the shoot address and a valid map pin. Wait for live pricing.",
      );
      return;
    }
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      Alert.alert("Choose a future time", "Schedule your shoot in India time.");
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (!ack) {
      Alert.alert("What’s included", "Please accept the original-file policy.");
      return;
    }
    creating.current = true;
    setBusy(true);
    try {
      const result = await api("/api/bookings", {
        service_id: selected.id,
        service_level_id: selectedLevel.id,
        scheduled_start: start.toISOString(),
        duration_minutes: minutes,
        location_text: address.trim(),
        location_lat: Number(lat),
        location_long: Number(lng),
        notes,
        raw_data_acknowledged: true,
      });
      if (timing === "after_shoot") {
        try {
          await api(
            "/api/bookings/" + result.booking.id + "/pay-after-shoot",
            {},
          );
        } catch {
          Alert.alert(
            "Booking saved",
            "Pay-after-shoot selection could not complete. Retry it from your saved booking.",
          );
        }
      }
      router.replace({
        pathname: "/booking-detail",
        params: { id: result.booking.id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking could not complete.");
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }
  return (
    <Frame key={step}>
      <Brand back step={step} />
      <Text style={[ui.title, { textAlign: "center", marginTop: 8 }]}>
        {step === 1
          ? "Plan your " +
            (service === "Both" ? "photo & video" : service.toLowerCase()) +
            " shoot"
          : "Review your booking"}
      </Text>
      <Text style={[ui.muted, { textAlign: "center", marginBottom: 28 }]}>
        {step === 1
          ? "It only takes a minute."
          : "Your moment, just the way you planned it."}
      </Text>
      {step === 1 ? (
        <>
          <View style={ui.section}>
            <Text style={ui.h2}>Coverage</Text>
            <View style={ui.row}>
              {["Photography", "Videography", "Both"].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityState={{ selected: service === n }}
                  onPress={() => setService(n)}
                  style={[ui.chip, service === n && ui.selected]}
                >
                  <Text style={[ui.chipText, service === n && ui.selectedText]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={ui.section}>
            <Text style={ui.h2}>When?</Text>
            <View style={ui.row}>
              {[
                ["now", "Book now"],
                ["later", "Schedule later"],
              ].map(([v, n]) => (
                <Pressable
                  key={v}
                  onPress={() => setWhen(v)}
                  style={[
                    ui.chip,
                    { flexDirection: "row", gap: 7 },
                    when === v && ui.selected,
                  ]}
                >
                  <Glyph
                    name={v === "now" ? "flash" : "calendar-outline"}
                    size={20}
                    color={when === v ? "#e6c885" : colors.forest}
                  />
                  <Text style={[ui.chipText, when === v && ui.selectedText]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
            {when === "later" ? (
              <View style={ui.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.muted, { marginTop: 12 }]}>Date · IST</Text>
                  <ScheduleInput
                    mode="date"
                    date={date}
                    time={time}
                    onChange={setDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.muted, { marginTop: 12 }]}>Time · IST</Text>
                  <ScheduleInput
                    mode="time"
                    date={date}
                    time={time}
                    onChange={setTime}
                  />
                </View>
              </View>
            ) : (
              <Text style={[ui.muted, { marginTop: 10, fontSize: 11 }]}>
                Arrival is confirmed when a nearby creator accepts.
              </Text>
            )}
          </View>
          <View style={ui.section}>
            <Text style={ui.h2}>How long?</Text>
            <View style={ui.row}>
              {[60, 120, 180, 240, 300].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setMinutes(d)}
                  style={[ui.chip, d === minutes && ui.selected]}
                >
                  <Text style={[ui.chipText, d === minutes && ui.selectedText]}>
                    {d / 60} hr{d > 60 ? "s" : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={ui.section}>
            <Text style={ui.h2}>Choose your experience</Text>
            <View style={ui.row}>
              {LEVELS.map((n, i) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityState={{ selected: level === n }}
                  onPress={() => setLevel(n)}
                  style={{
                    flex: 1,
                    position: "relative",
                    minHeight: 162,
                    borderRadius: 15,
                    borderWidth: level === n ? 2 : 1,
                    borderColor: level === n ? colors.forest : colors.line,
                    backgroundColor: level === n ? "#eff3e9" : colors.card,
                    padding: 8,
                    paddingTop: 35,
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {n === "Standard" && (
                    <Text
                      style={{
                        position: "absolute",
                        top: 8,
                        fontSize: 9,
                        color: "#6c4e19",
                        backgroundColor: "#edd7a3",
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 9,
                      }}
                    >
                      Most popular
                    </Text>
                  )}
                  <View
                    style={{
                      borderRadius: 26,
                      width: 48,
                      height: 48,
                      backgroundColor: level === n ? colors.forest : "#f1ece2",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Glyph
                      name={i === 2 ? "camera" : "camera-outline"}
                      size={28}
                      color={level === n ? "#fff" : colors.forest}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.ink,
                      fontWeight: "600",
                    }}
                  >
                    {n}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      textAlign: "center",
                      lineHeight: 14,
                      color: colors.muted,
                    }}
                  >
                    {
                      [
                        "Everyday moments",
                        "Experienced coverage",
                        "Advanced creativity",
                      ][i]
                    }
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={ui.section}>
            <Text style={ui.h2}>Shoot location</Text>
            <TextInput
              style={ui.input}
              accessibilityLabel="Shoot address"
              placeholder="Venue, street and landmark"
              value={address}
              onChangeText={setAddress}
              maxLength={300}
            />
            <Button
              secondary
              label={lat && lng ? "Change venue on map" : "Choose venue on map"}
              onPress={() => setMapOpen(true)}
            />
            <Button
              secondary
              label={
                locating
                  ? "Finding your location…"
                  : lat
                    ? "Use current location instead"
                    : "Use my current location"
              }
              disabled={locating}
              onPress={locate}
            />
            <Text style={[ui.muted, { marginTop: 10, fontSize: 11 }]}>
              Available within 15 km of Rohit Nagar, Bhopal. Use current
              location only at the shoot venue.
            </Text>
            <Pressable
              onPress={() => setAdvancedPin((v) => !v)}
              accessibilityRole="button"
            >
              <Text style={[ui.muted, { paddingVertical: 12, fontSize: 11 }]}>
                Advanced · enter coordinates manually
              </Text>
            </Pressable>
            {advancedPin && (
              <View style={ui.row}>
                <TextInput
                  style={[ui.input, { flex: 1 }]}
                  accessibilityLabel="Latitude"
                  placeholder="Latitude"
                  keyboardType="numbers-and-punctuation"
                  value={lat}
                  onChangeText={setLat}
                />
                <TextInput
                  style={[ui.input, { flex: 1 }]}
                  accessibilityLabel="Longitude"
                  placeholder="Longitude"
                  keyboardType="numbers-and-punctuation"
                  value={lng}
                  onChangeText={setLng}
                />
              </View>
            )}
            <TextInput
              style={ui.input}
              accessibilityLabel="Special requests"
              placeholder="Special requests · optional"
              multiline
              value={notes}
              onChangeText={setNotes}
              maxLength={1800}
            />
          </View>
        </>
      ) : (
        <>
          <Card>
            <Text style={ui.h2}>Your shoot</Text>
            <Text style={ui.muted}>
              {service} · {level} · {minutes / 60} hours
            </Text>
            <Text style={[ui.muted, { marginTop: 12 }]}>
              {when === "now"
                ? "As soon as available"
                : date + " · " + time + " IST"}
            </Text>
            <Text style={[ui.muted, { marginTop: 12 }]}>{address}</Text>
            {notes && <Text style={ui.muted}>{notes}</Text>}
            <Button secondary label="Edit details" onPress={() => setStep(1)} />
          </Card>
          <Text style={ui.h2}>Choose when to pay</Text>
          {[
            ["upfront", "Pay online now", "Secure checkout with Razorpay"],
            [
              "after_shoot",
              "Pay after the shoot",
              "Book now. Pay online after the shoot.",
            ],
          ].map(([v, n, sub]) => (
            <Pressable
              key={v}
              onPress={() => setTiming(v)}
              style={{
                padding: 18,
                borderWidth: timing === v ? 2 : 1,
                borderColor: timing === v ? colors.forest : colors.line,
                backgroundColor: timing === v ? "#eff3e9" : colors.card,
                borderRadius: 15,
                marginBottom: 10,
              }}
            >
              <Text style={ui.h2}>
                {timing === v ? "◉" : "○"} {n}
              </Text>
              <Text style={ui.muted}>{sub}</Text>
            </Pressable>
          ))}
          <Card>
            <Text style={ui.h2}>What’s included</Text>
            <Text style={ui.muted}>
              Shoot coverage and original, unedited files. Editing, retouching
              and edited videos are not included. Keep a backup after delivery.
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ack }}
              onPress={() => setAck(!ack)}
              style={{ paddingVertical: 16 }}
            >
              <Text style={{ fontSize: 13, color: colors.forest }}>
                {ack ? "☑" : "☐"} I understand the original-file policy.
              </Text>
            </Pressable>
          </Card>
        </>
      )}
      <View
        style={{
          padding: 20,
          borderWidth: 1,
          borderColor: "#e2c68b",
          borderRadius: 16,
          backgroundColor: "#fcf7eb",
        }}
      >
        <Text style={ui.muted}>
          {service} · {level} · {minutes / 60} hours
        </Text>
        <Text style={ui.price}>
          {price === null
            ? "Checking price…"
            : "₹" + (price / 100).toLocaleString("en-IN")}
        </Text>
        <Text style={[ui.muted, { fontSize: 11 }]}>
          Original files included · No hidden booking fees
        </Text>
      </View>
      {error && (
        <>
          <Text
            accessibilityRole="alert"
            style={{ color: "#9c4128", marginTop: 14 }}
          >
            {error}
          </Text>
          <Button secondary label="Retry loading" onPress={options} />
        </>
      )}
      <Button
        disabled={busy || price === null}
        label={
          busy
            ? "Creating your booking…"
            : step === 1
              ? "Review booking"
              : timing === "after_shoot"
                ? "Confirm · pay after shoot"
                : "Continue to payment"
        }
        onPress={submit}
      />
      <Text
        style={[ui.muted, { fontSize: 11, textAlign: "center", marginTop: 12 }]}
      >
        {step === 1
          ? "No payment at this step."
          : timing === "after_shoot"
            ? "Payment is due after your shoot."
            : "Your booking is confirmed after payment."}
      </Text>
      <VenueMap
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        onChoose={(p) => {
          setLat(String(p.lat));
          setLng(String(p.lng));
          setAddress(p.address);
          setMapOpen(false);
        }}
      />
    </Frame>
  );
}

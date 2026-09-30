import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { BottomNav, serif } from "../components/ui";
import { api } from "../lib/api";

type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  created_at: string;
  customer_price_paise?: number;
  service?: { name: string };
  service_level?: { name: string };
};

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const past = [
    "COMPLETED",
    "CUSTOMER_CONFIRMED",
    "PAYOUT_RELEASED",
    "CANCELLED",
    "REFUNDED",
  ];
  const shown = bookings.filter(
    (b) =>
      tab === "all" ||
      (tab === "past" ? past.includes(b.status) : !past.includes(b.status)),
  );

  const load = useCallback(async () => {
    try {
      const result = await api("/api/bookings");
      setBookings(result.bookings || []);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your bookings could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Your bookings</Text>
        <Text style={styles.subtitle}>
          Track every Pickolo assignment from request to completion.
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 20,
            marginBottom: 10,
          }}
        >
          {[
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["all", "All"],
          ].map(([v, label]) => (
            <Pressable
              key={v}
              accessibilityState={{ selected: tab === v }}
              onPress={() => setTab(v)}
              style={{
                flex: 1,
                padding: 12,
                borderWidth: 1,
                borderColor: "#e7dfd1",
                borderRadius: 12,
                backgroundColor: tab === v ? "#153f2e" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  textAlign: "center",
                  color: tab === v ? "#fff" : "#153f2e",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {loading ? (
          <Text style={styles.muted}>Loading your bookings…</Text>
        ) : error ? (
          <View style={styles.empty}>
            <Text style={{ color: "#9c4128" }}>{error}</Text>
            <Pressable onPress={load} style={styles.primary}>
              <Text style={styles.primaryText}>Retry</Text>
            </Pressable>
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {bookings.length
                ? "No bookings in this view"
                : "Your first memory starts here."}
            </Text>
            <Text style={styles.muted}>
              Your confirmed requests will appear here.
            </Text>
            <Pressable
              style={styles.primary}
              onPress={() => router.push("/booking")}
            >
              <Text style={styles.primaryText}>Book photography</Text>
            </Pressable>
          </View>
        ) : (
          shown.map((booking) => (
            <Pressable
              key={booking.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/booking-detail",
                  params: { id: booking.id },
                })
              }
            >
              <View style={styles.row}>
                <Text style={[styles.code, { flex: 1 }]}>
                  {booking.service?.name || "Your shoot"} ·{" "}
                  {booking.service_level?.name}
                </Text>
                <Text style={styles.badge}>
                  {booking.status === "REQUESTED"
                    ? "Choose payment"
                    : booking.status.replaceAll("_", " ").toLowerCase()}
                </Text>
              </View>
              <Text style={styles.date}>
                {new Date(booking.scheduled_start).toLocaleString()}
              </Text>
              <Text style={[styles.muted, { fontSize: 11 }]}>
                {booking.booking_code} · View booking →
              </Text>
              <Text style={styles.muted}>
                {booking.duration_minutes} min · {booking.location_text}
              </Text>
              {typeof booking.customer_price_paise === "number" && (
                <Text style={styles.price}>
                  ₹{(booking.customer_price_paise / 100).toFixed(0)}
                </Text>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#faf7f1" },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: "#34563d", fontWeight: "800", fontSize: 16 },
  title: {
    fontFamily: serif,
    marginTop: 18,
    fontSize: 32,
    fontWeight: "800",
    color: "#202e29",
  },
  subtitle: { marginTop: 6, color: "#747d70", fontSize: 16, lineHeight: 23 },
  empty: {
    marginTop: 24,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#fffcf7",
    borderWidth: 1,
    borderColor: "#e7dfd1",
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#202e29" },
  card: {
    marginTop: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#fffcf7",
    borderWidth: 1,
    borderColor: "#e7dfd1",
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  code: { fontSize: 16, fontWeight: "800", color: "#202e29" },
  badge: {
    maxWidth: 190,
    color: "#34563d",
    backgroundColor: "#edf2e7",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "800",
  },
  date: { marginTop: 12, color: "#334155", fontWeight: "700" },
  muted: { marginTop: 7, color: "#747d70", lineHeight: 21 },
  price: { marginTop: 12, fontSize: 18, fontWeight: "800", color: "#202e29" },
  primary: {
    marginTop: 18,
    backgroundColor: "#153f2e",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800" },
});

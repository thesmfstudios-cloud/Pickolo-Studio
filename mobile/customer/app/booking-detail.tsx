import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../shared/supabase";
import { BottomNav, serif } from "../components/ui";

type Booking = {
  booking_otp?: string;
  assigned_partner?: {
    name: string;
    avatar_url?: string | null;
    bio?: string | null;
    verified?: boolean;
    level?: string | null;
    rating?: number | null;
    review_count?: number;
    completed_jobs?: number;
    base_lat?: number | null;
    base_long?: number | null;
    portfolio?: Array<{
      id: string;
      image_url: string;
      caption?: string | null;
    }>;
    recent_reviews?: Array<{
      rating: number;
      comment?: string | null;
      created_at: string;
    }>;
  };
  shoot_started_at?: string;
  shoot_completed_at?: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  location_lat?: number | null;
  location_long?: number | null;
  notes?: string | null;
  customer_price_paise: number;
  payment_timing?: string;
  payment?: { status?: string | null } | null;
  service?: { name?: string | null } | null;
  service_level?: { name?: string | null } | null;
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);

  async function confirmDelivery() {
    if (!supabase || !id) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace("/auth");
      return;
    }

    const baseUrl =
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      "https://pickolo-studio.vercel.app";
    const response = await fetch(
      baseUrl + "/api/bookings/" + id + "/confirm-delivery",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      },
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert("Unable to confirm", result.error || "Please try again.");
      return;
    }

    Alert.alert(
      "Delivery confirmed",
      "Thank you. We’ve recorded that you received your files.",
      [
        {
          text: "Done",
          onPress: () =>
            router.replace({ pathname: "/booking-detail", params: { id } }),
        },
      ],
    );
  }

  async function cancelBooking() {
    if (!supabase || !id) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace("/auth");
      return;
    }

    const baseUrl =
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      "https://pickolo-studio.vercel.app";
    const response = await fetch(baseUrl + "/api/bookings/" + id + "/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ reason: "Customer requested cancellation." }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert("Unable to cancel", result.error || "Please try again.");
      return;
    }

    Alert.alert("Booking cancelled", "Your booking has been cancelled.", [
      {
        text: "Done",
        onPress: () =>
          router.replace({ pathname: "/booking-detail", params: { id } }),
      },
    ]);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!supabase || !id) return;
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          router.replace("/auth");
          return;
        }

        const baseUrl =
          process.env.EXPO_PUBLIC_API_BASE_URL ||
          "https://pickolo-studio.vercel.app";
        const response = await fetch(baseUrl + "/api/bookings/" + id, {
          headers: { Authorization: "Bearer " + token },
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (active)
            setLoadError(
              result.error || "Your booking could not load. Please retry.",
            );
          return;
        }

        if (active) {
          setBooking(result.booking);
          setLoadError("");
        }
      } catch {
        if (active)
          setLoadError("Unable to refresh booking. Check your connection.");
      }
    }

    load();
    const t = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [id, reload]);

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.muted}>
            {loadError || "Loading your booking…"}
          </Text>
          {loadError && (
            <Pressable
              style={styles.primary}
              onPress={() => setReload((n) => n + 1)}
            >
              <Text style={styles.primaryText}>Retry</Text>
            </Pressable>
          )}
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>{booking.booking_code}</Text>
        <Text style={styles.badge}>
          {booking.status === "REQUESTED"
            ? "Choose payment"
            : booking.status.replaceAll("_", " ").toLowerCase()}
        </Text>
        {loadError && (
          <Text style={{ color: "#9c4128", marginVertical: 12 }}>
            {loadError}
          </Text>
        )}
        {booking.payment_timing === "after_shoot" &&
          booking.payment?.status !== "captured" && (
            <Text style={styles.muted}>
              Pay after shoot ·{" "}
              {["SHOOT_COMPLETED", "DATA_PENDING", "DATA_SUBMITTED"].includes(
                booking.status,
              )
                ? "Your payment is due."
                : "Payment is due when your shoot ends."}
            </Text>
          )}
        {booking.payment?.status === "captured" && (
          <Text style={styles.badge}>Payment received ✓</Text>
        )}

        {booking.assigned_partner ? (
          <View style={styles.card}>
            <View style={styles.partnerHeader}>
              {booking.assigned_partner.avatar_url ? (
                <Image
                  source={{ uri: booking.assigned_partner.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>P</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.partnerNameRow}>
                  <Text style={styles.partnerName}>
                    {booking.assigned_partner.name}
                  </Text>
                  {booking.assigned_partner.verified ? (
                    <Text style={styles.verified}>✓ VERIFIED</Text>
                  ) : null}
                </View>
                <Text style={styles.partnerMeta}>
                  {booking.assigned_partner.level || "Pickolo Partner"}
                  {booking.assigned_partner.rating
                    ? " · " + booking.assigned_partner.rating.toFixed(1) + "★"
                    : ""}
                  {booking.assigned_partner.review_count
                    ? " · " + booking.assigned_partner.review_count + " reviews"
                    : ""}
                </Text>
                {booking.assigned_partner.completed_jobs ? (
                  <Text style={styles.partnerMeta}>
                    {booking.assigned_partner.completed_jobs} Pickolo jobs
                    completed
                  </Text>
                ) : null}
              </View>
            </View>

            {booking.assigned_partner.bio ? (
              <Text style={styles.partnerBio}>
                {booking.assigned_partner.bio}
              </Text>
            ) : null}

            {booking.assigned_partner.portfolio?.length ? (
              <>
                <Text style={styles.profileSectionTitle}>Recent work</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.portfolioRow}
                >
                  {booking.assigned_partner.portfolio.map((item) => (
                    <Image
                      key={item.id}
                      source={{ uri: item.image_url }}
                      style={styles.portfolioImage}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {booking.assigned_partner.recent_reviews?.length ? (
              <>
                <Text style={styles.profileSectionTitle}>
                  Customer feedback
                </Text>
                {booking.assigned_partner.recent_reviews.map((item, index) => (
                  <View
                    key={String(item.created_at) + index}
                    style={styles.customerReview}
                  >
                    <Text style={styles.reviewStars}>
                      {"★".repeat(Math.max(1, Math.min(5, item.rating)))}
                    </Text>
                    {item.comment ? (
                      <Text style={styles.reviewComment}>{item.comment}</Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}

            {booking.assigned_partner.base_lat != null &&
            booking.assigned_partner.base_long != null &&
            booking.location_lat != null &&
            booking.location_long != null ? (
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  const origin = encodeURIComponent(
                    String(booking.assigned_partner?.base_lat) +
                      "," +
                      String(booking.assigned_partner?.base_long),
                  );
                  const destination = encodeURIComponent(
                    String(booking.location_lat) +
                      "," +
                      String(booking.location_long),
                  );
                  Linking.openURL(
                    "https://www.google.com/maps/dir/?api=1&origin=" +
                      origin +
                      "&destination=" +
                      destination,
                  ).catch(() =>
                    Alert.alert(
                      "Maps unavailable",
                      "Unable to open route right now.",
                    ),
                  );
                }}
              >
                <Text style={styles.secondaryText}>
                  View partner route on map
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.privacyNote}>
              Pickolo keeps personal contact details private. Your assigned
              professional is verified by Pickolo.
            </Text>
          </View>
        ) : [
            "PAYMENT_CONFIRMED",
            "SEARCHING_PARTNER",
            "PARTNER_ASSIGNED",
          ].includes(booking.status) ? (
          <View style={styles.card}>
            <Text style={styles.reviewTitle}>Finding your professional</Text>
            <Text style={styles.value}>
              Your profile will appear once a local professional accepts. This
              screen updates automatically.
            </Text>
          </View>
        ) : null}
        {booking.booking_otp ? (
          <View style={styles.card}>
            <Text style={styles.label}>Shoot start code</Text>
            <Text style={styles.price}>{booking.booking_otp}</Text>
            <Text style={styles.value}>
              Share only when your professional arrives and you are ready to
              start.
            </Text>
          </View>
        ) : null}
        {booking.shoot_started_at ? (
          <View style={styles.card}>
            <Text style={styles.reviewTitle}>
              {booking.shoot_completed_at
                ? "Shoot completed"
                : "Shoot in progress"}
            </Text>
            <Text style={styles.price}>
              {new Date(
                Math.max(
                  0,
                  (booking.shoot_completed_at
                    ? Date.parse(booking.shoot_completed_at)
                    : now) - Date.parse(booking.shoot_started_at),
                ),
              )
                .toISOString()
                .slice(11, 19)}
            </Text>
            <Text style={styles.value}>
              {booking.duration_minutes / 60} hours booked · elapsed shoot time
            </Text>
          </View>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.value}>
            {booking.service?.name || "Photography"}
          </Text>

          <Text style={styles.label}>Service level</Text>
          <Text style={styles.value}>
            {booking.service_level?.name || "Standard"}
          </Text>

          <Text style={styles.label}>When</Text>
          <Text style={styles.value}>
            {new Date(booking.scheduled_start).toLocaleString()}
          </Text>

          <Text style={styles.label}>Duration</Text>
          <Text style={styles.value}>{booking.duration_minutes} minutes</Text>

          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{booking.location_text}</Text>

          <Text style={styles.label}>Booking total</Text>
          <Text style={styles.price}>
            ₹{(booking.customer_price_paise / 100).toFixed(0)}
          </Text>

          {booking.notes ? (
            <>
              <Text style={styles.label}>Requirement</Text>
              <Text style={styles.value}>{booking.notes}</Text>
            </>
          ) : null}

          {(booking.status === "REQUESTED" ||
            (booking.payment_timing === "after_shoot" &&
              booking.payment?.status !== "captured" &&
              ["SHOOT_COMPLETED", "DATA_PENDING", "DATA_SUBMITTED"].includes(
                booking.status,
              ))) && (
            <Pressable
              style={styles.primary}
              onPress={() =>
                router.replace({ pathname: "/payment", params: { id } })
              }
            >
              <Text style={styles.primaryText}>
                {booking.payment_timing === "after_shoot"
                  ? "Pay after shoot · securely"
                  : "Choose payment option"}
              </Text>
            </Pressable>
          )}

          {booking.status === "CANCELLED" &&
            booking.payment?.status === "captured" && (
              <Pressable
                style={styles.primary}
                onPress={async () => {
                  if (!supabase || !id) return;
                  const { data } = await supabase.auth.getSession();
                  const token = data.session?.access_token;
                  if (!token) return;

                  const baseUrl =
                    process.env.EXPO_PUBLIC_API_BASE_URL ||
                    "https://pickolo-studio.vercel.app";
                  const response = await fetch(
                    baseUrl + "/api/payments/refund/" + id,
                    {
                      method: "POST",
                      headers: { Authorization: "Bearer " + token },
                    },
                  );
                  const result = await response.json().catch(() => ({}));

                  if (!response.ok) {
                    Alert.alert(
                      "Refund unavailable",
                      result.error || "Please try again.",
                    );
                    return;
                  }

                  Alert.alert(
                    "Refund initiated",
                    "Your payment refund has been submitted to the payment provider.",
                    [
                      {
                        text: "Done",
                        onPress: () =>
                          router.replace({
                            pathname: "/booking-detail",
                            params: { id },
                          }),
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.primaryText}>Request full refund</Text>
              </Pressable>
            )}

          {booking.status === "DATA_SUBMITTED" && (
            <>
              <Pressable
                style={styles.primary}
                onPress={() =>
                  router.push({ pathname: "/delivery", params: { id } })
                }
              >
                <Text style={styles.primaryText}>View delivered photos</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={confirmDelivery}>
                <Text style={styles.secondaryText}>Confirm delivery</Text>
              </Pressable>
            </>
          )}

          {booking.status === "COMPLETED" && (
            <Pressable
              style={styles.primary}
              onPress={() =>
                router.push({ pathname: "/delivery", params: { id } })
              }
            >
              <Text style={styles.primaryText}>View delivered photos</Text>
            </Pressable>
          )}

          {booking.status === "COMPLETED" && (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>Rate your photographer</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setRating(value)}
                    style={[
                      styles.rating,
                      rating === value && styles.ratingActive,
                    ]}
                  >
                    <Text style={styles.ratingText}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.reviewHint}>1 to 5</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Optional comment"
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <Pressable
                style={styles.primary}
                onPress={async () => {
                  if (!supabase || !id) return;
                  const { data } = await supabase.auth.getSession();
                  const token = data.session?.access_token;
                  if (!token) return;
                  const baseUrl =
                    process.env.EXPO_PUBLIC_API_BASE_URL ||
                    "https://pickolo-studio.vercel.app";
                  const response = await fetch(
                    baseUrl + "/api/bookings/" + id + "/review",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + token,
                      },
                      body: JSON.stringify({ rating, comment }),
                    },
                  );
                  const result = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    Alert.alert(
                      "Unable to submit review",
                      result.error || "Please try again.",
                    );
                    return;
                  }
                  Alert.alert(
                    "Review saved",
                    "Thank you for rating the booking.",
                  );
                }}
              >
                <Text style={styles.primaryText}>Submit review</Text>
              </Pressable>
            </View>
          )}

          {[
            "DATA_SUBMITTED",
            "CUSTOMER_CONFIRMED",
            "PAYOUT_RELEASED",
            "COMPLETED",
          ].includes(booking.status) && (
            <View style={styles.disputeCard}>
              <Text style={styles.reviewTitle}>
                Need help with this booking?
              </Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Issue type, e.g. missing photos"
                value={disputeReason}
                onChangeText={setDisputeReason}
              />
              <TextInput
                style={styles.reviewInput}
                placeholder="Describe the issue"
                value={disputeDescription}
                onChangeText={setDisputeDescription}
                multiline
              />
              <Pressable
                style={styles.danger}
                disabled={
                  disputeBusy ||
                  !disputeReason.trim() ||
                  !disputeDescription.trim()
                }
                onPress={async () => {
                  if (!supabase || !id) return;
                  const { data } = await supabase.auth.getSession();
                  const token = data.session?.access_token;
                  if (!token) return;

                  setDisputeBusy(true);
                  const baseUrl =
                    process.env.EXPO_PUBLIC_API_BASE_URL ||
                    "https://pickolo-studio.vercel.app";
                  const response = await fetch(baseUrl + "/api/disputes", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: "Bearer " + token,
                    },
                    body: JSON.stringify({
                      booking_id: id,
                      reason_code: disputeReason.trim(),
                      description: disputeDescription.trim(),
                    }),
                  });
                  const result = await response.json().catch(() => ({}));
                  setDisputeBusy(false);

                  if (!response.ok) {
                    Alert.alert(
                      "Unable to open dispute",
                      result.error || "Please try again.",
                    );
                    return;
                  }

                  setDisputeReason("");
                  setDisputeDescription("");
                  Alert.alert(
                    "Case opened",
                    "Pickolo has recorded your issue for review.",
                  );
                }}
              >
                <Text style={styles.dangerText}>
                  {disputeBusy ? "Opening case..." : "Open support case"}
                </Text>
              </Pressable>
            </View>
          )}

          {[
            "REQUESTED",
            "PAYMENT_CONFIRMED",
            "SEARCHING_PARTNER",
            "PARTNER_ASSIGNED",
          ].includes(booking.status) && (
            <Pressable
              style={styles.danger}
              onPress={() =>
                Alert.alert(
                  "Cancel this booking?",
                  "Refunds follow the cancellation policy.",
                  [
                    { text: "Keep booking", style: "cancel" },
                    {
                      text: "Cancel booking",
                      style: "destructive",
                      onPress: cancelBooking,
                    },
                  ],
                )
              }
            >
              <Text style={styles.dangerText}>Cancel booking</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#faf7f1" },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: "#34563d", fontWeight: "800", fontSize: 16 },
  title: { marginTop: 18, fontSize: 31, fontWeight: "800", color: "#202e29" },
  badge: {
    alignSelf: "flex-start",
    marginTop: 11,
    color: "#34563d",
    backgroundColor: "#edf2e7",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
  },
  card: {
    marginTop: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#fffcf7",
    borderWidth: 1,
    borderColor: "#e7dfd1",
  },
  label: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#747d70",
  },
  value: {
    marginTop: 5,
    fontSize: 16,
    lineHeight: 23,
    color: "#202e29",
    fontWeight: "600",
  },
  price: { marginTop: 5, fontSize: 25, color: "#202e29", fontWeight: "800" },
  primary: {
    marginTop: 18,
    backgroundColor: "#153f2e",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: {
    marginTop: 10,
    backgroundColor: "#edf2e7",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { color: "#34563d", fontWeight: "800" },
  danger: {
    marginTop: 10,
    backgroundColor: "#fff1f2",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerText: { color: "#be123c", fontWeight: "800" },
  reviewCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#faf7f1",
    borderWidth: 1,
    borderColor: "#e7dfd1",
  },
  reviewTitle: { fontSize: 17, fontWeight: "800", color: "#202e29" },
  ratingRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  rating: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fffcf7",
    borderWidth: 1,
    borderColor: "#e7dfd1",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingActive: { borderColor: "#153f2e", backgroundColor: "#edf2e7" },
  ratingText: { color: "#202e29", fontWeight: "800" },
  reviewHint: { marginTop: 6, color: "#94a3b8", fontSize: 12 },
  reviewInput: {
    marginTop: 12,
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#e7dfd1",
    borderRadius: 13,
    backgroundColor: "#fffcf7",
    padding: 12,
    textAlignVertical: "top",
  },
  disputeCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  partnerHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#edf2e7",
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#153f2e",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  partnerNameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
  },
  partnerName: { fontSize: 20, fontWeight: "900", color: "#202e29" },
  verified: {
    color: "#34563d",
    backgroundColor: "#edf2e7",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: "900",
  },
  partnerMeta: {
    marginTop: 4,
    color: "#747d70",
    fontSize: 13,
    fontWeight: "700",
  },
  partnerBio: { marginTop: 14, color: "#202e29", lineHeight: 22 },
  profileSectionTitle: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "900",
    color: "#202e29",
  },
  portfolioRow: { marginTop: 10 },
  portfolioImage: {
    width: 130,
    height: 130,
    borderRadius: 14,
    marginRight: 9,
    backgroundColor: "#edf0e9",
  },
  customerReview: {
    marginTop: 10,
    padding: 12,
    borderRadius: 13,
    backgroundColor: "#faf7f1",
  },
  reviewStars: { color: "#8a6a17", fontWeight: "900", letterSpacing: 1 },
  reviewComment: { marginTop: 5, color: "#465049", lineHeight: 20 },
  privacyNote: {
    marginTop: 12,
    color: "#747d70",
    fontSize: 12,
    lineHeight: 18,
  },
  muted: { color: "#747d70" },
});

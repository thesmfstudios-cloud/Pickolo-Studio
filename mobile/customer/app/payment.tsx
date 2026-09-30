import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import * as SecureStore from "expo-secure-store";
import { api } from "../lib/api";
import { supabase } from "../../shared/supabase";
import { Brand, Button, Card, Frame, Glyph, ui } from "../components/ui";
type Booking = {
  status: string;
  customer_price_paise: number;
  payment_timing?: string;
  payment?: { status?: string };
};
export default function Payment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = "pickolo-payment-" + id;
  async function load() {
    try {
      const r = await api("/api/bookings/" + id);
      setBooking(r.booking);
      setPending(!!(await SecureStore.getItemAsync(key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking could not load.");
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  async function verify(result: unknown) {
    await api("/api/payments/verify/" + id, result);
    await SecureStore.deleteItemAsync(key);
    setPending(false);
    router.replace({ pathname: "/booking-detail", params: { id } });
  }
  async function pay() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await SecureStore.getItemAsync(key);
      if (saved) {
        await verify(JSON.parse(saved));
        return;
      }
      const order = await api("/api/payments/order/" + id, {});
      if (order.alreadyPaid) {
        await SecureStore.deleteItemAsync(key);
        router.replace({ pathname: "/booking-detail", params: { id } });
        return;
      }
      const { data } = await supabase!.auth.getUser();
      const result = await RazorpayCheckout.open({
        key: order.keyId,
        amount: String(order.amountPaise),
        currency: order.currency,
        name: "Pickolo",
        description: "Your local creative, booked.",
        order_id: order.orderId,
        prefill: {
          email: data.user?.email || "",
          name: data.user?.user_metadata?.full_name || "",
        },
        theme: { color: "#153f2e" },
      });
      await SecureStore.setItemAsync(key, JSON.stringify(result));
      setPending(true);
      await verify(result);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Payment was closed or could not complete.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }
  async function defer() {
    setBusy(true);
    setError("");
    try {
      await api("/api/bookings/" + id + "/pay-after-shoot", {});
      router.replace({ pathname: "/booking-detail", params: { id } });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Selection could not complete.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame>
      <Brand back />
      <Text style={ui.title}>
        {pending ? "Verify your payment." : "Your shoot, your choice."}
      </Text>
      <Text style={[ui.muted, { marginBottom: 24 }]}>
        UPI, cards and supported payment methods via Razorpay.
      </Text>
      <Card>
        <View style={{ alignItems: "center", gap: 14 }}>
          <Glyph name="shield-checkmark-outline" size={48} />
          <Text style={ui.price}>
            {booking
              ? "₹" +
                (booking.customer_price_paise / 100).toLocaleString("en-IN")
              : "Loading…"}
          </Text>
          <Text style={ui.muted}>
            {booking?.payment?.status === "captured"
              ? "Payment already received"
              : pending
                ? "Payment result saved. Retry verification before paying again."
                : "Secure online checkout"}
          </Text>
        </View>
      </Card>
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#9c4128", marginBottom: 14 }}
        >
          {error}
        </Text>
      )}
      {booking?.payment?.status === "captured" ? (
        <Button
          label="View booking"
          onPress={() =>
            router.replace({ pathname: "/booking-detail", params: { id } })
          }
        />
      ) : (
        <Button
          label={
            busy
              ? "Processing…"
              : pending
                ? "Retry payment verification"
                : "Pay securely"
          }
          disabled={busy || !booking}
          onPress={pay}
        />
      )}{" "}
      {booking?.status === "REQUESTED" && !pending && (
        <Button
          secondary
          label="Pay after shoot"
          disabled={busy}
          onPress={defer}
        />
      )}
      <Button
        secondary
        label="Refresh booking"
        disabled={busy}
        onPress={load}
      />
      <Text
        style={[ui.muted, { textAlign: "center", marginTop: 20, fontSize: 12 }]}
      >
        No need to pay twice. If your bank confirms payment, retry verification
        or contact support with your receipt.
      </Text>
    </Frame>
  );
}

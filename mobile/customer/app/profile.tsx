import { useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../shared/supabase";
import { registerPushToken } from "../../shared/notifications";
import {
  Brand,
  Button,
  Card,
  colors,
  Frame,
  Glyph,
  ui,
} from "../components/ui";
export default function Profile() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      setName(data.user?.user_metadata?.full_name || "Your Pickolo account");
      setEmail(data.user?.email || "");
      setAvatar(data.user?.user_metadata?.avatar_url || "");
    });
  }, []);
  async function logout() {
    setBusy(true);
    const { error } = await supabase!.auth.signOut();
    setBusy(false);
    if (error) {
      Alert.alert("Sign out unavailable", "Please retry.");
      return;
    }
    router.replace("/auth");
  }
  return (
    <Frame>
      <Brand />
      <Text style={ui.title}>Your profile</Text>
      <Text style={[ui.muted, { marginBottom: 22 }]}>
        A little space for you and your memories.
      </Text>
      <Card>
        <View style={{ alignItems: "center" }}>
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                borderWidth: 2,
                borderColor: colors.gold,
                marginBottom: 15,
              }}
            />
          ) : (
            <Glyph name="person-circle-outline" size={65} />
          )}
          <Text style={ui.h2}>{name}</Text>
          <Text style={ui.muted}>{email}</Text>
        </View>
      </Card>
      <Card>
        <Text style={ui.h2}>Your account</Text>
        <Button
          secondary
          label="My bookings"
          onPress={() => router.push("/bookings")}
        />
        <Button
          secondary
          label="Updates & notifications"
          onPress={() => router.push("/notifications")}
        />
        <Button
          secondary
          label="Enable booking alerts"
          onPress={async () => {
            try {
              const token = await registerPushToken("customer");
              Alert.alert(
                "Booking alerts",
                token
                  ? "Booking alerts are enabled."
                  : "Alerts need a physical phone, notification permission and an Expo project. You can still view all updates in the app.",
              );
            } catch {
              Alert.alert(
                "Alerts unavailable",
                "Check notifications permission in phone settings.",
              );
            }
          }}
        />
        {[
          ["Help & support", "/help"],
          ["Privacy policy", "/privacy"],
          ["Terms of service", "/terms"],
          ["Cancellation & refunds", "/refund-policy"],
        ].map(([label, path]) => (
          <Pressable
            key={path}
            onPress={() =>
              Linking.openURL("https://pickolo-studio.vercel.app" + path)
            }
            style={{
              paddingVertical: 17,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ color: colors.forest, fontSize: 14 }}>
              {label} →
            </Text>
          </Pressable>
        ))}
        <Button
          secondary
          disabled={busy}
          label={busy ? "Signing out…" : "Sign out"}
          onPress={logout}
        />
      </Card>
      <Text style={[ui.muted, { textAlign: "center", fontSize: 11 }]}>
        Pickolo by SMF Studios · Bhopal
      </Text>
    </Frame>
  );
}

import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../shared/supabase";
import {
  Brand,
  Button,
  Card,
  colors,
  Frame,
  Glyph,
  serif,
  ui,
} from "../components/ui";
export default function Home() {
  const [service, setService] = useState("Photography");
  const [avatar, setAvatar] = useState("");
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth");
        return;
      }
      setAvatar(data.user.user_metadata?.avatar_url || "");
    });
  }, []);
  return (
    <Frame>
      <View style={s.top}>
        <View>
          <Brand />
          <Pressable
            style={s.area}
            onPress={() =>
              Alert.alert(
                "Capturing Bhopal",
                "Available within 15 km of Rohit Nagar. Add your exact venue when planning your shoot.",
              )
            }
          >
            <Glyph name="location" size={16} />
            <Text style={{ fontSize: 12, color: colors.forest }}>
              Bhopal · Rohit Nagar
            </Text>
            <Glyph name="chevron-down" size={15} />
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel="Open profile"
          onPress={() => router.push("/profile")}
          style={s.avatar}
        >
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
            />
          ) : (
            <Glyph name="person" />
          )}
        </Pressable>
      </View>
      <View style={s.hero}>
        <View style={s.copy}>
          <Text style={s.heroTitle}>
            Hi, let’s capture{"\n"}something{"\n"}beautiful.
          </Text>
          <View style={ui.rule} />
          <Text style={[ui.muted, { marginTop: 14, fontSize: 13 }]}>
            Real moments. Beautiful stories.{"\n"}Captured by trusted creators
            {"\n"}near you.
          </Text>
        </View>
        <Image
          source={require("../assets/pickolo-hero.png")}
          style={s.art}
          resizeMode="contain"
        />
      </View>
      <Card>
        <Text style={s.heading}>What do you need?</Text>
        <View style={ui.row}>
          {(["Photography", "Videography", "Both"] as const).map((name, i) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: service === name }}
              onPress={() => setService(name)}
              style={[s.tile, service === name && s.tileSelected]}
            >
              <Glyph
                name={(["camera", "videocam", "images"] as const)[i]}
                size={34}
              />
              <Text style={s.tileText}>{name}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          label="Book a shoot"
          onPress={() =>
            router.push({ pathname: "/booking", params: { service } })
          }
        />
      </Card>
      <View style={s.trust}>
        {(
          [
            ["shield-checkmark-outline", "Verified", "creators"],
            ["calendar-outline", "Easy", "booking"],
            ["card-outline", "Pay after", "shoot available"],
          ] as const
        ).map(([icon, a, b]) => (
          <View key={a} style={s.trustItem}>
            <Glyph name={icon} size={25} />
            <Text style={{ fontSize: 10, lineHeight: 15, color: colors.ink }}>
              {a}
              {"\n"}
              {b}
            </Text>
          </View>
        ))}
      </View>
      <Text style={s.heading}>How it works</Text>
      <View style={[ui.row, { marginTop: 12 }]}>
        {(["Choose", "Book", "Capture"] as const).map((n, i) => (
          <View key={n} style={s.how}>
            <Text style={s.number}>{i + 1}</Text>
            <Glyph
              name={i === 1 ? "calendar-outline" : "camera-outline"}
              size={35}
            />
            <Text
              style={{
                fontSize: 14,
                color: colors.forest,
                fontWeight: "600",
                marginTop: 10,
              }}
            >
              {n}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>
              {
                [
                  "Pick your coverage",
                  "Set a time and place",
                  "Meet your creator",
                ][i]
              }
            </Text>
          </View>
        ))}
      </View>
      <Text
        style={[ui.muted, { fontSize: 11, textAlign: "center", marginTop: 26 }]}
      >
        Original files included. Editing and retouching are not included.
      </Text>
    </Frame>
  );
}
const s = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  area: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eeeee5",
    borderRadius: 24,
    padding: 9,
    marginTop: -6,
  },
  avatar: {
    borderWidth: 2,
    borderColor: colors.gold,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ede6d7",
  },
  hero: {
    height: 286,
    marginTop: 16,
    marginHorizontal: -22,
    paddingHorizontal: 22,
    justifyContent: "center",
    overflow: "hidden",
  },
  copy: { zIndex: 1, width: "64%" },
  heroTitle: {
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 35,
    fontWeight: "700",
    color: colors.forest,
    marginBottom: 14,
  },
  art: {
    position: "absolute",
    right: -35,
    bottom: 6,
    width: "58%",
    height: 242,
  },
  heading: {
    fontFamily: serif,
    fontSize: 28,
    color: colors.forest,
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 17,
  },
  tile: {
    flex: 1,
    minHeight: 114,
    borderWidth: 1,
    borderColor: "#e7dcc4",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    padding: 4,
  },
  tileSelected: {
    backgroundColor: "#eff3e9",
    borderColor: colors.forest,
    borderWidth: 2,
  },
  tileText: { fontSize: 11, color: colors.ink, fontWeight: "600" },
  trust: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 27,
  },
  trustItem: { flex: 1, flexDirection: "row", gap: 7, alignItems: "center" },
  how: { flex: 1, alignItems: "center", position: "relative" },
  number: {
    backgroundColor: "#efdfb9",
    borderRadius: 15,
    width: 24,
    height: 24,
    textAlign: "center",
    textAlignVertical: "center",
    position: "absolute",
    top: 0,
    left: 0,
    color: colors.forest,
  },
});

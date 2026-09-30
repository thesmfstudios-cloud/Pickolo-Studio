import { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
export const colors = {
  cream: "#faf7f1",
  card: "#fffcf7",
  forest: "#153f2e",
  gold: "#bc8d29",
  ink: "#18231f",
  muted: "#74786f",
  line: "#e7dfd1",
};
export const serif = Platform.OS === "ios" ? "Georgia" : "serif";
export function Glyph({
  name,
  size = 24,
  color = colors.forest,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        ui.button,
        secondary && ui.secondary,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[ui.buttonText, secondary && { color: colors.forest }]}>
        {label}
      </Text>
      {!secondary && <Glyph name="arrow-forward" size={20} color="#fff" />}
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={ui.card}>{children}</View>;
}
export function Brand({
  back = false,
  step,
}: {
  back?: boolean;
  step?: number;
}) {
  return (
    <View style={ui.header}>
      {back && (
        <Pressable
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={{ padding: 6 }}
        >
          <Glyph name="arrow-back" />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[ui.brand, back && { fontSize: 26 }]}>PICKOLO</Text>
        <View style={ui.rule} />
      </View>
      {step && (
        <View>
          <Text style={ui.muted}>Step {step} of 2</Text>
          <Text style={{ color: colors.forest, letterSpacing: 10 }}>
            ● {step === 2 ? "●" : "○"}
          </Text>
        </View>
      )}
    </View>
  );
}
export function Frame({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <View style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ui.content}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}
export function BottomNav() {
  const path = usePathname();
  return (
    <SafeAreaView edges={["bottom"]} style={ui.nav}>
      <View style={{ flexDirection: "row" }}>
        {(
          [
            { path: "/home", label: "Home", icon: "home-outline" },
            { path: "/bookings", label: "Bookings", icon: "calendar-outline" },
            { path: "/profile", label: "Profile", icon: "person-outline" },
          ] as const
        ).map((t) => {
          const active =
            t.path === "/home"
              ? path === "/home" || path === "/booking"
              : t.path === "/bookings"
                ? path === "/bookings" ||
                  path === "/booking-detail" ||
                  path === "/delivery" ||
                  path === "/payment"
                : path === "/profile" || path === "/notifications";
          return (
            <Pressable
              key={t.path}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => router.replace(t.path)}
              style={ui.navItem}
            >
              <Glyph name={t.icon} color={active ? colors.forest : "#858781"} />
              <Text
                style={{
                  fontSize: 12,
                  color: active ? colors.forest : "#858781",
                  fontWeight: active ? "700" : "400",
                }}
              >
                {t.label}
              </Text>
              <View
                style={{
                  height: 2,
                  width: 18,
                  backgroundColor: active ? colors.gold : "transparent",
                  marginTop: 4,
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 22, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  brand: {
    fontFamily: serif,
    fontSize: 37,
    fontWeight: "700",
    color: colors.forest,
    letterSpacing: 1,
  },
  rule: { width: 30, height: 2, backgroundColor: colors.gold, marginTop: 4 },
  title: {
    fontFamily: serif,
    fontSize: 32,
    color: colors.forest,
    fontWeight: "700",
    lineHeight: 36,
    marginBottom: 10,
  },
  h2: { fontSize: 18, fontWeight: "600", color: colors.ink, marginBottom: 12 },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
  },
  button: {
    minHeight: 54,
    backgroundColor: colors.forest,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 12,
  },
  secondary: {
    backgroundColor: "#edf1e6",
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  nav: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.line,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  navItem: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: colors.ink,
    marginTop: 8,
  },
  section: { marginBottom: 22 },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.forest, borderColor: colors.gold },
  chipText: { color: colors.ink, fontSize: 13 },
  selectedText: { color: "#fff" },
  price: {
    fontFamily: serif,
    fontSize: 38,
    color: colors.forest,
    fontWeight: "700",
  },
  badge: {
    fontSize: 11,
    color: colors.forest,
    backgroundColor: "#edf2e5",
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});

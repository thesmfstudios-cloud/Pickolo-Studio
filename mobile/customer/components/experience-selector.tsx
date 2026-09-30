import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, Glyph, serif } from "./ui";

const tiers = ["Basic", "Standard", "Professional"];
const money = (value: number) => "₹" + (value / 100).toLocaleString("en-IN");

export default function ExperienceSelector({
  service,
  level,
  minutes,
  prices,
  errors,
  onChange,
}: {
  service: string;
  level: string;
  minutes: number;
  prices: Record<string, number | null>;
  errors: Record<string, string>;
  onChange: (level: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tiers.indexOf(level));
  const price = prices[level];
  const selectAt = (x: number) => {
    if (width > 28)
      onChange(
        tiers[
          Math.min(2, Math.max(0, Math.round(((x - 14) / (width - 28)) * 2)))
        ],
      );
  };
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.choice}>
          <View style={styles.icon}>
            <Glyph
              name={
                service === "Videography"
                  ? "videocam-outline"
                  : service === "Both"
                    ? "images-outline"
                    : "camera-outline"
              }
              size={26}
            />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.name}>{level}</Text>
            {level === "Standard" && (
              <Text style={styles.popular}>Most popular</Text>
            )}
          </View>
        </View>
        <View style={styles.total} accessibilityLiveRegion="polite">
          <Text style={styles.amount}>
            {price != null
              ? money(price)
              : errors[level]
                ? "Unavailable"
                : "Checking…"}
          </Text>
          <Text style={styles.helper}>
            Total for {minutes / 60} {minutes === 60 ? "hour" : "hours"}
          </Text>
        </View>
      </View>
      <View
        style={styles.trackHitArea}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Choose your experience"
        accessibilityValue={{
          min: 0,
          max: 2,
          now: index,
          text:
            level +
            (price != null ? ", " + money(price) : ", price unavailable"),
        }}
        accessibilityActions={[
          { name: "increment", label: "Next experience" },
          { name: "decrement", label: "Previous experience" },
        ]}
        onAccessibilityAction={(e) =>
          onChange(
            tiers[
              Math.max(
                0,
                Math.min(
                  2,
                  index + (e.nativeEvent.actionName === "increment" ? 1 : -1),
                ),
              )
            ],
          )
        }
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => true}
        onResponderGrant={(e) => selectAt(e.nativeEvent.locationX)}
        onResponderMove={(e) => selectAt(e.nativeEvent.locationX)}
      >
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: `${index * 50}%` }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.stop, { left: 7, borderColor: "#537c60" }]}
        />
        <View pointerEvents="none" style={[styles.stop, { right: 7 }]} />
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: Math.max(0, ((width - 28) * index) / 2) },
          ]}
        />
      </View>
      <View style={styles.tiers}>
        {tiers.map((tier, i) => (
          <Pressable
            key={tier}
            onPress={() => onChange(tier)}
            accessibilityRole="button"
            accessibilityState={{ selected: tier === level }}
            accessibilityLabel={
              tier +
              (prices[tier] != null
                ? ", " + money(prices[tier]!)
                : errors[tier]
                  ? ", unavailable"
                  : ", loading price")
            }
            style={[styles.tier, i > 0 && styles.divider]}
          >
            <Text style={[styles.tierName, tier === level && styles.selected]}>
              {tier}
            </Text>
            <Text
              style={[styles.tierAmount, tier === level && styles.selected]}
            >
              {prices[tier] != null
                ? money(prices[tier]!)
                : errors[tier]
                  ? "Unavailable"
                  : "…"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Slide to compare experience and price</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.card,
    padding: 14,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0ece3",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: serif,
    color: colors.forest,
    fontWeight: "700",
    fontSize: 20,
  },
  popular: {
    fontSize: 9,
    color: "#674918",
    backgroundColor: "#edd7a3",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  total: { alignItems: "flex-end" },
  amount: {
    fontFamily: serif,
    fontWeight: "700",
    fontSize: 25,
    color: colors.forest,
  },
  helper: { fontSize: 10, color: colors.muted, marginTop: 4 },
  trackHitArea: {
    height: 48,
    marginTop: 14,
    marginHorizontal: 6,
    justifyContent: "center",
  },
  track: {
    height: 9,
    marginHorizontal: 14,
    backgroundColor: "#c7cec5",
    borderRadius: 8,
    overflow: "hidden",
  },
  fill: { height: 9, backgroundColor: "#205741" },
  stop: {
    position: "absolute",
    width: 14,
    height: 14,
    top: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "#b3b6a9",
    borderRadius: 7,
  },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    top: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderColor: colors.gold,
    borderWidth: 2,
    elevation: 3,
  },
  tiers: { flexDirection: "row" },
  tier: {
    flex: 1,
    minHeight: 54,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.line },
  tierName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#63675f",
    textAlign: "center",
  },
  tierAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#63675f",
    marginTop: 4,
  },
  selected: { color: colors.forest },
  hint: {
    fontSize: 10,
    textAlign: "center",
    color: colors.muted,
    marginTop: 14,
  },
});

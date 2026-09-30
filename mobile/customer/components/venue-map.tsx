import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { API_BASE } from "../lib/api";
import { Button, colors, ui } from "./ui";
export default function VenueMap({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (point: { lat: number; lng: number; address: string }) => void;
}) {
  const [error, setError] = useState(false);
  const web = useRef<WebView>(null);
  const origin = new URL(API_BASE).origin;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
        <View style={{ paddingHorizontal: 18 }}>
          <Button secondary label="Close map" onPress={onClose} />
        </View>
        {error ? (
          <View style={{ padding: 24 }}>
            <Text style={ui.muted}>
              Map could not load. Check your connection.
            </Text>
            <Button
              label="Retry map"
              onPress={() => {
                setError(false);
                web.current?.reload();
              }}
            />
          </View>
        ) : (
          <WebView
            ref={web}
            source={{ uri: API_BASE + "/choose-location?native=1" }}
            style={{ flex: 1, backgroundColor: colors.cream }}
            applicationNameForUserAgent="Pickolo/1.0"
            startInLoadingState
            renderLoading={() => <ActivityIndicator color={colors.forest} />}
            onError={() => setError(true)}
            onHttpError={() => setError(true)}
            onShouldStartLoadWithRequest={(r) => {
              if (r.url.startsWith(origin + "/")) return true;
              if (r.url.startsWith("https://www.openstreetmap.org/"))
                Linking.openURL(r.url);
              return false;
            }}
            onMessage={(event) => {
              try {
                const p = JSON.parse(event.nativeEvent.data);
                if (
                  typeof p.lat === "number" &&
                  typeof p.lng === "number" &&
                  Number.isFinite(p.lat) &&
                  Number.isFinite(p.lng) &&
                  Math.abs(p.lat) <= 90 &&
                  Math.abs(p.lng) <= 180 &&
                  typeof p.address === "string" &&
                  p.address.trim().length >= 3 &&
                  p.address.length <= 300
                )
                  onChoose({
                    lat: p.lat,
                    lng: p.lng,
                    address: p.address.trim(),
                  });
              } catch {}
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function CustomerLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#faf7f1" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#faf7f1" },
          animation: "slide_from_right",
        }}
      />
    </SafeAreaProvider>
  );
}

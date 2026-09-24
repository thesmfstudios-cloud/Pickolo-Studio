import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const BACKGROUND = '#F5FAFF';

export default function CustomerLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar
        style="dark"
        backgroundColor={BACKGROUND}
        translucent={false}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BACKGROUND },
          animation: 'slide_from_right',
        }}
      />
    </SafeAreaProvider>
  );
}

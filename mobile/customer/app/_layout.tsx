import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function CustomerLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#FBF9F5" translucent={false} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FBF9F5' } }} />
    </SafeAreaProvider>
  );
}
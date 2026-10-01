import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Card, Header, Page, SectionTitle, ui } from '../ui/components';
import { colors } from '../ui/theme';
export default function Settings() {
  return (
    <Page>
      <Header
        title="Settings"
        subtitle="Control your partner experience"
        back
      />
      <SectionTitle>Device permissions</SectionTitle>
      <Card>
        <Menu
          label="Notifications, photos & location"
          onPress={() => {
            void Linking.openSettings().catch(() =>
              Alert.alert(
                'Settings unavailable',
                'Open Pickolo Partner permissions in your device settings.',
              ),
            );
          }}
        />
        <Text style={ui.body}>
          Manage app permissions and alerts in Android settings.
        </Text>
      </Card>
      <SectionTitle>App</SectionTitle>
      <Card>
        <Text style={[ui.label, { paddingVertical: 15 }]}>
          Language · English
        </Text>
        <Menu
          label="About & privacy information"
          onPress={() => router.push('/about')}
        />
        <Text style={ui.body}>
          Version {Constants.expoConfig?.version || '—'}
        </Text>
      </Card>
    </Page>
  );
}
function Menu({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={ui.label}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chev: { color: colors.muted, fontSize: 25 },
});

import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  Card,
  Header,
  Page,
  RemoteState,
  SectionTitle,
  ui,
} from '../ui/components';
import { Performance, request } from '../ui/api';
import { useRemote } from '../ui/useRemote';
import { colors } from '../ui/theme';
async function loadPerformance() {
  return request<{ performance: Performance }>('/api/partner/performance');
}
export default function PerformanceScreen() {
  const remote = useRemote(loadPerformance);
  const performance = remote.data?.performance;
  return (
    <Page>
      <Header
        title="Performance"
        subtitle="Your Pickolo quality and reliability"
        back
      />
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {performance && !remote.error && (
        <>
          <View style={styles.grid}>
            <Stat
              label="Completed"
              value={String(performance.completed_jobs)}
            />
            <Stat
              label="Delivered"
              value={String(performance.delivered_jobs)}
            />
            <Stat
              label="Rating"
              value={performance.average_rating?.toFixed(1) || '—'}
            />
            <Stat label="XP earned" value={String(performance.xp)} />
          </View>
          <SectionTitle>Reliability</SectionTitle>
          <Card>
            <Text style={ui.body}>
              On-time shoots: {performance.on_time_jobs}
            </Text>
            <Text style={ui.body}>
              Cancellations: {performance.cancellations}
            </Text>
            <Text style={ui.body}>No-shows: {performance.no_shows}</Text>
          </Card>
          <Button
            label="View earnings & payouts"
            variant="secondary"
            onPress={() => router.push('/earnings')}
          />
        </>
      )}
    </Page>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={ui.body}>{label}</Text>
    </Card>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { width: '47%' },
  value: { color: colors.ink, fontSize: 28, fontWeight: '900' },
});

import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
import { registerPushToken } from '../../shared/notifications';
import {
  Brand,
  Button,
  Card,
  Chip,
  EmptyState,
  Page,
  RemoteState,
  SectionTitle,
  ui,
} from '../ui/components';
import { colors } from '../ui/theme';
import {
  errorMessage,
  isActiveJob,
  isPaidPayout,
  Job,
  money,
  Partner,
  Payout,
  Performance,
  request,
} from '../ui/api';
import { useRemote } from '../ui/useRemote';

async function loadDashboard() {
  const { partner } = await request<{ partner: Partner }>(
    '/api/partner/profile',
  );
  if (partner.verification_status !== 'approved') {
    router.replace('/verification');
    throw new Error('Your partner account is not active.');
  }
  const [jobs, stats] = await Promise.all([
    request<{ jobs: Job[] }>('/api/partner/jobs'),
    request<{ performance: Performance; payouts: Payout[] }>(
      '/api/partner/performance',
    ),
  ]);
  return { partner, jobs: jobs.jobs, ...stats };
}

export default function PartnerHome() {
  const [busy, setBusy] = useState(false);
  const remote = useRemote(loadDashboard);
  const online = remote.data?.partner.is_accepting_jobs ?? false;
  const current = remote.data?.jobs.find(isActiveJob);
  const stats = remote.data?.performance;
  const [name, setName] = useState('Pickolo Partner');
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace('/auth');
      setName(data.user.user_metadata?.full_name || 'Pickolo Partner');
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      if (profile?.role === 'customer') {
        const { application } = await request<{ application: unknown }>(
          '/api/partner/application',
        );
        return router.replace(application ? '/verification' : '/apply');
      }
      if (profile?.role === 'partner')
        registerPushToken('partner').catch(() => undefined);
    })().catch((error) =>
      Alert.alert('Unable to load account', errorMessage(error)),
    );
  }, []);

  async function toggleOnline() {
    setBusy(true);
    try {
      await request('/api/partner/profile', {
        method: 'PATCH',
        body: JSON.stringify({ is_accepting_jobs: !online }),
      });
      await remote.reload();
    } catch (err) {
      Alert.alert('Availability unchanged', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setCurrentLocation() {
    if (!supabase) return;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        return Alert.alert(
          'Location needed',
          'Allow location so Pickolo can match nearby Bhopal shoots.',
        );
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return router.replace('/auth');
      await request('/api/partner/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          base_lat: position.coords.latitude,
          base_long: position.coords.longitude,
        }),
      });
      Alert.alert(
        'Location updated',
        'You are ready for nearby Bhopal assignments.',
      );
    } catch {
      Alert.alert(
        'Location unavailable',
        'We could not read your current location.',
      );
    }
  }

  return (
    <Page bottomNav>
      <View style={styles.hero}>
        <View style={ui.between}>
          <Brand light />
          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.bell}
          >
            <Text style={styles.bellText}>●</Text>
          </Pressable>
        </View>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Namaste, {name.split(' ')[0]}</Text>
            <Text style={styles.rating}>
              {stats?.average_rating == null
                ? 'New creator'
                : '★ ' + stats.average_rating.toFixed(1)}{' '}
              · {stats?.xp ?? '—'} XP
            </Text>
          </View>
          <Pressable
            disabled={busy || remote.loading || !!remote.error}
            onPress={toggleOnline}
            accessibilityRole="switch"
            accessibilityState={{
              checked: online,
              disabled: busy || remote.loading || !!remote.error,
            }}
            style={[styles.online, !online && styles.offline]}
          >
            <View
              style={[styles.dot, !online && { backgroundColor: '#98A2B3' }]}
            />
            <Text style={styles.onlineText}>
              {busy
                ? 'Saving…'
                : remote.data
                  ? online
                    ? 'Online'
                    : 'Offline'
                  : 'Unavailable'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.city}>📍 Bhopal, Madhya Pradesh</Text>
      </View>
      <Card style={styles.metrics}>
        <Metric
          value={
            remote.data
              ? String(
                  remote.data.jobs.filter(
                    (j) =>
                      new Date(j.scheduled_start).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      }) ===
                      new Date().toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      }),
                  ).length,
                )
              : '—'
          }
          label="Today shoots"
        />
        <Divider />
        <Metric
          value={
            remote.data
              ? money(
                  remote.data.payouts
                    .filter(isPaidPayout)
                    .reduce((sum, p) => sum + p.amount_paise, 0),
                )
              : '—'
          }
          label="Paid (latest 100)"
        />
        <Divider />
        <Metric
          value={
            stats?.completed_jobs
              ? Math.round((stats.on_time_jobs / stats.completed_jobs) * 100) +
                '%'
              : '—'
          }
          label="On-time"
        />
      </Card>
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      <SectionTitle
        action={
          <Pressable onPress={() => router.push('/jobs')}>
            <Text style={styles.seeAll}>View all</Text>
          </Pressable>
        }
      >
        Current assignment
      </SectionTitle>
      {!remote.loading &&
        !remote.error &&
        (current ? (
          <Card>
            <View style={ui.between}>
              <Text style={styles.jobCode}>{current.booking_code}</Text>
              <Chip label={current.status.replaceAll('_', ' ')} tone="amber" />
            </View>
            <Text style={styles.jobTitle}>
              {current.service?.name || 'Photography'}
            </Text>
            <Text style={styles.jobMeta}>
              {new Date(current.scheduled_start).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}{' '}
              · {current.duration_minutes} min
            </Text>
            <View style={styles.locationRow}>
              <View style={styles.pin}>
                <Text>●</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.label}>{current.location_text}</Text>
              </View>
            </View>
            <Button
              label="Open assignment  ↗"
              onPress={() =>
                router.push({ pathname: '/job', params: { id: current.id } })
              }
            />
          </Card>
        ) : (
          <EmptyState
            title="Ready for your next shoot"
            body="Your assigned photography and videography jobs will appear here."
          />
        ))}
      <SectionTitle>Quick actions</SectionTitle>
      <View style={styles.quickGrid}>
        <Quick icon="▣" label="Jobs" onPress={() => router.push('/jobs')} />
        <Quick
          icon="◷"
          label="Availability"
          onPress={() => router.push('/availability')}
        />
        <Quick
          icon="★"
          label="Performance"
          onPress={() => router.push('/performance')}
        />
        <Quick icon="?" label="Help" onPress={() => router.push('/support')} />
      </View>
      <Card style={styles.locationCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.smallTitle}>Improve job matching</Text>
          <Text style={ui.body}>
            Keep your working location current for nearby shoots.
          </Text>
        </View>
        <Pressable onPress={setCurrentLocation}>
          <Text style={styles.update}>Update</Text>
        </Pressable>
      </Card>
    </Page>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function Divider() {
  return <View style={styles.divider} />;
}
function Quick({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quick}>
      <View style={styles.quickIcon}>
        <Text style={styles.quickIconText}>{icon}</Text>
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -20,
    marginTop: -20,
    padding: 22,
    paddingTop: 28,
    paddingBottom: 54,
    backgroundColor: colors.greenDark,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellText: { color: '#fff', fontSize: 14 },
  profileRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: { color: colors.greenDark, fontWeight: '900', fontSize: 22 },
  hello: { color: '#fff', fontSize: 20, fontWeight: '900' },
  rating: { marginTop: 4, color: '#D9F3E5', fontSize: 13 },
  online: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  offline: { backgroundColor: '#EFF1F0' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#18C96E' },
  onlineText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  city: { marginTop: 15, color: '#D9F3E5', fontSize: 13 },
  metrics: { marginTop: -30, flexDirection: 'row', paddingVertical: 16 },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  metricLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  divider: { width: 1, backgroundColor: colors.line },
  seeAll: { color: colors.green, fontWeight: '800', fontSize: 13 },
  jobCode: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  jobTitle: {
    marginTop: 15,
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
  },
  jobMeta: { marginTop: 5, color: colors.muted },
  locationRow: {
    marginTop: 16,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quick: {
    width: '48.5%',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconText: { color: colors.green, fontWeight: '900', fontSize: 17 },
  quickLabel: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  locationCard: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.mint,
  },
  smallTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  update: { color: colors.green, fontWeight: '900' },
});

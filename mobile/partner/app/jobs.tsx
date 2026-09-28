import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Job = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  location_lat?: number | null;
  location_long?: number | null;
  partner_payout_paise?: number;
  is_open_offer?: boolean;
  offer_expires_at?: string | null;
  service?: { name?: string | null } | null;
  service_level?: { name?: string | null } | null;
};

const NEXT: Record<string, { label: string; to: string }> = {
  PARTNER_ASSIGNED: { label: 'I am on the way', to: 'ON_THE_WAY' },
  ON_THE_WAY: { label: 'Start shoot', to: 'SHOOT_STARTED' },
  SHOOT_STARTED: { label: 'Complete shoot', to: 'SHOOT_COMPLETED' },
  SHOOT_COMPLETED: { label: 'Prepare delivery', to: 'DATA_PENDING' },
};

export default function PartnerJobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [otp, setOtp] = useState<Record<string,string>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.replace('/auth');

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/jobs', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      Alert.alert('Unable to load jobs', result.error || 'Please try again.');
      return;
    }
    setJobs(result.jobs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function respond(job: Job, action: 'accept'|'decline') {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.replace('/auth');

    setBusyId(job.id);
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/jobs/' + job.id + '/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      Alert.alert(action === 'accept' ? 'Job unavailable' : 'Unable to pass', result.error || 'Please refresh.');
      await load();
      return;
    }
    if (action === 'accept') Alert.alert('Job confirmed', 'This Pickolo booking is now yours.');
    await load();
  }

  async function transition(job: Job) {
    const action = NEXT[job.status];
    if (!action || !supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.replace('/auth');

    if (action.to === 'SHOOT_STARTED' && !otp[job.id]?.trim()) {
      Alert.alert('Shoot start code', 'Ask the customer for the 4-digit start code.');
      return;
    }

    setBusyId(job.id);
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/bookings/' + job.id + '/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ to_status: action.to, booking_otp: otp[job.id]?.trim() }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) return Alert.alert('Action failed', result.error || 'Please retry.');
    await load();
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Jobs</Text>
        <Text style={styles.subtitle}>Open jobs go to verified partners in your current Pickolo level. First accept wins.</Text>

        {jobs.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No jobs right now</Text>
            <Text style={styles.muted}>Stay online. Matching jobs in your level will appear here.</Text>
          </View>
        ) : jobs.map((job) => {
          const next = NEXT[job.status];
          return (
            <View key={job.id + String(job.is_open_offer)} style={[styles.card, job.is_open_offer && styles.offer]}>
              <View style={styles.row}>
                <Text style={styles.code}>{job.booking_code}</Text>
                <Text style={styles.badge}>{job.is_open_offer ? 'NEW JOB' : job.status.replaceAll('_',' ')}</Text>
              </View>
              <Text style={styles.cardTitle}>{job.service?.name || 'Photography'} · {job.service_level?.name || 'Standard'}</Text>
              <Text style={styles.muted}>{new Date(job.scheduled_start).toLocaleString()} · {job.duration_minutes / 60} hr</Text>
              <Text style={styles.muted}>{job.location_text}</Text>
              {typeof job.partner_payout_paise === 'number' && (
                <Text style={styles.payout}>You earn ₹{(job.partner_payout_paise / 100).toFixed(0)}</Text>
              )}
              {job.is_open_offer && job.offer_expires_at ? (
                <Text style={styles.expiry}>Open until {new Date(job.offer_expires_at).toLocaleTimeString()}</Text>
              ) : null}

              {job.location_lat != null && job.location_long != null && (
                <Pressable style={styles.secondary} onPress={() => {
                  const q = encodeURIComponent(String(job.location_lat) + ',' + String(job.location_long));
                  Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + q);
                }}><Text style={styles.secondaryText}>Open location</Text></Pressable>
              )}

              {job.is_open_offer ? (
                <View style={styles.actions}>
                  <Pressable style={styles.primaryFlex} disabled={busyId === job.id} onPress={() => respond(job,'accept')}>
                    <Text style={styles.primaryText}>{busyId === job.id ? 'Claiming...' : 'Accept job'}</Text>
                  </Pressable>
                  <Pressable style={styles.pass} disabled={busyId === job.id} onPress={() => respond(job,'decline')}>
                    <Text style={styles.passText}>Pass</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {job.status === 'ON_THE_WAY' && (
                    <TextInput
                      style={styles.input}
                      placeholder="Customer start code"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otp[job.id] || ''}
                      onChangeText={(value) => setOtp((old) => ({ ...old, [job.id]: value }))}
                    />
                  )}
                  {next && (
                    <Pressable style={styles.primary} disabled={busyId === job.id} onPress={() => transition(job)}>
                      <Text style={styles.primaryText}>{busyId === job.id ? 'Updating...' : next.label}</Text>
                    </Pressable>
                  )}
                  {job.status === 'DATA_PENDING' && (
                    <Pressable style={styles.primary} onPress={() => router.push({ pathname: '/delivery', params: { id: job.id } })}>
                      <Text style={styles.primaryText}>Submit delivery</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f0' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#34563d', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '900', color: '#202e29' },
  subtitle: { marginTop: 6, color: '#747d70', lineHeight: 22 },
  card: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe3d7' },
  offer: { borderColor: '#9fb5a4', backgroundColor: '#fbfcf8' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  code: { fontWeight: '900', color: '#202e29' },
  badge: { color: '#34563d', backgroundColor: '#edf2e7', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, fontSize: 10, fontWeight: '900' },
  cardTitle: { marginTop: 13, fontSize: 19, fontWeight: '900', color: '#202e29' },
  muted: { marginTop: 7, color: '#747d70', lineHeight: 21 },
  payout: { marginTop: 13, fontSize: 22, fontWeight: '900', color: '#294f3b' },
  expiry: { marginTop: 7, color: '#a16207', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primary: { marginTop: 14, backgroundColor: '#294f3b', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryFlex: { flex: 1, backgroundColor: '#294f3b', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  pass: { paddingHorizontal: 22, borderRadius: 14, backgroundColor: '#f1f3ee', justifyContent: 'center' },
  passText: { color: '#5d6b61', fontWeight: '800' },
  secondary: { marginTop: 12, borderRadius: 13, backgroundColor: '#edf2e7', paddingVertical: 13, alignItems: 'center' },
  secondaryText: { color: '#34563d', fontWeight: '800' },
  input: { marginTop: 14, borderWidth: 1, borderColor: '#dfe3d7', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
});

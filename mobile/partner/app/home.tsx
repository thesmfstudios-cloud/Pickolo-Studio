import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
import { registerPushToken } from '../../shared/notifications';

type PartnerProfile = {
  verification_status: string;
  is_accepting_jobs: boolean;
  base_lat?: number | null;
  base_long?: number | null;
  service_level?: { name?: string | null } | { name?: string | null }[] | null;
};

export default function PartnerHome() {
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.replace('/auth');

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/profile', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setPartner(result.partner || null);
  }, []);

  useEffect(() => {
    async function initialize() {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace('/auth');

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.user.id).single();

      if (profile?.role === 'customer') return router.replace('/apply');
      if (profile?.role === 'partner') {
        registerPushToken('partner').catch(() => undefined);
        await loadProfile();
      }
    }
    initialize().catch(() => router.replace('/auth'));
  }, [loadProfile]);

  async function patchProfile(changes: Record<string, unknown>) {
    if (!supabase) return false;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return false;
    }
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(changes),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      Alert.alert('Unable to update', result.error || 'Please try again.');
      return false;
    }
    setPartner(result.partner);
    return true;
  }

  async function toggleOnline() {
    setBusy(true);
    const goingOnline = !partner?.is_accepting_jobs;
    if (goingOnline && (partner?.base_lat == null || partner?.base_long == null)) {
      setBusy(false);
      Alert.alert('Add your location first', 'Set your current location before going online for jobs.');
      return;
    }
    await patchProfile({ is_accepting_jobs: goingOnline });
    setBusy(false);
  }

  async function setCurrentLocation() {
    if (!supabase) return;
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location permission', 'Allow location access so Pickolo can match you with nearby jobs.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const saved = await patchProfile({
        base_lat: position.coords.latitude,
        base_long: position.coords.longitude,
      });
      if (saved) Alert.alert('Location saved', 'You can now go online for matching jobs within the Bhopal service area.');
    } catch {
      Alert.alert('Location unavailable', 'We could not read your current location.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) return Alert.alert('Logout failed', error.message);
    router.replace('/auth');
  }

  const serviceLevel = Array.isArray(partner?.service_level)
    ? partner?.service_level[0]
    : partner?.service_level;
  const level = serviceLevel?.name || 'Partner';
  const online = Boolean(partner?.is_accepting_jobs);
  const verified = partner?.verification_status === 'approved';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>PICKOLO PARTNER</Text>
            <Text style={styles.title}>Ready to shoot?</Text>
          </View>
          <Pressable onPress={logout}><Text style={styles.link}>Logout</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.row}>
            <View>
              <Text style={styles.level}>{level}</Text>
              <Text style={styles.muted}>Your current job pool</Text>
            </View>
            {verified ? <Text style={styles.verified}>✓ VERIFIED</Text> : null}
          </View>

          <Pressable
            style={[styles.onlineButton, online ? styles.onlineButtonActive : null]}
            onPress={toggleOnline}
            disabled={busy || !verified}
          >
            <Text style={[styles.onlineText, online ? styles.onlineTextActive : null]}>
              {online ? '● ONLINE · Receiving jobs' : '○ GO ONLINE'}
            </Text>
          </Pressable>
          {!verified ? <Text style={styles.note}>Verification is required before you can receive jobs.</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Job inbox</Text>
          <Text style={styles.muted}>Matching {level} bookings are shared with your pool. First verified partner to accept gets the job.</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/jobs')}>
            <Text style={styles.primaryText}>Open jobs</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your growth</Text>
          <Text style={styles.muted}>Great work, ratings and written reviews build XP and unlock the next Pickolo level.</Text>
          <Pressable style={styles.secondary} onPress={() => router.push('/performance')}>
            <Text style={styles.secondaryText}>View level & XP</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/profile')}>
            <Text style={styles.secondaryText}>Edit public profile & portfolio</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location & availability</Text>
          <Text style={styles.muted}>Pickolo currently matches jobs within 15 km of Rohit Nagar, Bhopal.</Text>
          <Pressable style={styles.secondary} onPress={setCurrentLocation} disabled={busy}>
            <Text style={styles.secondaryText}>{busy ? 'Updating...' : 'Update current location'}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/availability')}>
            <Text style={styles.secondaryText}>Manage availability</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/notifications')}>
            <Text style={styles.secondaryText}>Notifications</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f0' },
  container: { padding: 20, paddingBottom: 40 },
  header: { paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { fontSize: 12, letterSpacing: 2, color: '#56705f', fontWeight: '900' },
  title: { marginTop: 6, fontSize: 30, fontWeight: '900', color: '#202e29' },
  link: { color: '#34563d', fontWeight: '800' },
  hero: { marginTop: 20, padding: 20, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe3d7' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  level: { fontSize: 25, fontWeight: '900', color: '#202e29' },
  verified: { color: '#34563d', backgroundColor: '#edf2e7', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, fontSize: 10, fontWeight: '900' },
  onlineButton: { marginTop: 18, borderRadius: 14, backgroundColor: '#f0f1ed', paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#dfe3d7' },
  onlineButtonActive: { backgroundColor: '#294f3b', borderColor: '#294f3b' },
  onlineText: { color: '#687269', fontWeight: '900' },
  onlineTextActive: { color: '#fff' },
  note: { marginTop: 10, color: '#a16207', lineHeight: 20 },
  card: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe3d7' },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#202e29' },
  muted: { marginTop: 7, color: '#747d70', fontSize: 15, lineHeight: 22 },
  primary: { marginTop: 14, backgroundColor: '#294f3b', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { marginTop: 10, backgroundColor: '#edf2e7', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#34563d', fontWeight: '900' },
});

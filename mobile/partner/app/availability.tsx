import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Slot = { id: string; starts_at: string; ends_at: string; available: boolean };

export default function AvailabilityScreen() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/availability', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert('Unable to load availability', result.error || 'Please try again.');
      return;
    }

    setSlots(result.availability || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addSlot() {
    if (!supabase) return;
    if (!date || !start || !end) {
      Alert.alert('Missing details', 'Enter date, start time and end time.');
      return;
    }

    const begins = new Date(date + 'T' + start);
    const finishes = new Date(date + 'T' + end);

    if (Number.isNaN(begins.getTime()) || Number.isNaN(finishes.getTime()) || finishes <= begins || begins <= new Date()) {
      Alert.alert('Invalid availability', 'Use a future time range with the end after the start.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    setBusy(true);
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        starts_at: begins.toISOString(),
        ends_at: finishes.toISOString(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      Alert.alert('Unable to save', result.error || 'Please try again.');
      return;
    }

    setDate('');
    setStart('');
    setEnd('');
    await load();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Availability</Text>
        <Text style={styles.subtitle}>Tell Pickolo when you can accept nearby assignments.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add availability</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
          <TextInput style={styles.input} placeholder="Start HH:MM" value={start} onChangeText={setStart} />
          <TextInput style={styles.input} placeholder="End HH:MM" value={end} onChangeText={setEnd} />
          <Pressable style={styles.primary} onPress={addSlot} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Saving...' : 'Add time window'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Your windows</Text>
        {slots.length === 0 ? (
          <View style={styles.card}><Text style={styles.muted}>No availability windows added yet.</Text></View>
        ) : slots.map((slot) => (
          <View style={styles.card} key={slot.id}>
            <Text style={styles.rowTitle}>{new Date(slot.starts_at).toLocaleString()}</Text>
            <Text style={styles.muted}>until {new Date(slot.ends_at).toLocaleString()}</Text>
            <Text style={styles.badge}>{slot.available ? 'AVAILABLE' : 'UNAVAILABLE'}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 6, color: '#64748b', lineHeight: 22 },
  card: { marginTop: 14, padding: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 19, fontWeight: '800', color: '#13213a', marginBottom: 12 },
  input: { marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  primary: { marginTop: 14, backgroundColor: '#2563eb', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  sectionTitle: { marginTop: 24, fontSize: 19, fontWeight: '800', color: '#13213a' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: '#13213a' },
  muted: { marginTop: 6, color: '#64748b', lineHeight: 21 },
  badge: { alignSelf: 'flex-start', marginTop: 11, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: 10, fontWeight: '800' },
});

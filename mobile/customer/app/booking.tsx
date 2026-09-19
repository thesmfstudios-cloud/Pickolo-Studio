import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Item = { id: string; name: string };

export default function CustomerBooking() {
  const [services, setServices] = useState<Item[]>([]);
  const [levels, setLevels] = useState<Item[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [duration, setDuration] = useState(60);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [pricePaise, setPricePaise] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from('services').select('id,name').eq('active', true).order('name'),
      supabase.from('service_levels').select('id,name').eq('active', true).order('sort_order'),
    ]).then(([a, b]) => {
      if (a.error || b.error) {
        Alert.alert('Unable to load services', a.error?.message || b.error?.message);
        return;
      }
      setServices(a.data || []);
      setLevels(b.data || []);
      if (a.data?.[0]) setServiceId(a.data[0].id);
      if (b.data?.[0]) setLevelId(b.data[0].id);
    });
  }, []);

  useEffect(() => {
    async function loadPrice() {
      const level = levels.find((item) => item.id === levelId);
      if (!level || ![30, 60, 120].includes(duration)) {
        setPricePaise(null);
        return;
      }

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      const response = await fetch(
        baseUrl + '/api/pricing?level=' + encodeURIComponent(level.name) + '&duration=' + duration,
      );
      const result = await response.json().catch(() => ({}));
      setPricePaise(response.ok ? Number(result.totalPaise) : null);
    }

    loadPrice();
  }, [levels, levelId, duration]);

  async function submit() {
    if (!supabase) {
      Alert.alert('Pickolo', 'Supabase is not configured.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace('/auth');
      return;
    }

    if (!serviceId || !levelId || !date || !time || !location.trim()) {
      Alert.alert('Missing details', 'Complete all required booking details.');
      return;
    }

    const start = new Date(date + 'T' + time);
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      Alert.alert('Invalid time', 'Choose a future date and time.');
      return;
    }

    setBusy(true);

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        service_id: serviceId,
        service_level_id: levelId,
        scheduled_start: start.toISOString(),
        duration_minutes: duration,
        location_text: location.trim(),
      }),
    });

    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      Alert.alert('Booking failed', result.error || 'Unable to create booking.');
      return;
    }

    Alert.alert('Booking created', result.booking?.booking_code || 'Booking created.', [
      { text: 'Done', onPress: () => router.replace('/home') },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Book photography</Text>
        <Text style={styles.subtitle}>Tell Pickolo what you need.</Text>

        <Text style={styles.label}>Service</Text>
        <View style={styles.chips}>
          {services.map((item) => (
            <Pressable key={item.id} style={[styles.chip, serviceId === item.id && styles.chipActive]} onPress={() => setServiceId(item.id)}>
              <Text style={[styles.chipText, serviceId === item.id && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Service level</Text>
        <View style={styles.chips}>
          {levels.map((item) => (
            <Pressable key={item.id} style={[styles.chip, levelId === item.id && styles.chipActive]} onPress={() => setLevelId(item.id)}>
              <Text style={[styles.chipText, levelId === item.id && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Duration</Text>
        <View style={styles.chips}>
          {[30, 60, 120].map((value) => (
            <Pressable key={value} style={[styles.chip, duration === value && styles.chipActive]} onPress={() => setDuration(value)}>
              <Text style={[styles.chipText, duration === value && styles.chipTextActive]}>
                {value === 30 ? '30 min' : value === 60 ? '1 hour' : '2 hours'}
              </Text>
            </Pressable>
          ))}
        </View>

        {pricePaise !== null && (
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Estimated booking total</Text>
            <Text style={styles.price}>₹{(pricePaise / 100).toFixed(0)}</Text>
            <Text style={styles.priceNote}>Final payable amount is server-calculated.</Text>
          </View>
        )}

        <Text style={styles.label}>Date</Text>
        <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />

        <Text style={styles.label}>Time</Text>
        <TextInput style={styles.input} placeholder="HH:MM" value={time} onChangeText={setTime} />

        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} placeholder="Location / landmark" value={location} onChangeText={setLocation} />

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Creating...' : 'Create booking request'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 6, color: '#64748b', fontSize: 16 },
  label: { marginTop: 22, marginBottom: 9, fontSize: 14, fontWeight: '800', color: '#13213a' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 999 },
  chipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  chipText: { color: '#64748b', fontWeight: '700' },
  chipTextActive: { color: '#1d4ed8' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  primary: { marginTop: 28, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  priceCard: { marginTop: 22, padding: 18, borderRadius: 18, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  priceLabel: { color: '#475569', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  price: { marginTop: 5, color: '#13213a', fontSize: 30, fontWeight: '900' },
  priceNote: { marginTop: 4, color: '#64748b', fontSize: 12 },
});

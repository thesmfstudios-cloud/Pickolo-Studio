import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Item = { id: string; name: string };

export default function CustomerBooking() {
  const params = useLocalSearchParams<{ service?: string }>();
  const [when, setWhen] = useState('now');
  const [ack, setAck] = useState(false);
  const [pinLat, setPinLat] = useState('');
  const [pinLng, setPinLng] = useState('');
  const [sliderWidth, setSliderWidth] = useState(1);
  const [priceError, setPriceError] = useState('');
  const [services, setServices] = useState<Item[]>([]);
  const [levels, setLevels] = useState<Item[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [duration, setDuration] = useState(60);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
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
      if (a.data?.[0])
        setServiceId((a.data.find((item) => item.name === params.service) || a.data[0]).id);
      if (b.data?.[0])
        setLevelId((b.data.find((item) => item.name === 'Standard') || b.data[0]).id);
    });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPrice() {
      setPricePaise(null);
      setPriceError('');
      try {
        const level = levels.find((item) => item.id === levelId);
        if (!level || ![60, 120, 180, 240, 300].includes(duration)) {
          setPricePaise(null);
          return;
        }

        const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
        const response = await fetch(
          baseUrl +
            '/api/pricing?level=' +
            encodeURIComponent(level.name) +
            '&duration=' +
            duration +
            '&service=' +
            serviceId,
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Price unavailable.');
        if (active) setPricePaise(Number(result.totalPaise));
      } catch (e) {
        if (active) setPriceError(e instanceof Error ? e.message : 'Price unavailable.');
      }
    }

    loadPrice();
    return () => {
      active = false;
    };
  }, [levels, levelId, duration, serviceId]);

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location permission',
          'Allow Pickolo to use your location for nearby photographer matching.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setPinLat(String(position.coords.latitude));
      setPinLng(String(position.coords.longitude));
    } catch {
      Alert.alert(
        'Location unavailable',
        'We could not read your current location. Enter the location manually.',
      );
    } finally {
      setLocating(false);
    }
  }

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

    if (!serviceId || !levelId || (when === 'later' && (!date || !time)) || !location.trim()) {
      Alert.alert('Missing details', 'Complete all required booking details.');
      return;
    }

    if (!ack || pricePaise === null || !pinLat.trim() || !pinLng.trim()) {
      Alert.alert(
        'Check your details',
        'Add the venue coordinates, wait for pricing and accept the raw-data policy.',
      );
      return;
    }
    const latitude = Number(pinLat),
      longitude = Number(pinLng);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      Alert.alert('Invalid pin', 'Enter valid map coordinates.');
      return;
    }
    const start =
      when === 'now' ? new Date(Date.now() + 60000) : new Date(date + 'T' + time + '+05:30');
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      Alert.alert('Invalid time', 'Choose a future date and time.');
      return;
    }

    setBusy(true);
    try {
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
          location_lat: latitude,
          location_long: longitude,
          raw_data_acknowledged: ack,
        }),
      });

      const result = await response.json().catch(() => ({}));
      setBusy(false);

      if (!response.ok) {
        Alert.alert('Booking failed', result.error || 'Unable to create booking.');
        return;
      }

      router.replace({
        pathname: '/booking-detail',
        params: { id: result.booking?.id },
      });
    } catch (e) {
      Alert.alert('Booking unavailable', e instanceof Error ? e.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Make a little memory.</Text>
        <Text style={styles.subtitle}>Bhopal · Within 15 km of Rohit Nagar.</Text>

        <Text style={styles.label}>Service</Text>
        <View style={styles.chips}>
          {services.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, serviceId === item.id && styles.chipActive]}
              onPress={() => setServiceId(item.id)}
            >
              <Text style={[styles.chipText, serviceId === item.id && styles.chipTextActive]}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Choose your coverage</Text>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Coverage quality"
          accessibilityValue={{
            min: 0,
            max: 2,
            now: Math.max(
              0,
              levels.findIndex((l) => l.id === levelId),
            ),
            text: levels.find((l) => l.id === levelId)?.name,
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const i = levels.findIndex((l) => l.id === levelId);
            setLevelId(
              levels[
                Math.max(
                  0,
                  Math.min(
                    levels.length - 1,
                    i + (e.nativeEvent.actionName === 'increment' ? 1 : -1),
                  ),
                )
              ]?.id || levelId,
            );
          }}
          onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
          onTouchStart={(e) =>
            setLevelId(
              levels[
                Math.max(0, Math.min(2, Math.round((e.nativeEvent.locationX / sliderWidth) * 2)))
              ]?.id || levelId,
            )
          }
          onTouchMove={(e) =>
            setLevelId(
              levels[
                Math.max(0, Math.min(2, Math.round((e.nativeEvent.locationX / sliderWidth) * 2)))
              ]?.id || levelId,
            )
          }
          style={{ height: 44, justifyContent: 'center' }}
        >
          <View
            pointerEvents="none"
            style={{ height: 5, backgroundColor: '#d7dfd1', borderRadius: 5 }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left:
                (Math.max(
                  0,
                  levels.findIndex((l) => l.id === levelId),
                ) /
                  2) *
                Math.max(0, sliderWidth - 26),
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: '#294f3b',
            }}
          />
        </View>
        <View style={styles.chips}>
          {levels.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, levelId === item.id && styles.chipActive]}
              onPress={() => setLevelId(item.id)}
            >
              <Text style={[styles.chipText, levelId === item.id && styles.chipTextActive]}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Duration</Text>
        <View style={styles.chips}>
          {[60, 120, 180, 240, 300].map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, duration === value && styles.chipActive]}
              onPress={() => setDuration(value)}
            >
              <Text style={[styles.chipText, duration === value && styles.chipTextActive]}>
                {value / 60} {value === 60 ? 'hour' : 'hours'}
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

        {priceError ? <Text style={{ color: '#a03124', marginTop: 14 }}>{priceError}</Text> : null}
        <Text style={styles.label}>When?</Text>
        <View style={styles.chips}>
          {[
            ['now', 'Book now'],
            ['later', 'Schedule later'],
          ].map(([v, label]) => (
            <Pressable
              key={v}
              onPress={() => setWhen(v)}
              style={[styles.chip, when === v && styles.chipActive]}
            >
              <Text>{label}</Text>
            </Pressable>
          ))}
        </View>
        {when === 'now' ? (
          <Text style={styles.subtitle}>
            As soon as a professional is available. Arrival is confirmed after assignment.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Date · India time</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
            />

            <Text style={styles.label}>Time</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM"
              value={time}
              onChangeText={setTime}
            />
          </>
        )}

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Location / landmark"
          value={location}
          onChangeText={setLocation}
        />
        <Pressable style={styles.locationButton} onPress={useCurrentLocation} disabled={locating}>
          <Text style={styles.locationButtonText}>
            {locating ? 'Locating...' : coords ? 'Location added' : 'Use current location'}
          </Text>
        </Pressable>

        <Text style={styles.subtitle}>
          At another venue? Enter its map coordinates below. Your pin must match the shoot address.
        </Text>
        <TextInput
          accessibilityLabel="Latitude"
          style={styles.input}
          placeholder="Latitude"
          keyboardType="numbers-and-punctuation"
          value={pinLat}
          onChangeText={setPinLat}
        />
        <TextInput
          accessibilityLabel="Longitude"
          style={styles.input}
          placeholder="Longitude"
          keyboardType="numbers-and-punctuation"
          value={pinLng}
          onChangeText={setPinLng}
        />
        <Text style={styles.label}>A little clarity, upfront.</Text>
        <Text style={styles.subtitle}>
          Shoot coverage and original, unedited files are included. Editing, retouching and edited
          videos are not included. Keep a backup after delivery.
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ack }}
          onPress={() => setAck(!ack)}
          style={styles.locationButton}
        >
          <Text>{ack ? '☑' : '☐'} I understand the raw-data policy.</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>
            {busy ? 'Creating...' : 'Review & continue to payment'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f0' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#34563d', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#202e29' },
  subtitle: { marginTop: 6, color: '#747d70', fontSize: 16 },
  label: { marginTop: 22, marginBottom: 9, fontSize: 14, fontWeight: '800', color: '#202e29' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    borderWidth: 1,
    borderColor: '#dfe3d7',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
  },
  chipActive: { borderColor: '#294f3b', backgroundColor: '#edf2e7' },
  chipText: { color: '#747d70', fontWeight: '700' },
  chipTextActive: { color: '#34563d' },
  input: {
    borderWidth: 1,
    borderColor: '#dfe3d7',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  locationButton: {
    marginTop: 10,
    backgroundColor: '#edf2e7',
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
  },
  locationButtonText: { color: '#34563d', fontWeight: '800' },
  primary: {
    marginTop: 28,
    backgroundColor: '#294f3b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  priceCard: {
    marginTop: 22,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#edf2e7',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  priceLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  price: { marginTop: 5, color: '#202e29', fontSize: 30, fontWeight: '900' },
  priceNote: { marginTop: 4, color: '#747d70', fontSize: 12 },
});

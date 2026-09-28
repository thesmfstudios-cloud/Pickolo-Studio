import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
import { registerPushToken } from '../../shared/notifications';

export default function CustomerHome() {
  const [name, setName] = useState('');

  useEffect(() => {
    registerPushToken('customer').catch(() => undefined);
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/auth');
        return;
      }
      setName(data.user.user_metadata?.full_name || '');
    });
  }, []);

  async function logout() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout failed', error.message);
      return;
    }
    router.replace('/auth');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>PICKOLO</Text>
            <Text style={styles.title}>Hello{name ? ', ' + name : ''}</Text>
          </View>
          <Pressable onPress={logout}>
            <Text style={styles.link}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What are we capturing?</Text>
          <Text style={styles.muted}>
            Photography and videography, within 15 km of Rohit Nagar, Bhopal.
          </Text>
          {['Photography', 'Videography', 'Both'].map((service) => (
            <Pressable
              key={service}
              style={styles.primary}
              onPress={() => router.push({ pathname: '/booking', params: { service } })}
            >
              <Text style={styles.primaryText}>
                {service === 'Photography'
                  ? 'Photographer'
                  : service === 'Videography'
                    ? 'Videographer'
                    : 'Both'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your bookings</Text>
          <Text style={styles.muted}>View booking status, timing and price for every request.</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/bookings')}>
            <Text style={styles.primaryText}>View bookings</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/notifications')}>
            <Text style={styles.secondaryText}>Notifications</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f0' },
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  kicker: { fontSize: 12, letterSpacing: 2.5, color: '#294f3b', fontWeight: '800' },
  title: { marginTop: 5, fontSize: 28, fontWeight: '800', color: '#202e29' },
  link: { color: '#34563d', fontWeight: '700' },
  card: {
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe3d7',
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#202e29' },
  muted: { marginTop: 8, fontSize: 15, lineHeight: 22, color: '#747d70' },
  primary: {
    marginTop: 18,
    backgroundColor: '#294f3b',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: {
    marginTop: 10,
    backgroundColor: '#edf2e7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#34563d', fontWeight: '800' },
});

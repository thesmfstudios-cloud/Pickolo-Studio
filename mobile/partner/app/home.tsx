import { useEffect } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

export default function PartnerHome() {
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth');
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
            <Text style={styles.kicker}>PICKOLO PARTNER</Text>
            <Text style={styles.title}>Partner workspace</Text>
          </View>
          <Pressable onPress={logout}><Text style={styles.link}>Logout</Text></Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.badge}>AVAILABLE</Text>
          <Text style={styles.cardTitle}>Ready for nearby jobs</Text>
          <Text style={styles.muted}>Assignment matching, availability and job actions will connect to the backend in the next partner milestone.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Jobs</Text>
          <Text style={styles.muted}>The partner inbox is reserved for verified eligible assignments.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 20 },
  header: { paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { fontSize: 12, letterSpacing: 2, color: '#2563eb', fontWeight: '800' },
  title: { marginTop: 6, fontSize: 27, fontWeight: '800', color: '#13213a' },
  link: { color: '#1e3a8a', fontWeight: '700' },
  card: { marginTop: 22, padding: 20, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: '800' },
  cardTitle: { marginTop: 12, fontSize: 21, fontWeight: '800', color: '#13213a' },
  muted: { marginTop: 8, color: '#64748b', fontSize: 15, lineHeight: 22 },
});

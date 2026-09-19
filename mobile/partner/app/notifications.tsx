import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Notice = {
  id: string;
  title: string;
  body: string;
  booking_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

export default function PartnerNotifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/notifications', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert('Unable to load notifications', result.error || 'Please try again.');
      return;
    }

    setItems(result.notifications || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    await fetch(baseUrl + '/api/notifications/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ id }),
    });

    await load();
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Job updates and important account events.</Text>

        {items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>You're up to date</Text>
            <Text style={styles.muted}>New assignment events will appear here.</Text>
          </View>
        ) : items.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.card, !item.read_at && styles.unread]}
            onPress={() => markRead(item.id)}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.muted}>{item.body}</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </Pressable>
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
  unread: { borderColor: '#93c5fd' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#13213a' },
  muted: { marginTop: 6, color: '#64748b', lineHeight: 21 },
  time: { marginTop: 10, color: '#94a3b8', fontSize: 12 },
});

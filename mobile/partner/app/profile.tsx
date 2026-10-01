import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
import {
  Button,
  Card,
  Chip,
  Header,
  Page,
  RemoteState,
  SectionTitle,
  ui,
} from '../ui/components';
import { errorMessage, Partner, request } from '../ui/api';
import { useRemote } from '../ui/useRemote';
import { colors } from '../ui/theme';

async function loadProfile() {
  if (!supabase) throw new Error('Pickolo connection is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    router.replace('/auth');
    throw new Error('Please sign in again.');
  }
  const { partner } = await request<{ partner: Partner }>(
    '/api/partner/profile',
  );
  return {
    partner,
    name: String(data.user.user_metadata?.full_name || 'Pickolo Partner'),
    email: data.user.email,
  };
}
export default function ProfileScreen() {
  const remote = useRemote(loadProfile);
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    try {
      if (!supabase) return router.replace('/auth');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/auth');
    } catch (err) {
      Alert.alert('Logout failed', errorMessage(err));
    }
  }
  async function saveUpi() {
    if (!/^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/i.test(upi.trim()))
      return Alert.alert(
        'Invalid UPI ID',
        'Enter a valid UPI ID such as name@upi.',
      );
    setBusy(true);
    try {
      await request('/api/partner/profile', {
        method: 'PATCH',
        body: JSON.stringify({ payout_upi_id: upi.trim().toLowerCase() }),
      });
      setUpi('');
      await remote.reload();
    } catch (err) {
      Alert.alert('Unable to save UPI', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const name = remote.data?.name || 'Pickolo Partner';
  return (
    <Page bottomNav>
      <Header title="Profile" subtitle="Your Pickolo creator identity" />
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {remote.data && !remote.error && (
        <>
          <Card style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name[0]}</Text>
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={ui.body}>{remote.data.email}</Text>
            <Text style={ui.body}>{remote.data.partner.partner_code}</Text>
            <View style={styles.chips}>
              <Chip
                label={remote.data.partner.verification_status.toUpperCase()}
              />
            </View>
            {remote.data.partner.bio && (
              <Text style={[ui.body, { marginTop: 12 }]}>
                {remote.data.partner.bio}
              </Text>
            )}
          </Card>
          <SectionTitle>Payout account</SectionTitle>
          <Card>
            <Text style={ui.body}>
              Current UPI: {remote.data.partner.payout_upi_id || 'Not set'}
            </Text>
            <TextInput
              accessibilityLabel="Payout UPI ID"
              placeholder="New UPI ID"
              value={upi}
              onChangeText={setUpi}
              autoCapitalize="none"
              style={[ui.input, { marginTop: 12 }]}
            />
            <Button
              label={busy ? 'Saving…' : 'Save UPI account'}
              disabled={busy}
              onPress={saveUpi}
            />
          </Card>
        </>
      )}
      <SectionTitle>Account</SectionTitle>
      <Card>
        <Menu
          label="Availability"
          onPress={() => router.push('/availability')}
        />
        <Menu
          label="Performance & XP"
          onPress={() => router.push('/performance')}
        />
        <Menu
          label="Notifications"
          onPress={() => router.push('/notifications')}
        />
        <Menu label="Settings" onPress={() => router.push('/settings')} />
        <Menu label="Help & support" onPress={() => router.push('/support')} />
      </Card>
      <Button label="Log out" variant="danger" onPress={logout} />
    </Page>
  );
}
function Menu({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.menu} onPress={onPress}>
      <Text style={ui.label}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  profile: { alignItems: 'center' },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.green, fontSize: 32, fontWeight: '900' },
  name: { marginTop: 12, color: colors.ink, fontSize: 22, fontWeight: '900' },
  chips: { marginTop: 12, flexDirection: 'row', gap: 8 },
  menu: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chev: { color: colors.muted, fontSize: 26 },
});

import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

export default function PartnerAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function login() {
    if (!supabase) {
      Alert.alert('Pickolo', 'Supabase is not configured.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      Alert.alert('Login failed', error.message);
      return;
    }
    router.replace('/home');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.kicker}>PICKOLO PARTNER</Text>
        <Text style={styles.title}>Partner Login</Text>
        <Text style={styles.subtitle}>Manage nearby assignments and your Pickolo work.</Text>
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Pressable style={styles.primary} onPress={login} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Please wait...' : 'Login'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  kicker: { fontSize: 12, letterSpacing: 2.5, color: '#2563eb', fontWeight: '800' },
  title: { marginTop: 8, fontSize: 34, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 9, color: '#64748b', fontSize: 16, lineHeight: 24 },
  form: { marginTop: 28, gap: 14 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16 },
  primary: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

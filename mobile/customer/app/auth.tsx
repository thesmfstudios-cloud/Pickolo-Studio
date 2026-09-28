import { useState } from 'react';
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
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
export default function CustomerAuth() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!supabase) return Alert.alert('Pickolo', 'Sign-in is not available yet.');
    if (!name.trim() || !/^[6-9]\d{9}$/.test(phone))
      return Alert.alert(
        'Check your details',
        'Enter your name and a 10-digit Indian mobile number.',
      );
    setBusy(true);
    try {
      if (!sent) {
        const r = await supabase.auth.signInWithOtp({
          phone: '+91' + phone,
          options: { data: { full_name: name.trim() } },
        });
        if (r.error) throw r.error;
        setSent(true);
      } else {
        const r = await supabase.auth.verifyOtp({ phone: '+91' + phone, token: otp, type: 'sms' });
        if (r.error) throw r.error;
        const saved = await supabase
          .from('profiles')
          .update({ full_name: name.trim() })
          .eq('id', r.data.user!.id);
        if (saved.error) throw saved.error;
        router.replace('/home');
      }
    } catch (e) {
      Alert.alert('Sign-in', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.kicker}>PICKOLO · BHOPAL</Text>
        <Text style={s.title}>{sent ? 'Check your phone.' : 'Great moments start here.'}</Text>
        <Text style={s.subtitle}>
          {sent
            ? 'Enter the verification code sent to +91 ' + phone
            : 'A photographer or videographer, just a few taps away.'}
        </Text>
        <View style={s.form}>
          <Text>Your name</Text>
          <TextInput
            style={s.input}
            accessibilityLabel="Your name"
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
          {sent ? (
            <>
              <Text>Verification code</Text>
              <TextInput
                style={s.input}
                accessibilityLabel="Verification code"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="sms-otp"
              />
            </>
          ) : (
            <>
              <Text>Mobile number · +91</Text>
              <TextInput
                style={s.input}
                accessibilityLabel="Mobile number"
                placeholder="10-digit mobile number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </>
          )}
          <Pressable style={s.primary} onPress={submit} disabled={busy}>
            <Text style={s.primaryText}>
              {busy ? 'Please wait…' : sent ? 'Verify & continue →' : 'Send verification code →'}
            </Text>
          </Pressable>
          {sent && (
            <Pressable
              onPress={() => {
                setSent(false);
                setOtp('');
              }}
            >
              <Text>Change number or request another code</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f0' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  kicker: { fontSize: 12, letterSpacing: 3, color: '#496340' },
  title: { fontSize: 40, color: '#202e29', marginTop: 20 },
  subtitle: { fontSize: 15, color: '#747d70', lineHeight: 24, marginTop: 16 },
  form: { gap: 14, marginTop: 30 },
  input: {
    backgroundColor: '#fffefb',
    borderWidth: 1,
    borderColor: '#dfe3d7',
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
  },
  primary: { backgroundColor: '#294f3b', padding: 18, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});

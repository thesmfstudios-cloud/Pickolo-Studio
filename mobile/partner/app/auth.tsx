import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
import { Brand } from '../ui/components';

export default function PartnerAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationNotice, setVerificationNotice] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const authRequestPending = useRef(false);

  useEffect(() => {
    if (!resendAt) return;
    const timer = setTimeout(
      () => setResendAt(0),
      Math.max(0, resendAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [resendAt]);

  async function resendVerification() {
    if (authRequestPending.current || resendAt > Date.now()) return;
    if (!supabase) {
      Alert.alert(
        'Pickolo',
        'Pickolo connection is unavailable. Please contact support.',
      );
      return;
    }
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert(
        'Email required',
        'Enter the email address you used to create your account.',
      );
      return;
    }
    authRequestPending.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      });
      if (error) {
        if (
          error.status === 429 ||
          error.code === 'over_email_send_rate_limit'
        ) {
          setResendAt(Date.now() + 60_000);
        }
        Alert.alert('Could not resend email', error.message);
        return;
      }
      setVerificationNotice(true);
      setResendAt(Date.now() + 60_000);
      Alert.alert(
        'Verification email requested',
        'Check Inbox and Spam. If this account needs verification, use the link in the newest email, then return here to log in. Older links may no longer work.',
      );
    } catch {
      Alert.alert(
        'Connection interrupted',
        'Check your internet and try again.',
      );
    } finally {
      authRequestPending.current = false;
      setBusy(false);
    }
  }

  async function submitAuth() {
    if (authRequestPending.current) return;
    if (!supabase) {
      Alert.alert(
        'Pickolo',
        'Pickolo connection is unavailable. Please contact support.',
      );
      return;
    }

    const normalizedEmail = email.trim();
    const normalizedName = fullName.trim();
    const normalizedPhone = phone.trim();

    if (
      !normalizedEmail ||
      !password ||
      (mode === 'signup' && (!normalizedName || !normalizedPhone))
    ) {
      Alert.alert('Missing details', 'Please complete all required fields.');
      return;
    }

    authRequestPending.current = true;
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            })
          : await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: {
                data: {
                  full_name: normalizedName,
                  phone: normalizedPhone,
                },
              },
            });

      setBusy(false);

      if (result.error) {
        if (result.error.code === 'email_not_confirmed') {
          setVerificationNotice(true);
          Alert.alert(
            'Verify your email',
            'Open the newest confirmation email. If its link expired, use Resend verification email below.',
          );
          return;
        }
        Alert.alert(
          mode === 'login' ? 'Login failed' : 'Account creation failed',
          result.error.message,
        );
        return;
      }

      if (mode === 'signup' && !result.data.session) {
        setVerificationNotice(true);
        setResendAt(Date.now() + 60_000);
        setMode('login');
        setPassword('');
        Alert.alert(
          'Account created',
          'Check Inbox and Spam and confirm your email using the newest link. Then return here to log in. If the link expires, resend it below.',
        );
        return;
      }

      router.replace(mode === 'signup' ? '/apply' : '/home');
    } catch {
      Alert.alert(
        'Connection interrupted',
        'Check your internet and try again.',
      );
    } finally {
      authRequestPending.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Brand />
          <Text style={styles.title}>
            {mode === 'login' ? 'Partner Login' : 'Create partner account'}
          </Text>
          <Text style={styles.subtitle}>
            Manage nearby assignments and your Pickolo work.
          </Text>

          <View style={styles.form}>
            {verificationNotice && (
              <View
                style={styles.verificationCard}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.verificationTitle}>Verify your email</Text>
                <Text style={styles.verificationText}>
                  Open the newest email in Inbox or Spam, confirm your address,
                  then return here to log in. If the link is invalid or expired,
                  request a fresh one below.
                </Text>
              </View>
            )}
            {mode === 'signup' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  value={fullName}
                  onChangeText={setFullName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Pressable
              style={styles.primary}
              onPress={submitAuth}
              disabled={busy}
            >
              <Text style={styles.primaryText}>
                {busy
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Login'
                    : 'Create account'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resend verification email"
              accessibilityState={{ disabled: busy || resendAt > 0 }}
              disabled={busy || resendAt > 0}
              style={[
                styles.secondary,
                (busy || resendAt > 0) && styles.disabled,
              ]}
              onPress={resendVerification}
            >
              <Text style={styles.secondaryText}>
                {resendAt > 0
                  ? 'Please wait before resending'
                  : 'Resend verification email'}
              </Text>
            </Pressable>

            <Pressable
              disabled={busy}
              style={styles.secondary}
              onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              <Text style={styles.secondaryText}>
                {mode === 'login'
                  ? 'Create partner account'
                  : 'Already have an account? Login'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9F8' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  kicker: {
    fontSize: 12,
    letterSpacing: 2.5,
    color: '#087443',
    fontWeight: '800',
  },
  title: { marginTop: 8, fontSize: 34, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 9, color: '#64748b', fontSize: 16, lineHeight: 24 },
  form: { marginTop: 28, gap: 14 },
  verificationCard: {
    backgroundColor: '#E9F5EE',
    padding: 16,
    borderRadius: 14,
    gap: 6,
  },
  verificationTitle: { color: '#045B35', fontWeight: '800', fontSize: 16 },
  verificationText: { color: '#345B48', fontSize: 14, lineHeight: 21 },
  disabled: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#E7ECE9',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
  },
  primary: {
    backgroundColor: '#087443',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#045B35', fontWeight: '800' },
});

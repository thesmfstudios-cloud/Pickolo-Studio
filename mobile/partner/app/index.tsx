import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
import { Brand } from '../ui/components';
import { colors } from '../ui/theme';

export default function Index() {
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await supabase?.auth.getSession();
        if (active) router.replace(result?.data.session ? '/home' : '/auth');
      } catch {
        if (active) router.replace('/auth');
      }
    }, 900);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  return (
    <View style={styles.screen}>
      <View style={styles.mark}>
        <Text style={styles.markText}>P</Text>
      </View>
      <Brand light />
      <Text style={styles.line}>Shoot. Create. Earn.</Text>
      <ActivityIndicator style={styles.loader} color="#fff" />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 82,
    height: 82,
    borderRadius: 25,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    transform: [{ rotate: '-6deg' }],
  },
  markText: { color: colors.greenDark, fontWeight: '900', fontSize: 48 },
  line: { color: '#D6F0E2', marginTop: 14, fontWeight: '700' },
  loader: { marginTop: 50 },
});

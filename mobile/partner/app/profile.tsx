import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';
import { Button, Card, Chip, Header, Page, SectionTitle, ui } from '../ui/components';
import { colors } from '../ui/theme';

export default function ProfileScreen() {
  const [name, setName] = useState('Pickolo Partner'); const [email, setEmail] = useState('');
  useEffect(() => { supabase?.auth.getUser().then(({ data }) => { if (data.user) { setName(data.user.user_metadata?.full_name || 'Pickolo Partner'); setEmail(data.user.email || ''); } }); }, []);
  async function logout() { const { error } = await supabase!.auth.signOut(); if (error) return Alert.alert('Logout failed', error.message); router.replace('/auth'); }
  return <Page bottomNav><Header title="Profile" subtitle="Your Pickolo creator identity" />
    <Card style={styles.profile}><View style={styles.avatar}><Text style={styles.avatarText}>{name[0]}</Text></View><Text style={styles.name}>{name}</Text><Text style={ui.body}>{email}</Text><View style={styles.chips}><Chip label="✓ VERIFIED" /><Chip label="LEVEL 3" tone="amber" /></View></Card>
    <SectionTitle>Portfolio</SectionTitle><Card><View style={styles.portfolio}><Tile label="Wedding" /><Tile label="Portrait" /><Tile label="Events" /></View><Button label="Manage portfolio" variant="secondary" onPress={() => router.push('/apply')} /></Card>
    <SectionTitle>Account</SectionTitle><Card><Menu label="Availability" onPress={() => router.push('/availability')} /><Menu label="Performance & levels" onPress={() => router.push('/performance')} /><Menu label="Notifications" onPress={() => router.push('/notifications')} /><Menu label="Settings" onPress={() => router.push('/settings')} /><Menu label="Help & support" onPress={() => router.push('/support')} /></Card>
    <Button label="Log out" variant="danger" onPress={logout} />
  </Page>;
}
function Tile({ label }: { label: string }) { return <View style={styles.tile}><Text style={styles.camera}>◎</Text><Text style={styles.tileLabel}>{label}</Text></View>; }
function Menu({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable style={styles.menu} onPress={onPress}><Text style={ui.label}>{label}</Text><Text style={styles.chev}>›</Text></Pressable>; }
const styles = StyleSheet.create({ profile: { alignItems: 'center' }, avatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.green, fontSize: 32, fontWeight: '900' }, name: { marginTop: 12, color: colors.ink, fontSize: 22, fontWeight: '900' }, chips: { marginTop: 12, flexDirection: 'row', gap: 8 }, portfolio: { flexDirection: 'row', gap: 9 }, tile: { flex: 1, aspectRatio: .9, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, camera: { color: colors.green, fontSize: 24, fontWeight: '900' }, tileLabel: { marginTop: 7, color: colors.greenDark, fontSize: 11, fontWeight: '800' }, menu: { height: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }, chev: { color: colors.muted, fontSize: 26 } });

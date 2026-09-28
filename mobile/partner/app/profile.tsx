import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Media = { id: string; image_url: string; caption?: string | null };

export default function PartnerProfileScreen() {
  const [bio, setBio] = useState('');
  const [level, setLevel] = useState('');
  const [verified, setVerified] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return router.replace('/auth');

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/profile', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setBio(result.partner?.bio || '');
      setVerified(result.partner?.verification_status === 'approved');
      const serviceLevel = Array.isArray(result.partner?.service_level) ? result.partner.service_level[0] : result.partner?.service_level;
      setLevel(serviceLevel?.name || '');
    }

    const { data } = await supabase
      .from('partner_portfolio_media')
      .select('id,image_url,caption')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(6);
    setMedia(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveBio() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.replace('/auth');
    setBusy(true);
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ bio }),
    });
    setBusy(false);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return Alert.alert('Unable to save', result.error || 'Please try again.');
    Alert.alert('Profile updated', 'Customers will see this after you accept their booking.');
  }

  async function addPhoto() {
    if (!supabase) return;
    if (media.length >= 6) return Alert.alert('Portfolio full', 'Keep up to 6 strong work samples.');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access', 'Allow photo access to add portfolio work.');

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (picked.canceled || !picked.assets[0]) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return router.replace('/auth');

    setBusy(true);
    try {
      const asset = picked.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = (asset.fileName?.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();
      const path = user.id + '/' + Date.now() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('partner-portfolio').upload(path, blob, {
        contentType: asset.mimeType || 'image/jpeg',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('partner-portfolio').getPublicUrl(path);
      const { error: rowError } = await supabase.from('partner_portfolio_media').insert({
        partner_id: user.id,
        image_url: publicUrl.publicUrl,
        storage_path: path,
        sort_order: media.length,
      });
      if (rowError) throw rowError;
      await load();
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(item: Media) {
    if (!supabase) return;
    setBusy(true);
    await supabase.from('partner_portfolio_media').delete().eq('id', item.id);
    setBusy(false);
    await load();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Public profile</Text>
        <Text style={styles.subtitle}>This is what a customer sees after you win a booking. Contact details stay private.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.level}>{level || 'Pickolo Partner'}</Text>
            {verified ? <Text style={styles.verified}>✓ VERIFIED</Text> : null}
          </View>
          <Text style={styles.label}>Short bio</Text>
          <TextInput style={styles.input} multiline value={bio} onChangeText={setBio}
            placeholder="Tell customers about your photography style and experience." />
          <Pressable style={styles.primary} onPress={saveBio} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Saving...' : 'Save profile'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Portfolio · {media.length}/6</Text>
          <Text style={styles.muted}>Add only your strongest recent work. These photos help customers trust their assigned partner.</Text>
          <View style={styles.grid}>
            {media.map((item) => (
              <Pressable key={item.id} style={styles.photoWrap} onLongPress={() => removePhoto(item)}>
                <Image source={{ uri: item.image_url }} style={styles.photo} />
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.secondary} onPress={addPhoto} disabled={busy || media.length >= 6}>
            <Text style={styles.secondaryText}>{media.length >= 6 ? '6 photos added' : '+ Add portfolio photo'}</Text>
          </Pressable>
          <Text style={styles.hint}>Tip: long-press a photo to remove it.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f0' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#34563d', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '900', color: '#202e29' },
  subtitle: { marginTop: 6, color: '#747d70', lineHeight: 22 },
  card: { marginTop: 16, padding: 18, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe3d7' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: { fontSize: 18, fontWeight: '900', color: '#202e29' },
  verified: { color: '#34563d', backgroundColor: '#edf2e7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 10, fontWeight: '900' },
  label: { marginTop: 18, marginBottom: 8, color: '#747d70', fontWeight: '800' },
  input: { minHeight: 110, borderWidth: 1, borderColor: '#dfe3d7', borderRadius: 14, padding: 14, textAlignVertical: 'top', backgroundColor: '#fff' },
  primary: { marginTop: 12, borderRadius: 14, backgroundColor: '#294f3b', paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  cardTitle: { fontSize: 19, fontWeight: '900', color: '#202e29' },
  muted: { marginTop: 6, color: '#747d70', lineHeight: 21 },
  grid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#ecefe8' },
  photo: { width: '100%', height: '100%' },
  secondary: { marginTop: 14, borderRadius: 14, backgroundColor: '#edf2e7', paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#34563d', fontWeight: '900' },
  hint: { marginTop: 8, color: '#9aa197', fontSize: 12 },
});

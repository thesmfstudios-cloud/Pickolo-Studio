import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../shared/supabase';

type SelectedAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

type UploadAsset = {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
};

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [assets, setAssets] = useState<SelectedAsset[]>([]);
  const [busy, setBusy] = useState(false);

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access', 'Allow photo access to select delivery files.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 1,
    });

    if (!result.canceled) {
      setAssets(result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
      })));
    }
  }

  async function uploadAndFinalize() {
    if (!supabase || !id) return;

    if (!assets.length) {
      Alert.alert('No photos selected', 'Select at least one photo.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const uploaded: UploadAsset[] = [];

    setBusy(true);

    try {
      for (const asset of assets) {
        const uploadUrlResponse = await fetch(baseUrl + '/api/partner/jobs/' + id + '/delivery/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({
            file_name: asset.fileName || 'photo.jpg',
            mime_type: asset.mimeType || 'image/jpeg',
            size_bytes: asset.fileSize ?? null,
          }),
        });

        const uploadInfo = await uploadUrlResponse.json().catch(() => ({}));

        if (!uploadUrlResponse.ok) {
          throw new Error(uploadInfo.error || 'Unable to prepare an upload.');
        }

        const fileResponse = await fetch(asset.uri);
        const blob = await fileResponse.blob();

        const { error: uploadError } = await supabase.storage
          .from('booking-deliveries')
          .uploadToSignedUrl(
            uploadInfo.path,
            uploadInfo.token,
            blob,
            { contentType: asset.mimeType || 'image/jpeg' },
          );

        if (uploadError) throw new Error(uploadError.message);

        uploaded.push({
          path: uploadInfo.path,
          fileName: uploadInfo.fileName,
          mimeType: uploadInfo.mimeType,
          sizeBytes: uploadInfo.sizeBytes,
        });
      }

      const finalizeResponse = await fetch(
        baseUrl + '/api/partner/jobs/' + id + '/delivery/finalize',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ assets: uploaded }),
        },
      );

      const finalizeResult = await finalizeResponse.json().catch(() => ({}));

      if (!finalizeResponse.ok) {
        throw new Error(finalizeResult.error || 'Unable to finalize delivery.');
      }

      Alert.alert(
        'Delivery submitted',
        uploaded.length + ' photo' + (uploaded.length === 1 ? '' : 's') + ' securely delivered.',
        [{ text: 'Done', onPress: () => router.replace('/jobs') }],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      Alert.alert('Delivery failed', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Deliver photos</Text>
        <Text style={styles.subtitle}>Select completed photos. Pickolo uploads them to private booking storage.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected</Text>
          <Text style={styles.count}>{assets.length} photo{assets.length === 1 ? '' : 's'}</Text>
          <Pressable style={styles.secondary} onPress={pickPhotos} disabled={busy}>
            <Text style={styles.secondaryText}>{assets.length ? 'Change selection' : 'Select photos'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery</Text>
          <Text style={styles.muted}>Files remain private. Customers receive time-limited access after submission.</Text>
          <Pressable style={styles.primary} onPress={uploadAndFinalize} disabled={busy || !assets.length}>
            <Text style={styles.primaryText}>{busy ? 'Uploading securely...' : 'Upload & submit delivery'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 7, color: '#64748b', lineHeight: 22 },
  card: { marginTop: 18, padding: 20, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#13213a' },
  count: { marginTop: 8, fontSize: 28, fontWeight: '900', color: '#13213a' },
  muted: { marginTop: 8, color: '#64748b', lineHeight: 21 },
  primary: { marginTop: 16, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: { marginTop: 14, backgroundColor: '#eef2ff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#1e3a8a', fontWeight: '800' },
});

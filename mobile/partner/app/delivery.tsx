import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { errorMessage, request } from '../ui/api';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [progress, setProgress] = useState(0);

  async function pickPhotos() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo access',
          'Allow photo access to select delivery files.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: 50,
        quality: 1,
      });

      if (!result.canceled) {
        setAssets(
          result.assets.map((asset) => ({
            uri: asset.uri,
            fileName: asset.fileName,
            mimeType:
              asset.mimeType ||
              (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
            fileSize: asset.fileSize,
          })),
        );
      }
    } catch (err) {
      Alert.alert('Unable to select files', errorMessage(err));
    }
  }

  async function uploadAndFinalize() {
    if (!supabase)
      return Alert.alert('Pickolo', 'Pickolo connection is not configured.');
    if (!id)
      return Alert.alert(
        'No assignment selected',
        'Open delivery from an active job.',
      );

    if (!assets.length) {
      Alert.alert('No photos selected', 'Select at least one photo.');
      return;
    }

    const uploaded: UploadAsset[] = [];

    setBusy(true);
    setProgress(0);

    try {
      for (const asset of assets) {
        if (
          asset.fileSize != null &&
          (asset.fileSize <= 0 || asset.fileSize > 500 * 1024 * 1024)
        )
          throw new Error('Each file must be between 1 byte and 500 MB.');
        const uploadInfo = await request<UploadAsset & { token: string }>(
          '/api/partner/jobs/' + id + '/delivery/upload-url',
          {
            method: 'POST',
            body: JSON.stringify({
              file_name: asset.fileName || 'photo.jpg',
              mime_type: asset.mimeType || 'image/jpeg',
              size_bytes: asset.fileSize ?? null,
            }),
          },
        );

        const bytes = await new File(asset.uri).arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('booking-deliveries')
          .uploadToSignedUrl(uploadInfo.path, uploadInfo.token, bytes, {
            contentType: asset.mimeType || 'image/jpeg',
          });

        if (uploadError) throw new Error(uploadError.message);

        uploaded.push({
          path: uploadInfo.path,
          fileName: uploadInfo.fileName,
          mimeType: uploadInfo.mimeType,
          sizeBytes: uploadInfo.sizeBytes,
        });
        setProgress(uploaded.length);
      }

      await request('/api/partner/jobs/' + id + '/delivery/finalize', {
        method: 'POST',
        body: JSON.stringify({ assets: uploaded }),
      });

      Alert.alert(
        'Delivery submitted',
        uploaded.length +
          ' file' +
          (uploaded.length === 1 ? '' : 's') +
          ' securely delivered.',
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
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Deliver your work</Text>
        <Text style={styles.subtitle}>
          Select final photos and videos. Each file can be up to 500 MB.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected</Text>
          <Text style={styles.count}>
            {assets.length} file{assets.length === 1 ? '' : 's'}
          </Text>
          <Pressable
            style={styles.secondary}
            onPress={pickPhotos}
            disabled={busy}
          >
            <Text style={styles.secondaryText}>
              {assets.length ? 'Change selection' : 'Select photos & videos'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery</Text>
          <Text style={styles.muted}>
            Files remain private. Customers receive time-limited access after
            submission.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={uploadAndFinalize}
            disabled={busy || !assets.length}
          >
            <Text style={styles.primaryText}>
              {busy
                ? `Uploading ${progress}/${assets.length}…`
                : 'Upload & submit delivery'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9F8' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#087443', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 7, color: '#64748b', lineHeight: 22 },
  card: {
    marginTop: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#13213a' },
  count: { marginTop: 8, fontSize: 28, fontWeight: '900', color: '#13213a' },
  muted: { marginTop: 8, color: '#64748b', lineHeight: 21 },
  primary: {
    marginTop: 16,
    backgroundColor: '#087443',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: {
    marginTop: 14,
    backgroundColor: '#E9F8F0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#045B35', fontWeight: '800' },
});

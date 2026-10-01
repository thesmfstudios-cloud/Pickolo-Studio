import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from '../../shared/supabase';
import {
  Button,
  Card,
  EmptyState,
  Header,
  Page,
  RemoteState,
  ui,
} from '../ui/components';
import { errorMessage } from '../ui/api';
import { useRemote } from '../ui/useRemote';
import { colors } from '../ui/theme';

const MAX_IMAGES = 6;
const MAX_BYTES = 20 * 1024 * 1024;
async function loadPortfolio() {
  if (!supabase) throw new Error('Pickolo connection is not configured.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Please sign in again.');
  const bucket = supabase.storage.from('partner-portfolio');
  const { data: objects, error } = await bucket.list(auth.user.id, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw error;
  const files = (objects ?? []).filter((object) => object.id);
  const images = await Promise.all(
    files.map(async (object) => {
      const path = auth.user.id + '/' + object.name;
      const { data, error: signedError } = await bucket.createSignedUrl(
        path,
        600,
      );
      if (signedError || !data?.signedUrl)
        throw signedError || new Error('Unable to load portfolio image.');
      return { path, name: object.name, url: data.signedUrl };
    }),
  );
  return { ownerId: auth.user.id, images };
}

export default function PortfolioScreen() {
  const remote = useRemote(loadPortfolio);
  const [busy, setBusy] = useState(false);
  async function addPhoto() {
    if (!supabase || !remote.data || busy) return;
    setBusy(true);
    try {
      // Recheck saved objects, not just the potentially stale screen count.
      const latest = await loadPortfolio();
      if (latest.images.length >= MAX_IMAGES)
        throw new Error(
          'Your portfolio can contain up to 6 photos. Remove one before adding another.',
        );
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error('Allow photo access to add a portfolio photo.');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      const extension = (
        {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/heic': 'heic',
          'image/heif': 'heif',
        } as Record<string, string>
      )[mime];
      if (!extension)
        throw new Error('Choose a JPEG, PNG, WebP or HEIC photo.');
      if (asset.fileSize && asset.fileSize > MAX_BYTES)
        throw new Error('Portfolio photos must be 20 MB or smaller.');
      const bytes = await new File(asset.uri).arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES)
        throw new Error('Portfolio photos must be between 1 byte and 20 MB.');
      const path =
        latest.ownerId +
        '/' +
        Date.now() +
        '-' +
        Math.random().toString(36).slice(2) +
        '.' +
        extension;
      const { error } = await supabase.storage
        .from('partner-portfolio')
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw error;
      await remote.reload();
      Alert.alert(
        'Photo added',
        'Your portfolio photo is saved privately for your Pickolo account.',
      );
    } catch (err) {
      Alert.alert('Unable to add photo', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  function confirmRemove(path: string) {
    if (busy) return;
    Alert.alert(
      'Remove portfolio photo?',
      'This removes the saved photo from your Pickolo portfolio.',
      [
        { text: 'Keep photo', style: 'cancel' },
        {
          text: 'Remove photo',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              if (
                !supabase ||
                !remote.data ||
                !path.startsWith(remote.data.ownerId + '/')
              )
                throw new Error('Invalid portfolio photo.');
              const { error } = await supabase.storage
                .from('partner-portfolio')
                .remove([path]);
              if (error) throw error;
              await remote.reload();
            } catch (err) {
              Alert.alert('Unable to remove photo', errorMessage(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }
  return (
    <Page>
      <Header
        title="Your portfolio"
        subtitle="Showcase your photography style"
        back
      />
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {remote.data && !remote.error && (
        <>
          <Card>
            <Text style={ui.label}>
              {remote.data.images.length} of {MAX_IMAGES} photos
            </Text>
            <Text style={ui.body}>
              Choose your strongest original work. Only upload images you have
              permission to use. Photos are saved in private storage, not a
              public gallery.
            </Text>
          </Card>
          {!remote.data.images.length && (
            <EmptyState
              title="Your work belongs here"
              body="Add your first portfolio photo. Portraits, events and product photography all tell your story."
            />
          )}
          <View style={styles.grid}>
            {remote.data.images.map((image, index) => (
              <View key={image.path} style={styles.tile}>
                <Image
                  source={{ uri: image.url }}
                  accessibilityLabel={'Portfolio photo ' + (index + 1)}
                  resizeMode="cover"
                  style={styles.image}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'Remove portfolio photo ' + (index + 1)}
                  disabled={busy}
                  onPress={() => confirmRemove(image.path)}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>Remove photo</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Button
            label={busy ? 'Updating portfolio…' : 'Add portfolio photo'}
            disabled={
              busy || remote.loading || remote.data.images.length >= MAX_IMAGES
            }
            onPress={addPhoto}
          />
          <Button
            label="Refresh portfolio"
            variant="secondary"
            disabled={busy || remote.loading}
            onPress={remote.reload}
          />
          <Text style={ui.body}>
            JPEG, PNG, WebP or HEIC · Up to 20 MB each
          </Text>
        </>
      )}
    </Page>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    borderRadius: 18,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  image: { width: '100%', aspectRatio: 1 },
  remove: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.danger, fontWeight: '700' },
});

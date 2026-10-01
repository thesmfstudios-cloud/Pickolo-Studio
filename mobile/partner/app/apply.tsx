import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  Alert,
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
import { Application, errorMessage, request } from '../ui/api';

export default function PartnerApply() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upi, setUpi] = useState('');
  const [saved, setSaved] = useState(false);
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<
    Array<{
      id: string;
      document_type: string;
      file_name: string;
      status: string;
    }>
  >([]);
  const [docBusy, setDocBusy] = useState(false);

  useEffect(() => {
    async function loadExistingDocuments() {
      if (!supabase) return;
      const { application } = await request<{
        application: Application | null;
      }>('/api/partner/application');
      if (application) {
        setName(application.display_name);
        setPhone(application.phone);
        setUpi(application.payout_upi_id || '');
        setBio(application.bio || '');
        setSkills(application.skills.join(', '));
        setSaved(true);
        if (application.base_lat != null && application.base_long != null)
          setCoords({
            latitude: application.base_lat,
            longitude: application.base_long,
          });
        if (
          application.status === 'pending' ||
          application.status === 'approved'
        )
          await loadDocuments();
      }
    }
    loadExistingDocuments().catch((error) =>
      Alert.alert('Unable to load application', errorMessage(error)),
    );
  }, []);

  async function locate() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location permission',
          'Location helps Pickolo match you with nearby assignments.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      Alert.alert(
        'Location unavailable',
        'Enter your details now. Location can be added later.',
      );
    } finally {
      setLocating(false);
    }
  }

  async function loadDocuments() {
    const result = await request<{ documents: typeof documents }>(
      '/api/partner/documents',
    );
    setDocuments(result.documents || []);
  }

  async function uploadDocument() {
    if (!supabase) return;
    setDocBusy(true);
    try {
      const permission = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (permission.canceled) return;
      const asset = permission.assets[0];
      if (!asset) return;
      if (!asset.size || asset.size > 20 * 1024 * 1024)
        return Alert.alert(
          'Document too large',
          'Choose an image or PDF with a known size up to 20 MB.',
        );

      const upload = await request<{ path: string; token: string }>(
        '/api/partner/documents/upload-url',
        {
          method: 'POST',
          body: JSON.stringify({
            document_type: 'identity',
            file_name: asset.name,
            mime_type: asset.mimeType || 'application/octet-stream',
            size_bytes: asset.size || 0,
          }),
        },
      );

      const bytes = await new File(asset.uri).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('partner-documents')
        .uploadToSignedUrl(upload.path, upload.token, bytes, {
          contentType: asset.mimeType || 'application/octet-stream',
        });

      if (uploadError) throw new Error(uploadError.message);

      await loadDocuments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Document upload failed.';
      Alert.alert('Document upload', message);
    } finally {
      setDocBusy(false);
    }
  }

  async function submit() {
    if (!supabase) return;
    if (!name.trim() || !phone.trim() || !upi.trim()) {
      Alert.alert('Missing details', 'Name, phone and UPI ID are required.');
      return;
    }
    if (!/^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/i.test(upi.trim()))
      return Alert.alert(
        'Invalid UPI ID',
        'Enter a valid UPI ID, for example name@upi.',
      );

    setBusy(true);
    try {
      await request('/api/partner/apply', {
        method: 'POST',
        body: JSON.stringify({
          display_name: name.trim(),
          phone: phone.trim(),
          payout_upi_id: upi.trim().toLowerCase(),
          bio: bio.trim() || null,
          skills: skills
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          base_lat: coords?.latitude ?? null,
          base_long: coords?.longitude ?? null,
        }),
      });
      setSaved(true);

      Alert.alert(
        'Application saved',
        'You can now upload verification documents below.',
        [
          { text: 'Add documents' },
          { text: 'Continue', onPress: () => router.replace('/verification') },
        ],
      );
    } catch (error) {
      Alert.alert('Application failed', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.kicker}>PICKOLO PARTNER</Text>
        <Text style={styles.title}>Apply to become a partner</Text>
        <Text style={styles.subtitle}>
          Tell us what you shoot and where you operate.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="UPI ID (name@upi)"
          value={upi}
          onChangeText={setUpi}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.area]}
          placeholder="Short bio"
          value={bio}
          onChangeText={setBio}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Skills, comma separated"
          value={skills}
          onChangeText={setSkills}
        />

        <Pressable
          style={styles.secondary}
          onPress={locate}
          disabled={locating}
        >
          <Text style={styles.secondaryText}>
            {locating
              ? 'Locating...'
              : coords
                ? 'Location added'
                : 'Use current location'}
          </Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification documents</Text>
          <Text style={styles.muted}>
            {saved
              ? 'Upload identity images or PDFs up to 20 MB. Files remain private until reviewed.'
              : 'Save your application first, then add your verification documents here.'}
          </Text>
          <Pressable
            style={styles.secondary}
            onPress={uploadDocument}
            disabled={docBusy || !saved}
          >
            <Text style={styles.secondaryText}>
              {docBusy ? 'Uploading...' : 'Upload document'}
            </Text>
          </Pressable>
          {documents.map((doc) => (
            <View key={doc.id} style={styles.documentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.documentName}>{doc.file_name}</Text>
                <Text style={styles.muted}>
                  {doc.document_type} · {doc.status}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>
            {busy ? 'Submitting...' : 'Submit application'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9F8' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#087443', fontWeight: '800', fontSize: 16 },
  kicker: {
    marginTop: 22,
    fontSize: 12,
    letterSpacing: 2.5,
    color: '#087443',
    fontWeight: '800',
  },
  title: { marginTop: 7, fontSize: 31, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 7, color: '#64748b', lineHeight: 22 },
  input: {
    marginTop: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  area: { minHeight: 110, textAlignVertical: 'top' },
  secondary: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#E9F8F0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#045B35', fontWeight: '800' },
  primary: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#087443',
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  card: {
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 19, fontWeight: '800', color: '#13213a' },
  muted: { marginTop: 6, color: '#64748b', lineHeight: 21 },
  documentRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  documentName: { fontWeight: '800', color: '#13213a' },
});

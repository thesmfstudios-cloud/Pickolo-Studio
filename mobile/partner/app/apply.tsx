import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

export default function PartnerApply() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<Array<{ id: string; document_type: string; file_name: string; status: string }>>([]);
  const [docBusy, setDocBusy] = useState(false);

  useEffect(() => {
    async function loadExistingDocuments() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await loadDocuments(token);
    }
    loadExistingDocuments();
  }, []);

  async function locate() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location permission', 'Location helps Pickolo match you with nearby assignments.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      Alert.alert('Location unavailable', 'Enter your details now. Location can be added later.');
    } finally {
      setLocating(false);
    }
  }

  async function loadDocuments(token: string) {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/documents', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setDocuments(result.documents || []);
  }

  async function uploadDocument() {
    if (!supabase) return;
    const permission = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (permission.canceled) return;
    const asset = permission.assets[0];
    if (!asset) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    setDocBusy(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      const response = await fetch(baseUrl + '/api/partner/documents/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          document_type: 'identity',
          file_name: asset.name,
          mime_type: asset.mimeType || 'application/octet-stream',
          size_bytes: asset.size || 0,
        }),
      });
      const upload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(upload.error || 'Unable to prepare document upload.');

      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const { error: uploadError } = await supabase.storage
        .from('partner-documents')
        .uploadToSignedUrl(upload.path, upload.token, blob, {
          contentType: asset.mimeType || 'application/octet-stream',
        });

      if (uploadError) throw new Error(uploadError.message);

      await loadDocuments(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document upload failed.';
      Alert.alert('Document upload', message);
    } finally {
      setDocBusy(false);
    }
  }

  async function submit() {
    if (!supabase) return;
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing details', 'Name and phone are required.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    setBusy(true);
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        display_name: name.trim(),
        phone: phone.trim(),
        bio: bio.trim() || null,
        skills: skills.split(',').map((item) => item.trim()).filter(Boolean),
        base_lat: coords?.latitude ?? null,
        base_long: coords?.longitude ?? null,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      Alert.alert('Application failed', result.error || 'Please try again.');
      return;
    }

    await loadDocuments(token);

    Alert.alert('Application saved', 'Your Pickolo Partner application is pending verification.', [
      { text: 'Continue', onPress: () => router.replace('/home') },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>PICKOLO PARTNER</Text>
        <Text style={styles.title}>Apply to become a partner</Text>
        <Text style={styles.subtitle}>Tell us what you shoot and where you operate.</Text>

        <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={[styles.input, styles.area]} placeholder="Short bio" value={bio} onChangeText={setBio} multiline />
        <TextInput style={styles.input} placeholder="Skills, comma separated" value={skills} onChangeText={setSkills} />

        <Pressable style={styles.secondary} onPress={locate} disabled={locating}>
          <Text style={styles.secondaryText}>{locating ? 'Locating...' : coords ? 'Location added' : 'Use current location'}</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification documents</Text>
          <Text style={styles.muted}>Upload identity or verification documents. Files remain private until reviewed.</Text>
          <Pressable style={styles.secondary} onPress={uploadDocument} disabled={docBusy}>
            <Text style={styles.secondaryText}>{docBusy ? 'Uploading...' : 'Upload document'}</Text>
          </Pressable>
          {documents.map((doc) => (
            <View key={doc.id} style={styles.documentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.documentName}>{doc.file_name}</Text>
                <Text style={styles.muted}>{doc.document_type} · {doc.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Submitting...' : 'Submit application'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  kicker: { marginTop: 22, fontSize: 12, letterSpacing: 2.5, color: '#2563eb', fontWeight: '800' },
  title: { marginTop: 7, fontSize: 31, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 7, color: '#64748b', lineHeight: 22 },
  input: { marginTop: 13, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  area: { minHeight: 110, textAlignVertical: 'top' },
  secondary: { marginTop: 14, borderRadius: 14, backgroundColor: '#eef2ff', paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#1e3a8a', fontWeight: '800' },
  primary: { marginTop: 12, borderRadius: 14, backgroundColor: '#2563eb', paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  card: { marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 19, fontWeight: '800', color: '#13213a' },
  muted: { marginTop: 6, color: '#64748b', lineHeight: 21 },
  documentRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  documentName: { fontWeight: '800', color: '#13213a' },
});

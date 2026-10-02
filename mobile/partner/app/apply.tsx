import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
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
import {
  buildOnboarding,
  DeviceChoice,
  readOnboarding,
  WorkChoice,
} from '../ui/onboarding';

function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <View
      style={styles.choiceGroup}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={label + ': ' + option.label}
          accessibilityState={{ checked: value === option.value, disabled }}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          style={[
            styles.choice,
            value === option.value && styles.choiceSelected,
            disabled && styles.disabled,
          ]}
        >
          <Text
            style={[
              styles.choiceText,
              value === option.value && styles.choiceTextSelected,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function PartnerApply() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upi, setUpi] = useState('');
  const [saved, setSaved] = useState(false);
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [work, setWork] = useState<WorkChoice | null>(null);
  const [device, setDevice] = useState<DeviceChoice | null>(null);
  const [cameraModel, setCameraModel] = useState('');
  const [phoneModel, setPhoneModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const submitting = useRef(false);
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
  const documentUploadPending = useRef(false);

  async function loadExistingDocuments() {
    setLoading(true);
    setLoadError('');
    try {
      if (!supabase) return;
      const { application } = await request<{
        application: Application | null;
      }>('/api/partner/application');
      if (application) {
        setName(application.display_name);
        setPhone(application.phone);
        setUpi(application.payout_upi_id || '');
        setBio(application.bio || '');
        const selections = readOnboarding(application.skills);
        setWork(selections.work);
        setDevice(selections.device);
        setCameraModel(selections.cameraModel);
        setPhoneModel(selections.phoneModel);
        setSkills(selections.extraSkills);
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
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExistingDocuments();
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
    if (
      !supabase ||
      documentUploadPending.current ||
      !saved ||
      loading ||
      busy ||
      loadError
    )
      return;
    documentUploadPending.current = true;
    setDocBusy(true);
    try {
      // The filesystem picker retains the Android SAF grant. DocumentPicker's
      // host-cache copy can be outside the Expo Go project's readable scope.
      const picked = await File.pickFileAsync({
        mimeTypes: ['image/*', 'application/pdf'],
        multipleFiles: false,
      });
      if (picked.canceled) return;
      const file = picked.result;
      const mimeType = String(file.type || '').toLowerCase();
      if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf')
        return Alert.alert(
          'Unsupported document',
          'Choose a photo or PDF identity document.',
        );
      if (
        !Number.isFinite(file.size) ||
        file.size <= 0 ||
        file.size > 20 * 1024 * 1024
      )
        return Alert.alert(
          'Document too large',
          'Choose an image or PDF with a known size up to 20 MB.',
        );
      // Read before requesting an upload URL: that endpoint creates a metadata
      // row, so a local permission failure must not leave a phantom document.
      const bytes = await file.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024)
        return Alert.alert(
          'Invalid document size',
          'Choose a non-empty image or PDF up to 20 MB.',
        );
      // SAF URIs can end with an opaque provider ID, not a display filename.
      const fileName = file.uri.startsWith('content://')
        ? 'identity-document.' +
          (mimeType === 'application/pdf'
            ? 'pdf'
            : mimeType === 'image/jpeg'
              ? 'jpg'
              : mimeType.split('/')[1].replace(/[^a-z0-9]/g, ''))
        : file.name;
      const upload = await request<{ path: string; token: string }>(
        '/api/partner/documents/upload-url',
        {
          method: 'POST',
          body: JSON.stringify({
            document_type: 'identity',
            file_name: fileName,
            mime_type: mimeType,
            size_bytes: bytes.byteLength,
          }),
        },
      );

      const { error: uploadError } = await supabase.storage
        .from('partner-documents')
        .uploadToSignedUrl(upload.path, upload.token, bytes, {
          contentType: mimeType,
        });

      if (uploadError) throw new Error(uploadError.message);

      await loadDocuments();
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Document upload failed.';
      const message = /permission|not readable|access denied/i.test(rawMessage)
        ? 'The selected file could not be read. Select it again from Files. If it is stored in the cloud, download a local copy first and retry.'
        : rawMessage;
      Alert.alert('Document upload', message);
    } finally {
      documentUploadPending.current = false;
      setDocBusy(false);
    }
  }

  async function submit() {
    if (!supabase || submitting.current || loading || loadError || docBusy)
      return;
    if (!name.trim() || !phone.trim() || !upi.trim()) {
      Alert.alert('Missing details', 'Name, phone and UPI ID are required.');
      return;
    }
    if (!/^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/i.test(upi.trim()))
      return Alert.alert(
        'Invalid UPI ID',
        'Enter a valid UPI ID, for example name@upi.',
      );

    let applicationSkills: string[];
    try {
      applicationSkills = buildOnboarding({
        work,
        device,
        cameraModel,
        phoneModel,
        extraSkills: skills,
      });
    } catch (error) {
      Alert.alert('Your shooting preferences', errorMessage(error));
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await request('/api/partner/apply', {
        method: 'POST',
        body: JSON.stringify({
          display_name: name.trim(),
          phone: phone.trim(),
          payout_upi_id: upi.trim().toLowerCase(),
          bio: bio.trim() || null,
          skills: applicationSkills,
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
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
        >
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.kicker}>PICKOLO PARTNER</Text>
        <Text style={styles.title}>Apply to become a partner</Text>
        <Text style={styles.subtitle}>
          Camera or phone creators welcome. Tell us what you shoot in Bhopal.
        </Text>
        {loading && (
          <Text style={styles.muted} accessibilityLiveRegion="polite">
            Loading your details...
          </Text>
        )}
        {!!loadError && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Unable to load your details</Text>
            <Text style={styles.muted}>{loadError}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.secondary}
              onPress={loadExistingDocuments}
            >
              <Text style={styles.secondaryText}>Try again</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Basic details</Text>
          <Text style={styles.muted}>
            New freelancers are welcome. Experience is not required to apply.
          </Text>
          <Text style={styles.fieldLabel}>Full name</Text>
          <TextInput
            accessibilityLabel="Full name"
            editable={!loading && !busy && !loadError}
            style={styles.input}
            placeholder="Full name"
            value={name}
            onChangeText={setName}
          />
          <Text style={styles.fieldLabel}>Mobile number</Text>
          <TextInput
            accessibilityLabel="Mobile number"
            editable={!loading && !busy && !loadError}
            style={styles.input}
            placeholder="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Text style={styles.fieldLabel}>Payout UPI ID</Text>
          <TextInput
            accessibilityLabel="Payout UPI ID"
            editable={!loading && !busy && !loadError}
            style={styles.input}
            placeholder="UPI ID (name@upi)"
            value={upi}
            onChangeText={setUpi}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.muted}>
            Used for payouts. Entering an ID does not verify account ownership.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            onPress={locate}
            disabled={locating || loading || busy}
          >
            <Text style={styles.secondaryText}>
              {locating
                ? 'Locating...'
                : coords
                  ? 'Location added'
                  : 'Use current location'}
            </Text>
          </Pressable>
          <Text style={styles.muted}>
            Location is optional for now; it helps with nearby Bhopal shoots.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Your shooting preferences</Text>
          <Text style={styles.fieldLabel}>What work do you offer?</Text>
          <Choices<WorkChoice>
            label="Service"
            value={work}
            onChange={setWork}
            disabled={loading || busy || !!loadError}
            options={[
              { value: 'photography', label: 'Photography' },
              { value: 'videography', label: 'Videography' },
              { value: 'both', label: 'Both' },
            ]}
          />
          <Text style={styles.fieldLabel}>What do you shoot with?</Text>
          <Choices<DeviceChoice>
            label="Shooting device"
            value={device}
            onChange={setDevice}
            disabled={loading || busy || !!loadError}
            options={[
              { value: 'camera', label: 'Camera' },
              { value: 'phone', label: 'Phone' },
              { value: 'both', label: 'Both' },
            ]}
          />
          <Text style={styles.muted}>
            Camera, phone or both. Owned, rented or borrowed equipment is
            welcome.
          </Text>
          {(device === 'camera' || device === 'both') && (
            <>
              <Text style={styles.fieldLabel}>Camera model · optional</Text>
              <TextInput
                style={styles.input}
                placeholder="Camera model (optional)"
                accessibilityLabel="Camera model"
                value={cameraModel}
                onChangeText={setCameraModel}
                maxLength={80}
                editable={!loading && !busy && !loadError}
              />
            </>
          )}
          {(device === 'phone' || device === 'both') && (
            <>
              <Text style={styles.fieldLabel}>Phone model · optional</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone model (optional)"
                accessibilityLabel="Phone model"
                value={phoneModel}
                onChangeText={setPhoneModel}
                maxLength={80}
                editable={!loading && !busy && !loadError}
              />
            </>
          )}
          <Text style={styles.fieldLabel}>About your work · optional</Text>
          <TextInput
            accessibilityLabel="About your work"
            editable={!loading && !busy && !loadError}
            style={[styles.input, styles.area]}
            placeholder="Short bio"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={500}
          />
          <Text style={styles.fieldLabel}>Additional skills · optional</Text>
          <TextInput
            accessibilityLabel="Additional skills"
            editable={!loading && !busy && !loadError}
            style={styles.input}
            placeholder="Skills, comma separated"
            value={skills}
            onChangeText={setSkills}
          />
          <Text style={styles.muted}>
            For example: portraits, events, Lightroom or video editing. No
            equipment invoices or extra lenses required.
          </Text>
          {work && device && (
            <Text style={styles.selectionSummary}>
              {device === 'both'
                ? 'Camera & Phone'
                : device === 'camera'
                  ? 'Camera'
                  : 'Phone'}
              {' · '}
              {work === 'both'
                ? 'Photography & Videography'
                : work === 'photography'
                  ? 'Photography'
                  : 'Videography'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Identity & review</Text>
          <Text style={styles.muted}>
            {saved
              ? 'Add one clear photo ID for manual review. Driving licence, voter ID or passport; masked Aadhaar is optional. Image or PDF up to 20 MB. Files are private, not part of your public profile.'
              : 'Save your application first, then add your verification documents here.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={[
              styles.secondary,
              (docBusy || !saved || busy || loading) && styles.disabled,
            ]}
            onPress={uploadDocument}
            disabled={docBusy || !saved || busy || loading || !!loadError}
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

        <Text style={styles.muted}>
          Your preferences are reviewed by Pickolo. Submitting does not
          automatically approve you or unlock assignments.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[
            styles.primary,
            (busy || docBusy || loading || !!loadError) && styles.disabled,
          ]}
          onPress={submit}
          disabled={busy || docBusy || loading || !!loadError}
        >
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
  fieldLabel: {
    marginTop: 18,
    color: '#13213a',
    fontSize: 14,
    fontWeight: '700',
  },
  choiceGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  choice: {
    minHeight: 48,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  choiceSelected: {
    backgroundColor: '#E9F8F0',
    borderColor: '#087443',
    borderWidth: 2,
  },
  choiceText: { color: '#64748b', fontSize: 14, fontWeight: '700' },
  choiceTextSelected: { color: '#045B35', fontWeight: '800' },
  disabled: { opacity: 0.6 },
  selectionSummary: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    color: '#045B35',
    backgroundColor: '#E9F8F0',
    fontWeight: '700',
    lineHeight: 22,
  },
  documentRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  documentName: { fontWeight: '800', color: '#13213a' },
});

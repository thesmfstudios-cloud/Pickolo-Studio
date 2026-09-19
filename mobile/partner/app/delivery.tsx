import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../shared/supabase';

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [url, setUrl] = useState('');
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase || !id) return;

    if (!url.trim() && !path.trim()) {
      Alert.alert('Missing delivery', 'Add a delivery link or storage path.');
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
    const response = await fetch(baseUrl + '/api/partner/jobs/' + id + '/delivery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        delivery_url: url.trim() || null,
        storage_path: path.trim() || null,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      Alert.alert('Delivery failed', result.error || 'Please try again.');
      return;
    }

    Alert.alert('Delivery submitted', 'The customer can now review the delivered work.', [
      { text: 'Done', onPress: () => router.replace('/jobs') },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Submit delivery</Text>
        <Text style={styles.subtitle}>Add the customer-accessible delivery reference for this booking.</Text>

        <Text style={styles.label}>Delivery link</Text>
        <TextInput style={styles.input} placeholder="https://..." value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />

        <Text style={styles.label}>Or storage path</Text>
        <TextInput style={styles.input} placeholder="pickolo/bookings/..." value={path} onChangeText={setPath} autoCapitalize="none" />

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Submitting...' : 'Submit delivery'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f8fafc'}, container:{flex:1,padding:20,justifyContent:'center'},
  back:{color:'#1e3a8a',fontWeight:'800',fontSize:16}, title:{marginTop:18,fontSize:32,fontWeight:'800',color:'#13213a'},
  subtitle:{marginTop:7,color:'#64748b',lineHeight:22}, label:{marginTop:22,marginBottom:8,color:'#13213a',fontWeight:'800'},
  input:{borderWidth:1,borderColor:'#e2e8f0',backgroundColor:'#fff',borderRadius:14,padding:14,fontSize:16},
  primary:{marginTop:22,backgroundColor:'#2563eb',borderRadius:14,paddingVertical:16,alignItems:'center'},
  primaryText:{color:'#fff',fontWeight:'800',fontSize:16}
});

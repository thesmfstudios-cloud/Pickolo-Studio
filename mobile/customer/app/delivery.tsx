import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Asset = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  signed_url: string;
};

export default function DeliveryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !id) {
      setBusy(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/bookings/' + id + '/delivery', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert('Delivery unavailable', result.error || 'Unable to load delivery.');
      setBusy(false);
      return;
    }

    setAssets(result.assets || []);
    setBusy(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (busy) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Loading your delivery...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Your photos</Text>
        <Text style={styles.subtitle}>{assets.length} delivered photo{assets.length === 1 ? '' : 's'}.</Text>

        {assets.length === 0 ? (
          <View style={styles.card}><Text style={styles.cardTitle}>Delivery is being prepared</Text><Text style={styles.muted}>No accessible files are available yet.</Text></View>
        ) : assets.map((asset) => (
          <View key={asset.id} style={styles.card}>
            <Image source={{ uri: asset.signed_url }} style={styles.image} resizeMode="cover" />
            <Text style={styles.fileName}>{asset.file_name}</Text>
            <Text style={styles.muted}>Private access link expires after a limited time.</Text>
          </View>
        ))}

        {assets.length > 0 && (
          <Text style={styles.footerNote}>For security, Pickolo uses time-limited private links instead of permanent public file URLs.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f8fafc'},
  container:{padding:20,paddingBottom:40},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:24},
  back:{color:'#1e3a8a',fontWeight:'800',fontSize:16},
  title:{marginTop:18,fontSize:32,fontWeight:'800',color:'#13213a'},
  subtitle:{marginTop:6,color:'#64748b',lineHeight:22},
  card:{marginTop:16,padding:14,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e8f0'},
  cardTitle:{fontSize:18,fontWeight:'800',color:'#13213a'},
  image:{width:'100%',height:280,borderRadius:12,backgroundColor:'#f1f5f9'},
  fileName:{marginTop:12,fontSize:15,fontWeight:'800',color:'#13213a'},
  muted:{marginTop:6,color:'#64748b',lineHeight:21},
  footerNote:{marginTop:18,color:'#94a3b8',fontSize:12,lineHeight:18}
});

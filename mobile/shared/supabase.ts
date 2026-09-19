import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 100;
const META_SUFFIX = '__meta';

const secureStorage = {
  async getItem(key: string) {
    const metaRaw = await SecureStore.getItemAsync(key + META_SUFFIX);

    if (!metaRaw) {
      return SecureStore.getItemAsync(key);
    }

    const count = Number(metaRaw);
    if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) {
      await SecureStore.deleteItemAsync(key + META_SUFFIX);
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(key + '__' + index),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      return null;
    }

    return chunks.join('');
  },

  async setItem(key: string, value: string) {
    const chunkCount = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    if (chunkCount > MAX_CHUNKS) {
      throw new Error('Secure session payload is unexpectedly large.');
    }

    const previousMeta = await SecureStore.getItemAsync(key + META_SUFFIX);
    const previousCount = Number(previousMeta);

    if (Number.isInteger(previousCount) && previousCount > 0 && previousCount <= MAX_CHUNKS) {
      await Promise.all(
        Array.from({ length: previousCount }, (_, index) =>
          SecureStore.deleteItemAsync(key + '__' + index),
        ),
      );
    }

    await SecureStore.deleteItemAsync(key);
    await SecureStore.deleteItemAsync(key + META_SUFFIX);

    await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.setItemAsync(
          key + '__' + index,
          value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
        ),
      ),
    );

    await SecureStore.setItemAsync(key + META_SUFFIX, String(chunkCount));
  },

  async removeItem(key: string) {
    const metaRaw = await SecureStore.getItemAsync(key + META_SUFFIX);
    const count = Number(metaRaw);

    if (Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS) {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.deleteItemAsync(key + '__' + index),
        ),
      );
    }

    await SecureStore.deleteItemAsync(key + META_SUFFIX);
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: secureStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

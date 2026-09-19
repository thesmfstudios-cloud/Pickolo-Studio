import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let responseSubscription: Notifications.Subscription | null = null;
let responseRole: 'customer' | 'partner' | null = null;

function ensureNotificationNavigation(appRole: 'customer' | 'partner') {
  if (responseSubscription && responseRole === appRole) return;

  responseSubscription?.remove();
  responseRole = appRole;

  responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { bookingId?: string } | undefined;
    if (!data?.bookingId) return;

    if (appRole === 'customer') {
      router.push({
        pathname: '/booking-detail',
        params: { id: data.bookingId },
      });
    } else {
      router.push('/jobs');
    }
  });
}

export async function registerPushToken(appRole: 'customer' | 'partner') {
  if (!supabase || !Device.isDevice) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;

  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Pickolo',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  ensureNotificationNavigation(appRole);

  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  const response = await fetch(baseUrl + '/api/notifications/register-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      app_role: appRole,
    }),
  });

  if (!response.ok) return null;
  return token;
}

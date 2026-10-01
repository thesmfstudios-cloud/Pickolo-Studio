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
let handledResponseId: string | null = null;

function ensureNotificationNavigation(appRole: 'customer' | 'partner') {
  if (responseSubscription && responseRole === appRole) return;

  responseSubscription?.remove();
  responseRole = appRole;

  const openResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as
      { bookingId?: string } | undefined;
    if (
      typeof data?.bookingId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.bookingId,
      )
    )
      return;
    const identifier = response.notification.request.identifier;
    if (identifier === handledResponseId) return;
    handledResponseId = identifier;

    if (appRole === 'customer') {
      router.push({
        pathname: '/booking-detail',
        params: { id: data.bookingId },
      });
    } else {
      router.push({ pathname: '/job', params: { id: data.bookingId } });
    }
  };
  responseSubscription =
    Notifications.addNotificationResponseReceivedListener(openResponse);
  const initialResponse = Notifications.getLastNotificationResponse();
  if (initialResponse) openResponse(initialResponse);
}

export async function registerPushToken(appRole: 'customer' | 'partner') {
  if (!supabase || !Device.isDevice) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;
  ensureNotificationNavigation(appRole);

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(
    /\/$/,
    '',
  );
  if (!projectId || !baseUrl) return null;

  // Android 13 needs a channel before the permission prompt/token request.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Pickolo',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
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

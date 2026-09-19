import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;

type ExpoTicket = {
  status?: string;
  details?: { error?: string };
};

async function sendExpoPush(messages: unknown[]) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(expoAccessToken ? { Authorization: 'Bearer ' + expoAccessToken } : {}),
    },
    body: JSON.stringify(messages),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.message || 'Expo push request failed.');
  }

  return Array.isArray(data?.data) ? data.data as ExpoTicket[] : [];
}

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');

    if (cronSecret) {
      const authorization = request.headers.get('authorization');
      if (authorization !== 'Bearer ' + cronSecret) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
    }

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
    }

    const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    const { data: notifications, error: notificationError } = await supabase
      .from('notifications')
      .select('id,user_id,booking_id,title,body,metadata')
      .is('sent_at', null)
      .order('created_at', { ascending: true })
      .limit(100);

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 400 });
    }

    if (!notifications?.length) return NextResponse.json({ sent: 0 });

    const userIds = [...new Set(notifications.map((item) => item.user_id))];
    const { data: tokens, error: tokenError } = await supabase
      .from('device_push_tokens')
      .select('user_id,token')
      .in('user_id', userIds)
      .eq('active', true);

    if (tokenError) {
      return NextResponse.json({ error: tokenError.message }, { status: 400 });
    }

    const tokenByUser = new Map<string, string[]>();
    for (const row of tokens ?? []) {
      const list = tokenByUser.get(row.user_id) ?? [];
      list.push(row.token);
      tokenByUser.set(row.user_id, list);
    }

    const messages: Record<string, unknown>[] = [];
    const messageNotificationIds: string[] = [];
    const successfulNotificationIds = new Set<string>();

    for (const item of notifications) {
      const userTokens = tokenByUser.get(item.user_id) ?? [];
      if (!userTokens.length) continue;

      successfulNotificationIds.add(item.id);

      for (const token of userTokens) {
        messages.push({
          to: token,
          title: item.title,
          body: item.body,
          data: {
            bookingId: item.booking_id,
            notificationId: item.id,
            ...(item.metadata || {}),
          },
        });
        messageNotificationIds.push(item.id);
      }
    }

    // Expo accepts batches. Keep requests bounded so a user with multiple
    // devices cannot turn one dispatch job into an oversized provider call.
    for (let index = 0; index < messages.length; index += 100) {
      const batch = messages.slice(index, index + 100);
      const tickets = await sendExpoPush(batch);

      // Expo can return HTTP 200 while individual tickets contain errors.
      // Do not mark an entire notification sent when any of its device sends failed.
      for (let ticketIndex = 0; ticketIndex < batch.length; ticketIndex += 1) {
        const ticket = tickets[ticketIndex];
        if (ticket?.status !== 'ok') {
          const notificationId = messageNotificationIds[index + ticketIndex];
          if (notificationId) successfulNotificationIds.delete(notificationId);
        }
      }
    }

    if (successfulNotificationIds.size) {
      const { error: sentError } = await supabase
        .from('notifications')
        .update({ sent_at: new Date().toISOString() })
        .in('id', [...successfulNotificationIds]);

      if (sentError) {
        return NextResponse.json({ error: sentError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      notifications: successfulNotificationIds.size,
      messages: messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notification dispatch failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

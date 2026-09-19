import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;

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
  if (!response.ok) throw new Error(data?.errors?.[0]?.message || 'Expo push request failed.');
  return data;
}

export async function POST(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');

    if (cronSecret) {
      const provided = request.headers.get('x-cron-secret');
      if (provided !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
    }

    if (!serviceRoleKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });

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

    if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 400 });

    const tokenByUser = new Map<string, string[]>();
    for (const row of tokens ?? []) {
      const list = tokenByUser.get(row.user_id) ?? [];
      list.push(row.token);
      tokenByUser.set(row.user_id, list);
    }

    const messages: Record<string, unknown>[] = [];
    const sentNotificationIds = new Set<string>();

    for (const item of notifications) {
      const userTokens = tokenByUser.get(item.user_id) ?? [];
      if (!userTokens.length) continue;

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
      }

      sentNotificationIds.add(item.id);
    }

    // Expo accepts batches. Keep requests bounded so a user with multiple
    // devices cannot turn one dispatch job into an oversized provider call.
    for (let index = 0; index < messages.length; index += 100) {
      await sendExpoPush(messages.slice(index, index + 100));
    }

    if (sentNotificationIds.size) {
      await supabase
        .from('notifications')
        .update({ sent_at: new Date().toISOString() })
        .in('id', [...sentNotificationIds]);
    }

    return NextResponse.json({
      notifications: sentNotificationIds.size,
      messages: messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

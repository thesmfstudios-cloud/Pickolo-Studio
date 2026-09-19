import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const token = String(body?.token || '').trim();
    const platform = body?.platform as 'android' | 'ios' | undefined;
    const appRole = body?.app_role as 'customer' | 'partner' | 'admin' | undefined;

    if (!token || !platform || !['android', 'ios'].includes(platform) || !appRole || !['customer', 'partner', 'admin'].includes(appRole)) {
      return NextResponse.json({ error: 'token, platform and app_role are required.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('device_push_tokens')
      .upsert({
        user_id: user.id,
        token,
        platform,
        app_role: appRole,
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'token' })
      .select('id,token,platform,app_role,active,updated_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ token: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

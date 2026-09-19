import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

async function requireAdmin(request: NextRequest) {
  const supabase = getClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return { supabase, user: null };
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { data, error } = await supabase
      .from('service_level_prices')
      .select('id,service_level_id,duration_minutes,amount_paise,platform_fee_bps,active,updated_at,service_level:service_levels(id,name)')
      .order('service_level_id')
      .order('duration_minutes');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ pricing: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await request.json();
    const id = String(body?.id || '');
    const amountPaise = Number(body?.amount_paise);
    const platformFeeBps = Number(body?.platform_fee_bps);

    if (!id || !Number.isInteger(amountPaise) || amountPaise < 100) {
      return NextResponse.json({ error: 'A valid pricing id and amount are required.' }, { status: 400 });
    }

    if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10000) {
      return NextResponse.json({ error: 'platform_fee_bps must be between 0 and 10000.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('service_level_prices')
      .update({
        amount_paise: amountPaise,
        platform_fee_bps: platformFeeBps,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id,service_level_id,duration_minutes,amount_paise,platform_fee_bps,active,updated_at,service_level:service_levels(id,name)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ pricing: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = 'https://ywlayixocyjwodhfcyus.supabase.co';
const anonKey = 'sb_publishable_ieCYy0Mc0Iy_xUYwtriwyw_HQ19FQbX';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });
    const { id } = await context.params;
    const { error } = await supabase.rpc('request_pay_after_shoot', { p_booking_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update payment timing.' }, { status: 500 });
  }
}

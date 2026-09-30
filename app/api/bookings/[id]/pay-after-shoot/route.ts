import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from '@/lib/supabase-config';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assignBestPartner } from '@/lib/assignment';
import { getServiceClient } from '@/lib/supabase-admin';

const url = SUPABASE_URL;
const anonKey = SUPABASE_PUBLIC_KEY;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });
    const { id } = await context.params;
    // Validate privileged service configuration before changing fulfilment state.
    getServiceClient();
    const { error } = await supabase.rpc('request_pay_after_shoot', { p_booking_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const assignment = await assignBestPartner(id);
    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update payment timing.' }, { status: 500 });
  }
}

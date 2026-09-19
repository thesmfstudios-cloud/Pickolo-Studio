
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getClient(request);
    const { id } = await context.params;
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('id,booking_code,status,scheduled_start,duration_minutes,location_text,notes,customer_price_paise,platform_fee_paise,partner_payout_paise,partner_acceptance_status,partner_offer_expires_at,partner_arrived_at,shoot_started_at,shoot_completed_at,data_submitted_at,payout_released_at,completed_at,created_at,service:services(id,name),service_level:service_levels(id,name)')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    return NextResponse.json({ booking: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

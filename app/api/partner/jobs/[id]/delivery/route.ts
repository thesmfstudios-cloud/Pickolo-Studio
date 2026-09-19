import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovedPartner } from '@/lib/partner-auth';
import { getServiceClient } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;
    const body = await request.json();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const storagePath = String(body?.storage_path || '').trim();
    const deliveryUrl = String(body?.delivery_url || '').trim();

    if (!storagePath && !deliveryUrl) {
      return NextResponse.json({ error: 'storage_path or delivery_url is required.' }, { status: 400 });
    }

    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner) return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,assigned_partner_id')
      .eq('id', id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    if (booking.assigned_partner_id !== user.id) {
      return NextResponse.json({ error: 'Assigned partner access required.' }, { status: 403 });
    }

    if (!['SHOOT_COMPLETED', 'DATA_PENDING'].includes(booking.status)) {
      return NextResponse.json({ error: 'Booking is not ready for delivery submission.' }, { status: 409 });
    }

    const { data, error } = await serviceClient
      .from('delivery_records')
      .upsert({
        booking_id: id,
        storage_path: storagePath || null,
        delivery_url: deliveryUrl || null,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'booking_id' })
      .select('id,booking_id,storage_path,delivery_url,submitted_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (booking.status === 'SHOOT_COMPLETED') {
      const { data: updated } = await serviceClient
        .from('bookings')
        .update({ status: 'DATA_SUBMITTED' })
        .eq('id', id)
        .eq('status', 'SHOOT_COMPLETED')
        .select('id,booking_code,status')
        .single();

      if (updated) {
        await serviceClient.from('booking_status_history').insert({
          booking_id: id,
          from_status: 'SHOOT_COMPLETED',
          to_status: 'DATA_SUBMITTED',
          changed_by: user.id,
          metadata: { actor_role: 'partner' },
        });
      }
    }

    return NextResponse.json({ delivery: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

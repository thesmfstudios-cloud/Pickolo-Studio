import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-admin';
import { assignBestPartner } from '@/lib/assignment';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id,booking_code,status,scheduled_start,assigned_partner_id,partner_acceptance_status')
      .eq('status', 'SEARCHING_PARTNER')
      .is('assigned_partner_id', null)
      .order('scheduled_start', { ascending: true })
      .limit(50);

    const results = [];
    for (const booking of bookings ?? []) {
      const result = await assignBestPartner(booking.id);
      results.push({ bookingId: booking.id, result });
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search queue processing failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
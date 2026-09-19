import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,customer_id')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    const { data: assets, error } = await serviceClient
      .from('delivery_assets')
      .select('id,storage_path,file_name,mime_type,size_bytes,created_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const signed = [];
    for (const asset of assets ?? []) {
      const { data: signedData, error: signedError } = await serviceClient.storage
        .from('booking-deliveries')
        .createSignedUrl(asset.storage_path, 3600);

      if (!signedError && signedData?.signedUrl) {
        signed.push({
          ...asset,
          signed_url: signedData.signedUrl,
        });
      }
    }

    return NextResponse.json({
      bookingId: id,
      status: booking.status,
      assets: signed,
      expiresInSeconds: 3600,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

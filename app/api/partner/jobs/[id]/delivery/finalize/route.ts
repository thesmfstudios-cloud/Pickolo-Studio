import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { getApprovedPartner } from '@/lib/partner-auth';

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

    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner) return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,assigned_partner_id')
      .eq('id', id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.assigned_partner_id !== user.id) return NextResponse.json({ error: 'Assigned partner access required.' }, { status: 403 });
    if (booking.status !== 'DATA_PENDING') {
      return NextResponse.json({ error: 'Booking is not ready for delivery.' }, { status: 409 });
    }

    const incoming = Array.isArray(body?.assets) ? body.assets : [];
    if (!incoming.length || incoming.length > 100) {
      return NextResponse.json({ error: 'Provide between 1 and 100 uploaded assets.' }, { status: 400 });
    }

    type DeliveryAsset = {
      booking_id: string;
      storage_path: string;
      file_name: string;
      mime_type: string;
      size_bytes: number | null;
      created_by: string;
    };

    const assets: DeliveryAsset[] = incoming.map((item: unknown) => ({
      booking_id: id,
      storage_path: typeof item === 'object' && item !== null && 'path' in item ? String((item as { path?: unknown }).path || '') : '',
      file_name: typeof item === 'object' && item !== null && 'fileName' in item ? String((item as { fileName?: unknown }).fileName || 'photo') : 'photo',
      mime_type: typeof item === 'object' && item !== null && 'mimeType' in item ? String((item as { mimeType?: unknown }).mimeType || 'image/jpeg') : 'image/jpeg',
      size_bytes: typeof item === 'object' && item !== null && 'sizeBytes' in item && (item as { sizeBytes?: unknown }).sizeBytes != null ? Number((item as { sizeBytes?: unknown }).sizeBytes) : null,
      created_by: user.id,
    }));

    if (assets.some((item) => !item.storage_path || !item.storage_path.startsWith(id + '/'))) {
      return NextResponse.json({ error: 'Invalid delivery asset path.' }, { status: 400 });
    }

    for (const asset of assets) {
      const { data: signedCheck, error: storageError } = await serviceClient.storage
        .from('booking-deliveries')
        .createSignedUrl(asset.storage_path, 60);

      if (storageError || !signedCheck?.signedUrl) {
        return NextResponse.json({
          error: 'One or more delivery files are not present in private storage.',
          path: asset.storage_path,
        }, { status: 409 });
      }
    }

    const { data: saved, error: assetError } = await serviceClient
      .from('delivery_assets')
      .upsert(assets, { onConflict: 'booking_id,storage_path' })
      .select('id,storage_path,file_name,mime_type,size_bytes,created_at');

    if (assetError) return NextResponse.json({ error: assetError.message }, { status: 400 });

    const { data: delivery, error: deliveryError } = await serviceClient
      .from('delivery_records')
      .upsert({
        booking_id: id,
        storage_path: assets[0].storage_path,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'booking_id' })
      .select('id,booking_id,storage_path,submitted_by,submitted_at')
      .single();

    if (deliveryError) return NextResponse.json({ error: deliveryError.message }, { status: 400 });

    if (booking.status === 'DATA_PENDING') {
      const { data: updated } = await serviceClient
        .from('bookings')
        .update({ status: 'DATA_SUBMITTED' })
        .eq('id', id)
        .eq('status', 'DATA_PENDING')
        .select('id,booking_code,status')
        .single();

      if (updated) {
        await serviceClient.from('booking_status_history').insert({
          booking_id: id,
          from_status: 'DATA_PENDING',
          to_status: 'DATA_SUBMITTED',
          changed_by: user.id,
          metadata: { actor_role: 'partner', asset_count: saved?.length || 0 },
        });
      }
    }

    return NextResponse.json({ delivery, assets: saved ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

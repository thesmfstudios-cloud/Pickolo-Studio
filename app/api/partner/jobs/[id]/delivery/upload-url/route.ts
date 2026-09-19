import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { getApprovedPartner } from '@/lib/partner-auth';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
      return NextResponse.json({ error: 'Booking is not ready for delivery upload.' }, { status: 409 });
    }

    const originalName = String(body?.file_name || 'photo').trim().slice(0, 120);
    const mimeType = String(body?.mime_type || 'image/jpeg').trim().slice(0, 120);
    const sizeBytes = body?.size_bytes == null ? null : Number(body.size_bytes);

    if (!originalName) return NextResponse.json({ error: 'file_name is required.' }, { status: 400 });

    if (sizeBytes !== null && (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE)) {
      return NextResponse.json({ error: 'Each file must be between 1 byte and 50 MB.' }, { status: 400 });
    }

    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image delivery is enabled for the current MVP.' }, { status: 400 });
    }

    const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = id + '/' + randomUUID() + '-' + cleanName;

    const { data, error } = await serviceClient.storage
      .from('booking-deliveries')
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Unable to create upload URL.' }, { status: 400 });
    }

    return NextResponse.json({
      path: storagePath,
      token: data.token,
      fileName: originalName,
      mimeType,
      sizeBytes: sizeBytes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { getApprovedPartner } from '@/lib/partner-auth';
import { validateDeliveryAssets } from '@/lib/delivery-assets';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey)
    throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization
      ? { headers: { Authorization: authorization } }
      : undefined,
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      );

    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner)
      return NextResponse.json(
        { error: 'Approved partner access required.' },
        { status: 403 },
      );

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,assigned_partner_id')
      .eq('id', id)
      .single();

    if (bookingError || !booking)
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 },
      );
    if (booking.assigned_partner_id !== user.id)
      return NextResponse.json(
        { error: 'Assigned partner access required.' },
        { status: 403 },
      );
    if (booking.status !== 'DATA_PENDING') {
      return NextResponse.json(
        { error: 'Booking is not ready for delivery.' },
        { status: 409 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Provide a valid JSON delivery request.' },
        { status: 400 },
      );
    }

    if (body?.customer_handoff_confirmed !== true) {
      return NextResponse.json(
        {
          error:
            'Confirm that the customer received the files on site before submitting the backup.',
        },
        { status: 400 },
      );
    }

    let assets;
    try {
      assets = validateDeliveryAssets(id, body?.assets);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid delivery assets.',
        },
        { status: 400 },
      );
    }

    for (const asset of assets) {
      const { data: signedCheck, error: storageError } =
        await serviceClient.storage
          .from('booking-deliveries')
          .createSignedUrl(asset.storage_path, 60);

      if (storageError || !signedCheck?.signedUrl) {
        return NextResponse.json(
          {
            error:
              'One or more delivery files are not present in private storage.',
            path: asset.storage_path,
          },
          { status: 409 },
        );
      }
    }

    // This RPC locks the booking and commits assets, delivery, status and history
    // together. It also rechecks assignment/approval/storage under the lock.
    const { data: result, error: finalizationError } = await serviceClient.rpc(
      'finalize_partner_delivery',
      {
        p_booking_id: id,
        p_partner_id: user.id,
        p_customer_handoff_confirmed: true,
        p_assets: assets,
      },
    );
    if (finalizationError || !result) {
      const status =
        finalizationError?.code === '42501'
          ? 403
          : finalizationError?.code === '22023'
            ? 400
            : finalizationError?.code === '40001'
              ? 409
              : 500;
      return NextResponse.json(
        {
          error:
            status === 500
              ? 'Unable to save delivery. Please retry or contact support.'
              : finalizationError?.message || 'Delivery submission failed.',
        },
        { status },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

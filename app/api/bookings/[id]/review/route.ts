import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getUserClient(request: NextRequest) {
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
    const userClient = getUserClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;
    const body = await request.json();

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const rating = Number(body?.rating);
    const comment = String(body?.comment || '').trim().slice(0, 1000);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be an integer from 1 to 5.' }, { status: 400 });
    }

    const { data: booking } = await userClient
      .from('bookings')
      .select('id,status,customer_id,assigned_partner_id')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status !== 'COMPLETED' || !booking.assigned_partner_id) {
      return NextResponse.json({ error: 'Reviews are available after booking completion.' }, { status: 409 });
    }

    const { data: existing } = await serviceClient
      .from('reviews')
      .select('id')
      .eq('booking_id', id)
      .maybeSingle();

    if (existing) return NextResponse.json({ error: 'This booking has already been reviewed.' }, { status: 409 });

    const { data: review, error: reviewError } = await serviceClient
      .from('reviews')
      .insert({
        booking_id: id,
        customer_id: user.id,
        partner_id: booking.assigned_partner_id,
        rating,
        comment: comment || null,
      })
      .select('id,booking_id,rating,comment,created_at')
      .single();

    if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 400 });

    const { data: reviews } = await serviceClient
      .from('reviews')
      .select('rating')
      .eq('partner_id', booking.assigned_partner_id);

    const averageRating = reviews?.length
      ? Math.round((reviews.reduce((sum, item) => sum + Number(item.rating), 0) / reviews.length) * 100) / 100
      : rating;

    await serviceClient
      .from('partner_performance')
      .upsert({
        partner_id: booking.assigned_partner_id,
        average_rating: averageRating,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'partner_id' });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

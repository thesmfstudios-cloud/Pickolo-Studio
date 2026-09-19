import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { writeAdminAudit } from '@/lib/admin-audit';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function adminClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, { global: authorization ? { headers: { Authorization: authorization } } : undefined });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = adminClient(request);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: role } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const status = request.nextUrl.searchParams.get('status');
    const serviceClient = getServiceClient();
    let query = serviceClient.from('booking_disputes').select('id,booking_id,opened_by,reason_code,description,status,resolution,resolved_by,resolved_at,created_at').order('created_at',{ascending:false});
    if (status) query = query.eq('status', status);
    const { data, error: listError } = await query;
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });
    return NextResponse.json({ disputes: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load disputes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = adminClient(request);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: role } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await request.json();
    const id = String(body?.id || '');
    const status = body?.status as 'under_review' | 'resolved' | 'rejected' | undefined;
    const resolution = String(body?.resolution || '').trim().slice(0, 2000);
    if (!id || !status || !['under_review','resolved','rejected'].includes(status)) return NextResponse.json({ error: 'id and valid status are required.' }, { status: 400 });
    if (['resolved','rejected'].includes(status) && !resolution) return NextResponse.json({ error: 'Resolution text is required for a final decision.' }, { status: 400 });

    const serviceClient = getServiceClient();
    const { data, error: updateError } = await serviceClient.from('booking_disputes').update({ status, resolution: resolution || null, resolved_by: ['resolved','rejected'].includes(status) ? user.id : null, resolved_at: ['resolved','rejected'].includes(status) ? new Date().toISOString() : null }).eq('id', id).select('id,booking_id,status,resolution,resolved_by,resolved_at').single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    await writeAdminAudit({ actorId: user.id, action: 'DISPUTE_' + status.toUpperCase(), entityType: 'booking_dispute', entityId: id, metadata: { resolution: resolution || null } });
    const { data: disputeOwner } = await serviceClient.from('booking_disputes').select('opened_by').eq('id', id).single();
    if (disputeOwner?.opened_by) await serviceClient.from('notifications').insert({ user_id: disputeOwner.opened_by, booking_id: data.booking_id, channel: 'in_app', title: 'Support case updated', body: 'Your Pickolo support case is now ' + status.replace('_', ' ') + '.' });
    return NextResponse.json({ dispute: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dispute update failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
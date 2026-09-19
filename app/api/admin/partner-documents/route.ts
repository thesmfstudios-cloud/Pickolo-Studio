import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, { global: authorization ? { headers: { Authorization: authorization } } : undefined });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: role } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const status = request.nextUrl.searchParams.get('status');
    const serviceClient = getServiceClient();
    let query = serviceClient.from('partner_verification_documents').select('id,partner_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,reviewed_at,created_at').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error: listError } = await query;
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });

    const documents = [];
    for (const item of data ?? []) {
      const { data: signed } = await serviceClient.storage
        .from('partner-documents')
        .createSignedUrl(item.storage_path, 900);

      documents.push({
        ...item,
        signed_url: signed?.signedUrl ?? null,
        expires_in_seconds: 900,
      });
    }

    return NextResponse.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load documents.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, { global: authorization ? { headers: { Authorization: authorization } } : undefined });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: role } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await request.json();
    const id = String(body?.id || '');
    const status = body?.status as 'approved' | 'rejected' | undefined;
    const rejectionReason = String(body?.rejection_reason || '').slice(0, 500);
    if (!id || !status || !['approved','rejected'].includes(status)) return NextResponse.json({ error: 'id and status are required.' }, { status: 400 });

    const serviceClient = getServiceClient();
    const { data, error: updateError } = await serviceClient.from('partner_verification_documents').update({ status, rejection_reason: status === 'rejected' ? (rejectionReason || 'Document rejected.') : null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id).select('id,partner_id,document_type,status,rejection_reason,reviewed_by,reviewed_at').single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ document: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document review failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
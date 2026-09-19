import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { getApprovedPartner } from '@/lib/partner-auth';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: authorization ? { headers: { Authorization: authorization } } : undefined });
    const serviceClient = getServiceClient();
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner) return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });

    const { data, error: listError } = await serviceClient
      .from('partner_verification_documents')
      .select('id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,reviewed_at,created_at')
      .eq('partner_id', user.id)
      .order('created_at', { ascending: false });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });
    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load documents.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
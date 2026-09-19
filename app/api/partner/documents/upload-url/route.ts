import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { getApprovedPartner } from '@/lib/partner-auth';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAX_SIZE = 20 * 1024 * 1024;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const userClient = getClient(request);
    const serviceClient = getServiceClient();
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const partner = await getApprovedPartner(serviceClient, user.id);
    const { data: application } = await serviceClient
      .from('partner_applications')
      .select('id,status')
      .eq('applicant_id', user.id)
      .maybeSingle();

    if (!partner && application?.status !== 'pending') {
      return NextResponse.json({ error: 'Partner application access required.' }, { status: 403 });
    }

    const body = await request.json();
    const documentType = String(body?.document_type || '').trim().slice(0, 80);
    const fileName = String(body?.file_name || 'document').trim().slice(0, 120);
    const mimeType = String(body?.mime_type || 'image/jpeg').trim().slice(0, 120);
    const sizeBytes = Number(body?.size_bytes);

    if (!documentType || !fileName || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_SIZE) {
      return NextResponse.json({ error: 'document_type, file_name and a valid file size up to 20 MB are required.' }, { status: 400 });
    }

    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'Only image and PDF verification documents are accepted.' }, { status: 400 });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = user.id + '/' + randomUUID() + '-' + safeName;

    const { data, error: signedError } = await serviceClient.storage
      .from('partner-documents')
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signedError || !data) return NextResponse.json({ error: signedError?.message || 'Unable to create upload URL.' }, { status: 400 });

    const { data: record, error: recordError } = await serviceClient
      .from('partner_verification_documents')
      .insert({
        partner_id: partner?.id ?? null,
        applicant_id: user.id,
        document_type: documentType,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
      })
      .select('id,document_type,file_name,mime_type,size_bytes,status,created_at')
      .single();

    if (recordError) return NextResponse.json({ error: recordError.message }, { status: 400 });

    return NextResponse.json({ document: record, path: storagePath, token: data.token }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  let host = null;
  let projectRef = null;
  try {
    const url = new URL(rawUrl);
    host = url.host;
    projectRef = url.host.split('.')[0] || null;
  } catch {}
  return NextResponse.json({
    configured: Boolean(rawUrl),
    host,
    projectRef,
    anonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}

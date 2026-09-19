import { NextResponse } from 'next/server';

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  let host = null;
  let projectRef = null;

  try {
    const url = new URL(rawUrl);
    host = url.host;
    const match = url.host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    projectRef = match?.[1] ?? null;
  } catch {
    // Keep diagnostics safe: never return the raw env value.
  }

  return NextResponse.json({
    configured: Boolean(rawUrl),
    host,
    projectRef,
  });
}

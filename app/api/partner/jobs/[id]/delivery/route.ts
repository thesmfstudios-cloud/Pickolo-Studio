import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'This delivery endpoint has been retired. Use the multi-file delivery upload and finalize endpoints.',
    },
    { status: 410 },
  );
}

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  return NextResponse.json({
    keyIdConfigured: Boolean(keyId),
    keySecretConfigured: Boolean(keySecret),
    webhookSecretConfigured: Boolean(webhookSecret),
    mode: keyId.startsWith('rzp_test_') ? 'test' : keyId.startsWith('rzp_live_') ? 'live' : 'unknown',
  });
}

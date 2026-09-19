import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateBookingPrice } from '@/lib/pricing';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');

    const supabase = createClient(url, anonKey);
    const level = request.nextUrl.searchParams.get('level');
    const duration = Number(request.nextUrl.searchParams.get('duration'));

    if (!level || ![30, 60, 120].includes(duration)) {
      return NextResponse.json({ error: 'Valid level and duration are required.' }, { status: 400 });
    }

    const { data: serviceLevel, error: levelError } = await supabase
      .from('service_levels')
      .select('id,name')
      .eq('name', level)
      .eq('active', true)
      .maybeSingle();

    if (levelError || !serviceLevel) {
      return NextResponse.json({ error: 'Service level not found.' }, { status: 404 });
    }

    const { data: config, error: priceError } = await supabase
      .from('service_level_prices')
      .select('amount_paise,platform_fee_bps')
      .eq('service_level_id', serviceLevel.id)
      .eq('duration_minutes', duration)
      .eq('active', true)
      .maybeSingle();

    if (priceError || !config) {
      return NextResponse.json({ error: 'Pricing is not configured for this option.' }, { status: 409 });
    }

    const pricing = calculateBookingPrice({
      amountPaise: Number(config.amount_paise),
      platformFeeBps: Number(config.platform_fee_bps),
    });

    return NextResponse.json({
      currency: pricing.currency,
      totalPaise: pricing.totalPaise,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

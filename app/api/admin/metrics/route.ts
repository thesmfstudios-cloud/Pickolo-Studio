import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: authorization ? { headers: { Authorization: authorization } } : undefined });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const serviceClient = getServiceClient();
    const [bookingResult, payoutResult, incidentResult] = await Promise.all([
      serviceClient.from('bookings').select('status,customer_price_paise,platform_fee_paise,partner_payout_paise,created_at,assigned_partner_id'),
      serviceClient.from('payouts').select('amount_paise,status,created_at,released_at'),
      serviceClient.from('booking_incidents').select('incident_type,created_at'),
    ]);

    if (bookingResult.error) return NextResponse.json({ error: bookingResult.error.message }, { status: 400 });
    if (payoutResult.error) return NextResponse.json({ error: payoutResult.error.message }, { status: 400 });
    if (incidentResult.error) return NextResponse.json({ error: incidentResult.error.message }, { status: 400 });

    const bookings = bookingResult.data ?? [];
    const completed = bookings.filter((b) => b.status === 'COMPLETED').length;
    const paid = bookings.filter((b) => !['REQUESTED','CANCELLED','REFUNDED'].includes(b.status)).length;
    const active = bookings.filter((b) => ['PAYMENT_CONFIRMED','SEARCHING_PARTNER','PARTNER_ASSIGNED','ON_THE_WAY','SHOOT_STARTED','SHOOT_COMPLETED','DATA_PENDING','DATA_SUBMITTED','CUSTOMER_CONFIRMED','PAYOUT_RELEASED'].includes(b.status)).length;
    const cancelled = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'REFUNDED').length;
    const gmv = bookings.reduce((sum, b) => sum + Number(b.customer_price_paise || 0), 0);
    const platformRevenue = bookings.reduce((sum, b) => sum + Number(b.platform_fee_paise || 0), 0);
    const partnerPayouts = bookings.reduce((sum, b) => sum + Number(b.partner_payout_paise || 0), 0);
    const conversion = bookings.length ? completed / bookings.length : 0;

    const incidentCounts: Record<string, number> = {};
    for (const incident of incidentResult.data ?? []) incidentCounts[incident.incident_type] = (incidentCounts[incident.incident_type] || 0) + 1;

    const payoutReleased = (payoutResult.data ?? []).filter((p) => p.status === 'released').reduce((sum, p) => sum + Number(p.amount_paise || 0), 0);

    return NextResponse.json({
      bookings: { total: bookings.length, paid, active, completed, cancelled, completionRate: conversion },
      money: { gmvPaise: gmv, platformRevenuePaise: platformRevenue, partnerPayoutsPaise: partnerPayouts, payoutsReleasedPaise: payoutReleased },
      incidents: incidentCounts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load operations metrics.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
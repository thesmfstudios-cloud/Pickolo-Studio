import { getServiceClient } from '@/lib/supabase-admin';
import { distanceKm, PICKOLO_PILOT_RADIUS_KM } from '@/lib/geo';

type Candidate = { id: string; distance: number };

export async function assignBestPartner(bookingId: string, actorId?: string) {
  const supabase = getServiceClient();

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id,booking_code,status,customer_id,scheduled_start,duration_minutes,service_id,service_level_id,location_lat,location_long,assigned_partner_id')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) throw new Error('Booking not found.');
  if (!['PAYMENT_CONFIRMED','SEARCHING_PARTNER'].includes(booking.status)) {
    return { assigned: false, reason: 'Booking is not ready for partner matching.' };
  }

  if (booking.status === 'PAYMENT_CONFIRMED') {
    const { data: changed } = await supabase
      .from('bookings')
      .update({ status: 'SEARCHING_PARTNER' })
      .eq('id', booking.id)
      .eq('status', 'PAYMENT_CONFIRMED')
      .is('assigned_partner_id', null)
      .select('id')
      .maybeSingle();

    if (changed) {
      await supabase.from('booking_status_history').insert({
        booking_id: booking.id,
        from_status: 'PAYMENT_CONFIRMED',
        to_status: 'SEARCHING_PARTNER',
        changed_by: actorId ?? null,
        metadata: { assignment_mode: 'pool_first_accept' },
      });
    }
    booking.status = 'SEARCHING_PARTNER';
  }

  if (booking.assigned_partner_id) {
    return { assigned: false, reason: 'Booking already has a partner.' };
  }
  if (booking.location_lat === null || booking.location_long === null) {
    return { assigned: false, reason: 'Customer location is required for matching.' };
  }

  const { data: service } = await supabase.from('services').select('name').eq('id', booking.service_id).single();
  const requiredServiceNames = service?.name === 'Both'
    ? ['Photography', 'Videography']
    : [service?.name || 'Photography'];
  const { data: requiredServices } = await supabase
    .from('services')
    .select('id,name')
    .in('name', requiredServiceNames);
  const requiredServiceIds = new Set((requiredServices ?? []).map((item) => item.id));
  const { data: capabilityRows } = await supabase
    .from('partner_services')
    .select('partner_id,service_id')
    .in('service_id', [...requiredServiceIds]);
  const capabilityCount = new Map<string, Set<string>>();
  for (const row of capabilityRows ?? []) {
    const set = capabilityCount.get(row.partner_id) ?? new Set<string>();
    set.add(row.service_id);
    capabilityCount.set(row.partner_id, set);
  }

  const { data: partners } = await supabase
    .from('partners')
    .select('id,base_lat,base_long,service_level_id')
    .eq('verification_status', 'approved')
    .eq('is_accepting_jobs', true)
    .eq('service_level_id', booking.service_level_id);

  const startsAt = new Date(booking.scheduled_start);
  const endsAt = new Date(startsAt.getTime() + Number(booking.duration_minutes) * 60000);
  const candidates: Candidate[] = [];

  for (const partner of partners ?? []) {
    const partnerCapabilities = capabilityCount.get(partner.id);
    const hasRequiredCapabilities =
      partnerCapabilities &&
      [...requiredServiceIds].every((serviceId) => partnerCapabilities.has(serviceId));
    if (!hasRequiredCapabilities) continue;
    if (partner.base_lat === null || partner.base_long === null) continue;

    const distance = distanceKm(
      Number(booking.location_lat), Number(booking.location_long),
      Number(partner.base_lat), Number(partner.base_long),
    );
    if (distance > PICKOLO_PILOT_RADIUS_KM) continue;

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id,scheduled_start,duration_minutes')
      .eq('assigned_partner_id', partner.id)
      .not('status', 'in', '("CANCELLED","REFUNDED","COMPLETED","DISPUTED")')
      .neq('id', bookingId);

    const conflict = (conflicts ?? []).some((existing) => {
      const existingStart = new Date(existing.scheduled_start).getTime();
      const existingEnd = existingStart + Number(existing.duration_minutes) * 60000;
      return startsAt.getTime() < existingEnd && endsAt.getTime() > existingStart;
    });
    if (!conflict) candidates.push({ id: partner.id, distance });
  }

  if (!candidates.length) {
    return { assigned: false, reason: 'No eligible partners are online in this pool.', candidateCount: 0 };
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await supabase.from('partner_job_offers').upsert(
    candidates.map((partner) => ({
      booking_id: booking.id,
      partner_id: partner.id,
      status: 'pending',
      expires_at: expiresAt,
      responded_at: null,
    })),
    { onConflict: 'booking_id,partner_id' },
  );

  await supabase.from('notifications').insert(
    candidates.map((partner) => ({
      user_id: partner.id,
      booking_id: booking.id,
      channel: 'in_app',
      title: 'New Pickolo job',
      body: booking.booking_code + ' is open in your level. First verified partner to accept gets the job.',
    })),
  );

  return {
    assigned: false,
    broadcast: true,
    bookingId: booking.id,
    candidateCount: candidates.length,
    expiresAt,
  };
}

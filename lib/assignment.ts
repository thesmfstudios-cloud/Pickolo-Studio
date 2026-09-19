import { getServiceClient } from '@/lib/supabase-admin';
import { distanceKm, PICKOLO_PILOT_RADIUS_KM } from '@/lib/geo';

type Candidate = {
  id: string;
  distance: number;
  rating: number;
  onTimeRate: number;
  cancellationRate: number;
  noShowRate: number;
  score: number;
};

export async function assignBestPartner(bookingId: string, actorId?: string) {
  const supabase = getServiceClient();

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id,status,scheduled_start,duration_minutes,service_level_id,location_lat,location_long,assigned_partner_id')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) throw new Error('Booking not found.');
  if (!['PAYMENT_CONFIRMED', 'SEARCHING_PARTNER'].includes(booking.status)) {
    return { assigned: false, reason: 'Booking is not ready for partner matching.' };
  }

  if (booking.status === 'PAYMENT_CONFIRMED') {
    const { data: searching, error: searchError } = await supabase
      .from('bookings')
      .update({ status: 'SEARCHING_PARTNER' })
      .eq('id', booking.id)
      .eq('status', 'PAYMENT_CONFIRMED')
      .select('id,status')
      .single();

    if (searchError || !searching) {
      return { assigned: false, reason: 'Booking changed before partner search could start.' };
    }

    await supabase.from('booking_status_history').insert({
      booking_id: booking.id,
      from_status: 'PAYMENT_CONFIRMED',
      to_status: 'SEARCHING_PARTNER',
      changed_by: actorId ?? null,
      metadata: { actor_role: actorId ? 'admin' : 'system', assignment_mode: 'automatic' },
    });

    booking.status = 'SEARCHING_PARTNER';
  }
  if (booking.assigned_partner_id) {
    return { assigned: false, reason: 'Booking already has a partner.', partnerId: booking.assigned_partner_id };
  }
  if (booking.location_lat === null || booking.location_long === null) {
    return { assigned: false, reason: 'Customer location is required for pilot matching.' };
  }

  const { data: requestedLevel } = await supabase
    .from('service_levels')
    .select('sort_order')
    .eq('id', booking.service_level_id)
    .single();

  if (!requestedLevel) throw new Error('Booking service level not found.');

  const { data: partners } = await supabase
    .from('partners')
    .select('id,base_lat,base_long,service_level_id,service_level:service_levels(sort_order),partner_performance(completed_jobs,on_time_jobs,cancellations,no_shows,average_rating)')
    .eq('verification_status', 'approved');

  const startsAt = new Date(booking.scheduled_start);
  const endsAt = new Date(startsAt.getTime() + Number(booking.duration_minutes) * 60000);
  const candidates: Candidate[] = [];

  for (const partner of partners ?? []) {
    if (partner.base_lat === null || partner.base_long === null) continue;
    const level = Array.isArray(partner.service_level) ? partner.service_level[0] : partner.service_level;
    if (!level || level.sort_order < requestedLevel.sort_order) continue;

    const distance = distanceKm(Number(booking.location_lat), Number(booking.location_long), Number(partner.base_lat), Number(partner.base_long));
    if (distance > PICKOLO_PILOT_RADIUS_KM) continue;

    const { data: availability } = await supabase
      .from('partner_availability')
      .select('id')
      .eq('partner_id', partner.id)
      .eq('available', true)
      .lt('starts_at', endsAt.toISOString())
      .gt('ends_at', startsAt.toISOString())
      .limit(1);
    if (!availability?.length) continue;

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
    if (conflict) continue;

    const perf = Array.isArray(partner.partner_performance) ? partner.partner_performance[0] : partner.partner_performance;
    const completed = Number(perf?.completed_jobs || 0);
    const onTime = Number(perf?.on_time_jobs || 0);
    const cancellations = Number(perf?.cancellations || 0);
    const noShows = Number(perf?.no_shows || 0);
    const onTimeRate = completed ? onTime / completed : 0.8;
    const cancellationRate = completed + cancellations ? cancellations / (completed + cancellations) : 0;
    const noShowRate = completed + noShows ? noShows / (completed + noShows) : 0;
    const rating = Number(perf?.average_rating || 4);
    const distanceScore = Math.max(0, 1 - distance / PICKOLO_PILOT_RADIUS_KM);
    const score = distanceScore * 50 + (Math.min(5, rating) / 5) * 20 + onTimeRate * 20 - cancellationRate * 10 - noShowRate * 20;

    candidates.push({ id: partner.id, distance, rating, onTimeRate, cancellationRate, noShowRate, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  if (!selected) return { assigned: false, reason: 'No eligible partner found.', candidateCount: 0 };

  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({
      assigned_partner_id: selected.id,
      status: 'PARTNER_ASSIGNED',
      partner_acceptance_status: 'pending',
      partner_acceptance_at: null,
      partner_declined_at: null,
    })
    .eq('id', bookingId)
    .in('status', ['PAYMENT_CONFIRMED', 'SEARCHING_PARTNER'])
    .is('assigned_partner_id', null)
    .select('id,booking_code,status,assigned_partner_id,partner_acceptance_status')
    .single();

  if (updateError || !updated) return { assigned: false, reason: 'Booking changed concurrently.' };

  await supabase.from('partner_assignment_events').insert({
    booking_id: bookingId,
    partner_id: selected.id,
    event_type: 'ASSIGNED',
    reason: 'Automatic marketplace match',
  });

  await supabase.from('booking_status_history').insert({
    booking_id: bookingId,
    from_status: booking.status,
    to_status: 'PARTNER_ASSIGNED',
    changed_by: actorId ?? null,
    metadata: {
      actor_role: actorId ? 'admin' : 'system',
      assignment_mode: 'automatic',
      score: Number(selected.score.toFixed(3)),
      distance_km: Number(selected.distance.toFixed(3)),
    },
  });

  return { assigned: true, booking: updated, partnerId: selected.id, score: selected.score, distanceKm: selected.distance, candidateCount: candidates.length };
}
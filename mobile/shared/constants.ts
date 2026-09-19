export const BOOKING_DURATIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
] as const;

export const BOOKING_STATES = [
  'REQUESTED',
  'PAYMENT_CONFIRMED',
  'SEARCHING_PARTNER',
  'PARTNER_ASSIGNED',
  'ON_THE_WAY',
  'SHOOT_STARTED',
  'SHOOT_COMPLETED',
  'DATA_PENDING',
  'DATA_SUBMITTED',
  'CUSTOMER_CONFIRMED',
  'PAYOUT_RELEASED',
  'COMPLETED',
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

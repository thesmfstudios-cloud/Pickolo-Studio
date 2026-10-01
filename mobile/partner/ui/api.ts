import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (!supabase || !base)
    throw new Error(
      'Pickolo connection is not configured. Please contact support.',
    );
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    router.replace('/auth');
    throw new ApiError('Please sign in again.', 401);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(base + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: 'Bearer ' + data.session.access_token,
      },
      signal: controller.signal,
    });
    const result = await response.json();
    if (response.status === 401) router.replace('/auth');
    if (!response.ok)
      throw new ApiError(
        result.error || 'Unable to complete this request.',
        response.status,
      );
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      'Connection interrupted. Check your internet and try again.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type Partner = {
  id: string;
  partner_code: string;
  verification_status: string;
  service_level_id: string | null;
  bio: string | null;
  is_accepting_jobs: boolean;
  payout_upi_id: string | null;
};
export type Application = {
  display_name: string;
  phone: string;
  bio: string | null;
  skills: string[];
  base_lat: number | null;
  base_long: number | null;
  payout_upi_id: string | null;
  status: string;
  rejection_reason: string | null;
};
export type Performance = {
  completed_jobs: number;
  on_time_jobs: number;
  delivered_jobs: number;
  cancellations: number;
  no_shows: number;
  xp: number;
  average_rating: number | null;
};
export type ServiceLevel = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};
export type Payout = {
  id: string;
  booking_id: string;
  amount_paise: number;
  status: string;
  created_at: string;
  released_at: string | null;
};
export const isPaidPayout = (payout: Payout) =>
  ['released', 'processed'].includes(payout.status);
export type Job = {
  id: string;
  booking_code: string;
  partner_payout_paise?: number | null;
  status: string;
  partner_acceptance_status?: string;
  partner_offer_expires_at?: string | null;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  location_lat?: number | null;
  location_long?: number | null;
  notes?: string | null;
  service?: { name: string | null };
  service_level?: { name: string | null };
};
export const isActiveJob = (job: Job) =>
  [
    'PARTNER_ASSIGNED',
    'ON_THE_WAY',
    'SHOOT_STARTED',
    'SHOOT_COMPLETED',
    'DATA_PENDING',
  ].includes(job.status);
export const money = (paise: number) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Please try again.';

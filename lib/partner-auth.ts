import type { SupabaseClient } from '@supabase/supabase-js';

export async function getApprovedPartner(
  client: SupabaseClient,
  userId: string,
) {
  const { data, error } = await client
    .from('partners')
    .select('id,verification_status')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data || data.verification_status !== 'approved') return null;
  return data;
}

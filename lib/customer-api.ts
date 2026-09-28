import { supabaseBrowser } from './supabase-browser';
export async function customerApi(path: string, body?: unknown) {
  if (!supabaseBrowser)
    throw new Error('Booking is not available yet. Please contact Pickolo Studio.');
  const { data } = await supabaseBrowser.auth.getSession();
  if (!data.session) {
    window.location.assign('/auth');
    throw new Error('Please sign in to continue.');
  }
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: 'Bearer ' + data.session.access_token,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

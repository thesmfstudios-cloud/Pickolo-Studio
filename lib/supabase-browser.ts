import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from '@/lib/supabase-config';
import { createClient } from '@supabase/supabase-js';

const url = SUPABASE_URL;
const anonKey = SUPABASE_PUBLIC_KEY;

export const supabaseBrowser = createClient(url, anonKey);

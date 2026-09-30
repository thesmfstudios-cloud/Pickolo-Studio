import { createClient } from '@supabase/supabase-js';

const url = 'https://ywlayixocyjwodhfcyus.supabase.co';
const anonKey = 'sb_publishable_ieCYy0Mc0Iy_xUYwtriwyw_HQ19FQbX';

export const supabaseBrowser = createClient(url, anonKey);

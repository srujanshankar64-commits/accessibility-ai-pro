import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://xyyneqqbncyokeaynebt.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'PASTE_KEY_HERE';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

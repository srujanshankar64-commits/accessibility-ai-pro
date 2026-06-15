import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = 'https://zkpwpumjacihcjisshod.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcHdwdW1qYWNpaGNqaXNzaG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Nzg0MzQsImV4cCI6MjA5NjU1NDQzNH0.rYeMGFBJmK55Ygva1wi_Dcg0Xv2MXTCzujP3LGAazhw';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://xyyneqqbncyokeaynebt.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5eW5lcXFibmN5b2tlYXluZWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NzQ0ODAsImV4cCI6MjA5NjU1MDQ4MH0.BCPWQSaWF7ACxBl9s3sDnM84ovAX6SeQ87nft4-q7Qw';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

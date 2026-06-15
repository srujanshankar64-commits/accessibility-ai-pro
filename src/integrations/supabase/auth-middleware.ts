import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SUPABASE_URL = 'https://zkpwpumjacihcjisshod.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcHdwdW1qYWNpaGNqaXNzaG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Nzg0MzQsImV4cCI6MjA5NjU1NDQzNH0.rYeMGFBJmK55Ygva1wi_Dcg0Xv2MXTCzujP3LGAazhw';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();
    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header provided');
    }
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Only Bearer tokens are supported');
    }
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }
    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    const { data, error } = await supabase.auth.getClaims(token);
    if (error) {
      throw new Error(`Unauthorized: ${error.message || 'Invalid token'}`);
    }
    if (!data?.claims?.sub) {
      throw new Error('Unauthorized: Invalid token');
    }
    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);

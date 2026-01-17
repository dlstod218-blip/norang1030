import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type AppRole = 'MASTER' | 'STAFF';

export interface AppProfile {
  user_id: string;
  username: string;
  display_name: string;
  role: AppRole;
  active: boolean;
}

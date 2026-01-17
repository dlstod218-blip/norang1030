import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url) {
  throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL)');
}
if (!serviceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function requireMaster(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return { ok: false, status: 401, error: 'Missing Authorization Bearer token' };
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'Invalid session token' };
  }

  const uid = userData.user.id;
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('app_profiles')
    .select('user_id, role, active')
    .eq('user_id', uid)
    .maybeSingle();

  if (profileErr || !profile) {
    return { ok: false, status: 403, error: 'Profile not found' };
  }
  if (!profile.active) {
    return { ok: false, status: 403, error: 'Account disabled' };
  }
  if (profile.role !== 'MASTER') {
    return { ok: false, status: 403, error: 'MASTER 권한이 필요합니다.' };
  }

  return { ok: true, uid };
}

import { supabaseAdmin, requireMaster } from '../_supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await requireMaster(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const { data, error } = await supabaseAdmin
      .from('app_profiles')
      .select('user_id, username, display_name, role, active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ users: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}

import { supabaseAdmin, requireMaster } from '../_supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await requireMaster(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const { email, password, display_name, role } = req.body || {};
    if (!email || !password || !display_name) {
      return res.status(400).json({ error: 'email, password, display_name required' });
    }
    const safeRole = role === 'MASTER' ? 'MASTER' : 'STAFF';

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return res.status(500).json({ error: createErr?.message || 'Failed to create user' });
    }

    const user_id = created.user.id;
    const username = safeRole === 'MASTER' ? 'master' : email.split('@')[0];

    const { error: profileErr } = await supabaseAdmin.from('app_profiles').insert({
      user_id,
      username,
      display_name,
      role: safeRole,
      active: true,
    });

    if (profileErr) {
      // rollback auth user to avoid dangling account
      try {
        await supabaseAdmin.auth.admin.deleteUser(user_id);
      } catch {
        // ignore
      }
      return res.status(500).json({ error: profileErr.message });
    }

    return res.status(200).json({ ok: true, user_id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}

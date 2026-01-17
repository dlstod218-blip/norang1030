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

    const { user_id } = req.body || {};
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    if (user_id === auth.uid) {
      return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}

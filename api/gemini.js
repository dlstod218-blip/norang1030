export default async function handler(req, res) {
  // CORS
  const allowed = process.env.ALLOWED_ORIGINS;
  const origin = req.headers.origin;
  if (allowed && origin) {
    const allowedList = allowed.split(',').map(s => s.trim()).filter(Boolean);
    if (allowedList.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  } else if (origin) {
    // If not set, allow same-origin requests (Vercel) and local preview.
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Password');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple internal access gate (shared secret)
  const requiredPw = process.env.INTERNAL_APP_PASSWORD;
  if (requiredPw) {
    const providedPw = req.headers['x-internal-password'];
    if (!providedPw || providedPw !== requiredPw) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = body.prompt;
    const model = body.model || process.env.GEMINI_MODEL_DEFAULT || 'gemini-1.5-flash';

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: body.generationConfig || undefined,
        systemInstruction: body.systemInstruction
          ? { parts: [{ text: body.systemInstruction }] }
          : undefined,
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream error', details: data });
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text)
      .filter(Boolean)
      .join('') || '';

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
}

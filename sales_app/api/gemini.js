// Vercel Serverless Function (Node.js)
// Secure proxy for Gemini API: keeps GEMINI_API_KEY on the server.

import { GoogleGenAI } from '@google/genai';

function setCors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  if (!origin) return; // e.g., server-to-server calls

  // If no allowlist is set, reflect origin (works, but less safe). Prefer setting ALLOWED_ORIGINS.
  const allowOrigin = allowed.length === 0
    ? origin
    : (allowed.includes(origin) ? origin : null);

  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    // X-App-Password: optional shared password for internal access control
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Password');
  }
}

function checkInternalPassword(req) {
  // Optional: if INTERNAL_APP_PASSWORD is set, require matching header.
  const expected = (process.env.INTERNAL_APP_PASSWORD || '').trim();
  if (!expected) return { ok: true };

  // Vercel normalizes headers to lower-case keys
  const provided = (req.headers['x-app-password'] || '').toString();
  if (provided && provided === expected) return { ok: true };

  return { ok: false, error: 'Unauthorized' };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = checkInternalPassword(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { prompt, model, systemInstruction } = body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const chosenModel = (typeof model === 'string' && model.trim())
      ? model.trim()
      : (process.env.GEMINI_MODEL_DEFAULT || 'gemini-2.5-flash');

    const response = await ai.models.generateContent({
      model: chosenModel,
      contents: prompt,
      ...(systemInstruction ? { config: { systemInstruction } } : {})
    });

    // @google/genai returns { text } convenience accessor
    const text = (response?.text || '').toString();

    return res.status(200).json({ text });
  } catch (e) {
    // Don't leak sensitive details; keep enough for debugging.
    const message = e?.message || 'Unknown error';
    return res.status(500).json({ error: 'Gemini proxy error', message });
  }
}

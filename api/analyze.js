// POST /api/analyze  { text, channel } -> scam analysis (Claude, with offline-rules fallback)
import { analyze } from '../lib/assistant.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { text, channel } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text is required' });
  res.status(200).json(await analyze({ text, channel: typeof channel === 'string' ? channel : 'sms' }));
}

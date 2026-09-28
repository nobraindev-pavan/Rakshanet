// POST /api/analyze  { text?, channel?, image?: { mimeType, data } } -> scam analysis
// (Claude or Gemini, with offline-rules fallback). Needs text, a screenshot, or both.
import { analyze, cleanImage } from '../lib/assistant.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { text, channel, image } = req.body || {};
  const hasText = typeof text === 'string' && text.trim();
  const img = cleanImage(image);
  if (!hasText && !img) return res.status(400).json({ error: 'text or a screenshot is required' });
  res.status(200).json(await analyze({ text: hasText ? text : '', channel: typeof channel === 'string' ? channel : 'sms', image: img }));
}

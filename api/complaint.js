// POST /api/complaint  { incident } -> complaint draft (Claude, with template fallback)
import { draftComplaint } from '../lib/assistant.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const incident = req.body?.incident;
  if (!incident || typeof incident !== 'object') return res.status(400).json({ error: 'incident is required' });
  res.status(200).json(await draftComplaint(incident));
}

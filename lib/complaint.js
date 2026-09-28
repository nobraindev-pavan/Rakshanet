// Offline complaint template for cybercrime.gov.in (NCRP) / police.
// Used when the AI drafter is unavailable. Pure ES module.
import { CATEGORIES } from './scam-rules.js';

const line = (label, value) => (value ? `${label}: ${value}` : null);

const rupees = (a) => (Number.isFinite(Number(a)) && String(a).trim() !== '' ? `₹${Number(a).toLocaleString('en-IN')}` : `₹${a}`);

export function portalSection(category, amount) {
  if (category === 'sextortion') return 'Report Women/Child Related Crime';
  return amount ? 'Report Other Cyber Crime → Online Financial Fraud' : 'Report Other Cyber Crime';
}

export function buildComplaint(d) {
  const cat = CATEGORIES[d.category] || CATEGORIES.other;
  const suspect = [
    ...(d.suspect?.phones || []).map((p) => `Phone: ${p}`),
    ...(d.suspect?.upiIds || []).map((u) => `UPI ID: ${u}`),
    ...(d.suspect?.urls || []).map((u) => `Website/link: ${u}`),
    ...(d.suspect?.emails || []).map((e) => `Email: ${e}`),
  ];
  const evidence = (d.evidence || []).map((e) => `  #${e.index} ${e.label} (SHA-256 ${e.hash})`);
  return [
    'To,',
    'The Cyber Crime Cell / Station House Officer,',
    d.city ? `${d.city}` : '<Police station / city>',
    '',
    `Subject: Complaint regarding ${cat.toLowerCase()}${d.amount ? ` and loss of ${rupees(d.amount)}` : ''}`,
    '',
    'Respected Sir/Madam,',
    '',
    `I, ${d.name || '<your full name>'}, wish to report a cyber crime committed against me.`,
    '',
    'Incident details',
    line('  Date and time', d.when),
    line('  Type', cat),
    line('  Amount lost', d.amount ? rupees(d.amount) : ''),
    line('  Transaction / UTR IDs', d.txns),
    line('  Platform / channel', d.channel),
    '',
    'What happened',
    `  ${(d.description || '<describe what happened, in order>').replace(/\n/g, '\n  ')}`,
    '',
    suspect.length ? 'Suspect details' : null,
    ...suspect.map((s) => `  ${s}`),
    suspect.length ? '' : null,
    evidence.length ? 'Evidence (hash-sealed in RakshaNet; originals available on request)' : null,
    ...evidence,
    evidence.length ? '' : null,
    'I request you to register my complaint, take action against the persons responsible' + (d.amount ? ', and freeze the beneficiary accounts to recover my money.' : '.'),
    '',
    'Yours faithfully,',
    d.name || '<name>',
    line('Phone', d.phone) || 'Phone: <phone>',
    line('Email', d.email),
  ].filter((l) => l !== null).join('\n');
}

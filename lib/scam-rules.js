// Offline scam detector: pattern rules tuned for common Indian cyber frauds.
// Runs instantly in the browser (no network) and on the server as the fallback
// when the AI analysis is unavailable. Pure ES module, no dependencies.

export const CATEGORIES = {
  otp_fraud: 'OTP / PIN theft',
  upi_collect_fraud: 'UPI collect / QR fraud',
  kyc_update: 'Fake KYC / account block',
  digital_arrest: '"Digital arrest" / fake officials',
  courier_customs: 'Courier / customs parcel scam',
  job_task_scam: 'Part-time job / task scam',
  investment_scam: 'Investment / trading / crypto scam',
  lottery_prize: 'Lottery / prize / cashback scam',
  loan_app: 'Instant loan app scam',
  sextortion: 'Sextortion / blackmail',
  tech_support: 'Remote-access / tech support scam',
  impersonation: 'Impersonation of family or friend',
  fake_customer_care: 'Fake customer care / refund',
  phishing: 'Phishing link',
  other: 'Other suspicious activity',
  not_a_scam: 'No clear scam signs',
};

const RULES = [
  { id: 'otp', cat: 'otp_fraud', w: 40, re: /\b(share|send|tell|give|forward|read out|batao|bhejo)\b[^.\n]{0,40}\b(otp|one[- ]time password|pin|cvv|verification code)\b|\b(otp|cvv|upi pin)\b[^.\n]{0,40}\b(share|send|tell|batao|bhejo)\b/i, flag: 'Asks you to share an OTP, PIN or CVV. No bank or official ever asks for these.' },
  { id: 'kyc', cat: 'kyc_update', w: 30, re: /\b(kyc|pan|aadhaa?r)\b[^.\n]{0,50}\b(update|expir|block|suspend|pending|link)/i, flag: 'Claims your KYC / PAN / Aadhaar needs an urgent update.' },
  { id: 'block', cat: 'kyc_update', w: 20, re: /\b(account|card|sim|wallet|number|electricity|connection)\b[^.\n]{0,40}\b(block|suspend|deactivat|disconnect|freez|band ho)/i, flag: 'Threatens to block your account, card, SIM or service.' },
  { id: 'urgent', w: 12, re: /\b(urgent|immediately|within \d+\s*(hours?|hrs?|minutes?|mins?)|today only|last (chance|warning|reminder)|act now|turant|abhi)\b/i, flag: 'Creates urgency so you act before thinking.' },
  { id: 'arrest', cat: 'digital_arrest', w: 40, re: /\b(digital arrest|arrest warrant|money laundering|narcotics|cbi|enforcement directorate|\bed\b officer|crime branch|cyber cell|trai|supreme court|rbi officer)\b/i, flag: 'Claims to be police, CBI, ED, TRAI or a court. Officials never "arrest" people over video calls or demand payment.' },
  { id: 'safe-account', cat: 'digital_arrest', w: 30, re: /\b(verification|safe|secure|rbi|escrow|government) account\b|\b(verify|check) your (savings|funds|money|bank balance)\b/i, flag: 'Asks you to move money to a "safe" or "verification" account. No agency or bank ever does this.' },
  { id: 'courier', cat: 'courier_customs', w: 30, re: /\b(fedex|dhl|courier|parcel|package|shipment)\b[^.\n]{0,80}\b(drugs|illegal|seized|customs|passports?|held)\b/i, flag: 'Says a parcel in your name was seized or holds illegal items.' },
  { id: 'prize', cat: 'lottery_prize', w: 25, re: /\b(you (have )?won|winner|lottery|lucky draw|prize|kbc|jackpot|cashback of|reward points? (expir|redeem))/i, flag: 'Promises a prize, lottery or reward you never entered for.' },
  { id: 'job', cat: 'job_task_scam', w: 30, re: /\b(part[- ]time|work from home|daily (income|payout)|earn\s*(rs\.?|₹|inr)?\s*\d[\d,]*\s*(per|a|\/)\s*(day|hour)|like (and subscribe|youtube videos|videos)|rate (hotels|products)|prepaid task|telegram task)\b/i, flag: 'Offers easy money for simple online tasks, a classic task scam.' },
  { id: 'invest', cat: 'investment_scam', w: 30, re: /\b(guaranteed (returns?|profit)|double your money|\d+\s*% (daily|weekly|monthly|per day|per week)|risk[- ]free (returns?|profit)|trading tips|ipo allotment|vip (group|trading)|crypto (investment|mining)|usdt)\b/i, flag: 'Promises guaranteed or unrealistic investment returns.' },
  { id: 'upi', cat: 'upi_collect_fraud', w: 40, re: /\b(scan|enter (your )?(upi )?pin|approve)\b[^.\n]{0,50}\b(receive|get|refund|credit|cashback)\b|\bcollect request\b/i, flag: 'Asks you to scan a QR or enter your UPI PIN to receive money. A PIN is only needed to send money.' },
  { id: 'remote', cat: 'tech_support', w: 40, re: /\b(anydesk|teamviewer|quick ?support|rustdesk|airdroid|screen ?shar(e|ing))\b/i, flag: 'Asks you to install a remote-access or screen-sharing app.' },
  { id: 'apk', cat: 'phishing', w: 35, re: /\.apk\b|install (this|the) (app|apk) from/i, flag: 'Asks you to install an app file (APK) from outside the Play Store.' },
  { id: 'loan', cat: 'loan_app', w: 20, re: /\b(instant loan|pre[- ]approved loan|loan (approved|sanctioned)|no cibil|without documents?)\b/i, flag: 'Offers an instant loan with no checks, typical of predatory loan apps.' },
  { id: 'sextortion', cat: 'sextortion', w: 45, re: /\b(video call[^.\n]{0,40}(record|leak|viral)|nude|intimate (video|photos?|pictures?)|(leak|viral|send)[^.\n]{0,30}(your )?(video|photos?) to (your )?(family|friends|contacts))/i, flag: 'Threatens to leak intimate content: sextortion. Do not pay; report it.' },
  { id: 'fee', w: 20, re: /\b(pay|transfer|deposit|send)\b[^.\n]{0,40}\b(fee|charges?|tax|gst|deposit|refundable|processing|registration|clearance)\b/i, flag: 'Asks for an upfront fee, tax or deposit before you get anything.' },
  { id: 'giftcard', w: 20, re: /\b(gift ?cards?|google play (card|code)|amazon (pay )?voucher|bitcoin|usdt)\b/i, flag: 'Wants payment in gift cards or crypto, which cannot be reversed.' },
  { id: 'family', cat: 'impersonation', w: 25, re: /\b(new number|lost my phone|hi (mum|mom|dad|papa|mummy)|it'?s me,? your|send money urgently)\b/i, flag: 'Claims to be a friend or relative on a new number asking for money.' },
  { id: 'care', cat: 'fake_customer_care', w: 25, re: /\b(customer care|helpline|refund)\b[^.\n]{0,60}\b(call|whatsapp|contact)\b[^.\n]{0,20}(\+?91[\s-]?)?[6-9]\d{9}/i, flag: 'Pushes a "customer care" or "refund" number that is a personal mobile.' },
  { id: 'secret', w: 15, re: /\b((don'?t|do not|must not|never) (tell|inform) (anyone|anybody|your family)|keep (this|it) (secret|confidential)|do not disconnect|stay on (the )?(call|video))\b/i, flag: 'Tells you to keep it secret or stay on the call: isolation tactic.' },
  { id: 'credentials', cat: 'phishing', w: 25, re: /\b(verify|confirm|update|login|sign in)\b[^.\n]{0,40}\b(password|net ?banking|credentials|card details|account details)\b/i, flag: 'Asks you to log in or confirm banking details through a link or message.' },
];

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 'cutt.ly', 'rb.gy', 't.ly', 'is.gd', 'goo.gl', 'shorturl.at', 'ow.ly', 'tiny.cc', 'rebrand.ly', 's.id', 'v.gd', 'bitly.ws']);
const RISKY_TLDS = new Set(['xyz', 'top', 'click', 'live', 'buzz', 'icu', 'shop', 'online', 'site', 'club', 'vip', 'win', 'loan', 'work', 'rest', 'cfd', 'sbs', 'monster', 'gq', 'tk', 'ml', 'cf', 'ga']);
const BRANDS = {
  sbi: ['sbi.co.in', 'onlinesbi.sbi', 'sbi.bank.in', 'onlinesbi.com', 'sbicard.com'],
  hdfc: ['hdfcbank.com', 'hdfc.com', 'hdfcbank.bank.in'],
  icici: ['icicibank.com', 'icici.bank.in'],
  axis: ['axisbank.com', 'axis.bank.in'],
  kotak: ['kotak.com', 'kotak.bank.in'],
  paytm: ['paytm.com', 'paytm.in'],
  phonepe: ['phonepe.com'],
  gpay: ['pay.google.com', 'google.com'],
  amazon: ['amazon.in', 'amazon.com'],
  flipkart: ['flipkart.com'],
  irctc: ['irctc.co.in'],
  incometax: ['incometax.gov.in'],
  indiapost: ['indiapost.gov.in'],
  npci: ['npci.org.in'],
  aadhaar: ['uidai.gov.in'],
  epfo: ['epfindia.gov.in'],
  bescom: ['bescom.co.in'],
};
const MULTI_PART_SUFFIXES = /\.(co|gov|org|net|ac|edu|nic|res|bank)\.in$|\.co\.uk$/;

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')]+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|xyz|top|click|live|buzz|icu|shop|online|site|club|vip|info|link|app|io|me|co|ly|gd|at|ws|cc|id)(?:\/[^\s<>"')]*)?)/gi;
const PHONE_RE = /(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g;
const UPI_RE = /\b[a-z0-9._-]{2,}@(?:ok[a-z]+|ybl|ibl|axl|paytm|upi|apl|yapl|ptyes|ptsbi|pthdfc|ptaxis|sbi|hdfcbank|icici|axisbank|kotak|freecharge|jio|airtel|waicici|wahdfcbank|abfspay|fbl|idfcbank|rbl|indus|timecosmos|slice|superyes|naviaxis|[a-z]{2,12})(?![\w-]|\.[a-z0-9])/gi;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi;
const AMOUNT_RE = /(?:₹|rs\.?|inr)\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:rupees|lakh|crore)\b/gi;

export function registeredDomain(host) {
  const h = host.toLowerCase().replace(/\.$/, '');
  const parts = h.split('.');
  return parts.slice(MULTI_PART_SUFFIXES.test(h) ? -3 : -2).join('.');
}

function hostOf(raw) {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function analyzeUrl(raw) {
  const flags = [];
  let score = 0;
  const host = hostOf(raw);
  if (!host) return { url: raw, host: null, score: 0, flags };
  const reg = registeredDomain(host);
  const tld = host.split('.').pop();
  const add = (w, flag) => { score += w; flags.push(flag); };

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add(30, `Link goes to a bare IP address (${host}) instead of a named website.`);
  if (host.includes('xn--')) add(30, `Link uses look-alike (punycode) characters: ${host}.`);
  if (SHORTENERS.has(reg) || SHORTENERS.has(host)) add(15, `Link is shortened (${host}), hiding where it really goes.`);
  if (RISKY_TLDS.has(tld)) add(15, `Link uses a ".${tld}" domain, common in throwaway scam sites.`);
  if (/^http:\/\//i.test(raw)) add(5, 'Link is not secure (http, not https).');
  if (/@/.test(raw.replace(/^https?:\/\//i, '').split('/')[0])) add(25, 'Link hides its real destination with an "@" trick.');
  if (host.split('.').length > 4) add(10, `Link has an unusually long chain of subdomains (${host}).`);

  const tokens = host.split(/[.-]/);
  for (const [brand, official] of Object.entries(BRANDS)) {
    // Short brands (sbi) must start/end a label to avoid matching inside words.
    const mentions = tokens.some((t) => t === brand || (brand.length >= 4 ? t.includes(brand) : t.startsWith(brand) || t.endsWith(brand)));
    const isOfficial = official.some((d) => host === d || host.endsWith(`.${d}`));
    if (mentions && !isOfficial) {
      add(35, `Pretends to be ${brand.toUpperCase()} but is not an official ${brand.toUpperCase()} domain (${reg}).`);
      break;
    }
  }
  if (/(kyc|verify|update|secure|login|reward|refund|claim|bonus|gift|free)/.test(host)) add(10, `Domain name uses bait words (${host}).`);
  return { url: raw, host, domain: reg, score, flags };
}

const uniq = (arr) => [...new Set(arr.map((s) => s.trim()))].filter(Boolean);

export function extractIndicators(text) {
  const emails = uniq(text.match(EMAIL_RE) || []);
  // Drop matches that are just the domain half of an email address.
  const urls = uniq((text.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?]+$/, '')))
    .filter((u) => !emails.some((e) => e.toLowerCase().endsWith(`@${u.toLowerCase()}`)));
  return {
    urls,
    phones: uniq((text.match(PHONE_RE) || []).map((p) => p.replace(/[\s-]/g, ''))),
    upiIds: uniq(text.match(UPI_RE) || []).filter((u) => !emails.some((e) => e.toLowerCase().startsWith(u.toLowerCase()))),
    emails,
    amounts: uniq(text.match(AMOUNT_RE) || []),
  };
}

const ACTIONS = {
  otp_fraud: ['Do not share the OTP or PIN with anyone, including "bank staff".', 'If you already shared it, call your bank now to block the card / UPI and then call 1930.'],
  upi_collect_fraud: ['Decline the collect request. Entering your UPI PIN always sends money, never receives it.', 'Report the UPI ID in your payment app and on cybercrime.gov.in.'],
  kyc_update: ['Do not click the link. Update KYC only in your bank\'s official app or at a branch.', 'Call the number on the back of your card to confirm; ignore numbers in the message.'],
  digital_arrest: ['Disconnect. No police or agency conducts "digital arrest" or asks for money on video calls.', 'Do not transfer money to "verify" funds. Call 1930 or visit your local police station.'],
  courier_customs: ['Hang up. Courier firms and customs don\'t transfer calls to police.', 'Check parcel status only on the courier\'s official website.'],
  job_task_scam: ['Do not pay any "task deposit" or "registration fee". Genuine jobs never charge you.', 'Leave the Telegram / WhatsApp group and report the numbers.'],
  investment_scam: ['Do not invest. Check whether the entity is SEBI-registered at sebi.gov.in.', 'Never install trading apps shared over WhatsApp or Telegram.'],
  lottery_prize: ['Ignore it. You cannot win a contest you never entered, and real prizes never need a fee.'],
  loan_app: ['Use only RBI-registered lenders. Do not give a loan app access to contacts or gallery.', 'If you\'re being harassed, report the app and screenshots on cybercrime.gov.in.'],
  sextortion: ['Do not pay; paying leads to more demands. Stop replying and keep the evidence.', 'Report on cybercrime.gov.in ("Women/Child related crime") or call 1930. Ask the platform to take the content down.'],
  tech_support: ['Do not install AnyDesk / TeamViewer at a stranger\'s request. Uninstall it if you did.', 'If they had access, change your banking passwords from another device and alert your bank.'],
  impersonation: ['Call the person on their old, known number before sending anything.'],
  fake_customer_care: ['Find customer care numbers only on the official website or app, never via search ads or messages.'],
  phishing: ['Do not open the link or install anything. If you entered details, change passwords and call your bank.'],
  other: ['Do not act on the message until you verify it through an official channel.'],
};
const ALWAYS = ['Save this message to your Evidence Vault before deleting it.', 'Lost money? Call 1930 immediately (within the "golden hour") and report at cybercrime.gov.in.'];

export function analyzeText(text, channel = 'sms') {
  const input = String(text || '').slice(0, 8000);
  const hits = [];
  let score = 0;
  const catScore = {};
  for (const rule of RULES) {
    if (rule.re.test(input)) {
      hits.push(rule.flag);
      score += rule.w;
      if (rule.cat) catScore[rule.cat] = (catScore[rule.cat] || 0) + rule.w;
    }
  }
  const indicators = extractIndicators(input);
  const links = indicators.urls.map(analyzeUrl);
  for (const l of links) {
    score += l.score;
    hits.push(...l.flags);
    if (l.score >= 25) catScore.phishing = (catScore.phishing || 0) + l.score;
  }
  if (channel === 'call' && score > 0) score += 5;

  // Prefer the specific scam story (KYC, digital arrest...) over the generic "phishing" link label.
  const ranked = Object.entries(catScore).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const category = ranked.find((c) => c !== 'phishing') || ranked[0] || (score >= 20 ? 'other' : 'not_a_scam');
  const risk = score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low';
  const summary = risk === 'low'
    ? 'No common scam patterns found. Still verify through an official channel before sharing money or details.'
    : `${risk === 'high' ? 'Very likely a scam' : 'Possibly a scam'} (${CATEGORIES[category]}). ${hits.length} warning sign${hits.length === 1 ? '' : 's'} found.`;
  return {
    source: 'rules',
    risk,
    score: Math.min(100, score),
    category,
    categoryLabel: CATEGORIES[category],
    summary,
    redFlags: uniq(hits),
    actions: risk === 'low' ? ['Verify the sender through an official number or website before acting.', ALWAYS[0]] : [...(ACTIONS[category] || ACTIONS.other), ...ALWAYS],
    indicators,
    links,
  };
}

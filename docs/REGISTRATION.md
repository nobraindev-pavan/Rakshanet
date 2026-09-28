# Async'26 registration kit: RakshaNet

Copy-paste answers for every field in the Async'26 registration guide, in the order the form asks for them. Anything in `<angle brackets>` is yours to fill in.

The form must be filled in by the **team leader only**.

## Deliverables checklist

| Deliverable | Status | Where |
|---|---|---|
| Project name | Ready | **RakshaNet** |
| Live link | Deploy first, see [Deploying](#deploying-for-the-live-link) | `<live URL>` or the GitHub repo |
| GitHub repo | Ready | https://github.com/nobraindev-pavan/Rakshanet |
| X post link | Post the draft below, then copy its URL | `<x.com/.../status/...>` |
| Documentation (optional) | Paste this file + README into a Google Doc, set to "Anyone with the link" | `<docs.google.com/...>` |
| Logo | Ready | [`assets/logo-512.png`](../assets/logo-512.png) (also 1024 px and SVG) |
| Demo video | Ready, 48 s | [`docs/media/rakshanet-demo.mp4`](media/rakshanet-demo.mp4) |
| Pitch deck (PPT) | Ready, 8 slides | [`docs/RakshaNet-Pitch-Deck.pptx`](RakshaNet-Pitch-Deck.pptx). Put your live link on slide 8. |
| Short description | Ready | Below |
| Full idea description | Ready | Below |

---

## Step 6: project credentials

| Field | Value |
|---|---|
| Project Name | `RakshaNet` |
| Industry Type | **Cybersecurity** (or the closest security / AI / social-impact option). If none fits, choose **Others**. |
| Live link | `<live URL>`. If not deployed: `https://github.com/nobraindev-pavan/Rakshanet` |
| X account | `<your X profile URL>` |
| GitHub repo | `https://github.com/nobraindev-pavan/Rakshanet` |
| Documentation | `<public Google Doc link>` (optional) |
| Ticker | `NA` |
| Token type | `utility` |
| Launch date | Skip |
| Utility format | `Team ID : <your team ID>, Description: NA` |

## Step 7: track and social

1. Select **Async'26**.
2. Select your track: `<the track you are competing in>`.
3. X post URL: the link to the post below, after you publish it.

### X post draft (280 characters or fewer)

```
Building RakshaNet for #Async26 🛡️

Paste any suspicious SMS, link or call script and AI tells you if it's a scam. Lost money? A golden-hour 1930 guide, a tamper-proof evidence vault and an AI-drafted cybercrime complaint.

github.com/nobraindev-pavan/Rakshanet
```

## Step 8 to 10: media

- Logo: `assets/logo-512.png`
- Banner: skip
- Additional media: `docs/media/rakshanet-demo.mp4` and `docs/RakshaNet-Pitch-Deck.pptx`

## Step 12: short description

> AI-powered cyber-fraud shield: check any message or link for scams, get golden-hour help after fraud, keep tamper-proof evidence and file your cybercrime complaint in minutes.

## Step 13: describe your idea

**What it is**

RakshaNet ("raksha" means protection) is a cyber-fraud shield for everyday people in India, delivered as an installable, offline-first web app. It has four parts:

- **Scam Check:** paste any SMS, WhatsApp message, email, link, UPI request or what a caller said. You get an instant verdict, then an AI analysis (Google Gemini, or Claude when available) with the risk level, the scam type, the specific red flags and what to do next.
- **Scammed? guide:** a golden-hour emergency flow. It tells you to call 1930 first, then block your bank and UPI, secure your accounts, warn your contacts and report. It's a checklist that remembers your progress.
- **Evidence Vault:** scam messages, payment screenshots and UTR IDs are fingerprinted with SHA-256 and hash-chained, so any edit is provable. You can sign the vault with your crypto wallet to timestamp it.
- **AI complaint drafter:** the AI turns your facts, the suspect details and your vault evidence into a clear complaint ready for cybercrime.gov.in, and tells you which portal section to choose.

**Why it was built**

Cyber fraud wins at three moments. Before: fake KYC SMS, "digital arrest" video calls, task scams and look-alike bank links are convincing. During: victims panic and miss the golden hour, when calling 1930 can still freeze the money. After: screenshots get deleted, complaints are vague, and evidence can be questioned. RakshaNet covers all three, even with weak or no internet.

**How it works (technical approach)**

- **Offline rule engine** (`lib/scam-rules.js`): 20+ patterns for Indian fraud types (OTP theft, UPI collect/QR, fake KYC, digital arrest, courier, task, investment, loan-app, sextortion, remote-access, impersonation). It also does link forensics: look-alike bank and brand domains, punycode, URL shorteners, bare IP hosts, risky TLDs and "@" tricks. It extracts UPI IDs, phone numbers, links, emails and amounts. It gives an instant result with no network.
- **AI analysis** (`api/analyze.js`): a serverless function calls Gemini (official Google GenAI SDK, free tier) or Claude (official Anthropic SDK) with a JSON-schema structured output (risk, category, summary, red flags, actions). The pasted text is fenced as untrusted data so instructions hidden in a scam message are never followed. If the AI is unavailable, blocks the request or is cut off, the app falls back to the rule engine.
- **AI complaint drafting** (`api/complaint.js`): the AI writes the complaint only from the facts provided and leaves `<placeholders>` instead of inventing details. There's an offline template fallback.
- **Evidence Vault** (`lib/ledger.js`): each record is canonical JSON `{index, timestamp, type, payload, prevHash}` hashed with WebCrypto SHA-256. Verification pinpoints any edit, deletion or reorder. Files are hashed locally and never uploaded. An EIP-1193 wallet (for example MetaMask) signs the vault head with `personal_sign`. You can export a JSON evidence pack.
- **PWA:** plain HTML, CSS and JS with no framework, cached by a service worker. No accounts and no database: data stays on the device, and text is sent to the AI only when you press Check or Draft.
- 22 automated tests cover the rules, the ledger, and the Gemini and Claude request/fallback paths against mocked APIs.

**Unique selling point**

It helps before, during and after a scam in one place. It works offline and uses AI when it's available. It's tuned for Indian frauds and the 1930 / cybercrime.gov.in process. Its hash-chained, wallet-signed vault makes evidence tampering provable. And it takes a panicked victim to a ready-to-file complaint in minutes.

**Additional details (optional)**

The AI is designed to be safe: structured outputs, prompt-injection fencing, facts-only drafting and a graceful fallback. There's no sign-up and no server-side storage, so there's nothing to breach.

## Step 14: roadmap (optional)

> **Current status:** working prototype with an offline scam rule engine, AI-powered (Gemini / Claude) scam analysis and complaint drafting, a golden-hour emergency checklist, a hash-chained Evidence Vault with wallet signing, and an installable offline PWA.
>
> **Next:** screenshot and image input to the AI, Hindi and regional languages, a WhatsApp bot and browser extension, and a community database of reported scam numbers and UPI IDs.
>
> **Later:** periodic on-chain anchoring of vault roots, bank and NCRP integrations, live scam-call detection, and a dashboard for police cyber cells.

## Step 15: highlights

Paste the same X post link used in Step 7.

## Step 16: team leader and wallet

1. Name: `<your name>`. Role: `Team Leader`
2. Wallet address: click **Authenticate** (top right), then **Read and Sign**, then **Manage Wallet** (top right) to confirm the address. Copy it and paste it into the form.
3. Bio template:

> `<Name>` is a `<role, e.g. full-stack developer>` focused on `<areas, e.g. security, AI apps and Web3>`. Built RakshaNet for Async'26: an AI-powered cyber-fraud shield with a hash-chained evidence vault. Previous projects: `<project 1: one line>`, `<project 2: one line>`, `<project 3: one line>`. Skills: `<JavaScript, Node.js, LLM APIs, Solidity, ...>`.

## Step 17: team members

Skip this section.

---

## Deploying for the live link

**Vercel (recommended, needed for the AI features):**

1. Go to vercel.com, choose Add New, then Project, and import `nobraindev-pavan/Rakshanet`. Leave the framework preset as "Other" and the build command empty.
2. Get a **free** Gemini key: go to **aistudio.google.com**, sign in with a Google account, then choose **Get API key → Create API key**. No card is needed.
3. In Vercel, open **Settings → Environment Variables** and add `GEMINI_API_KEY` with that key, with all environments ticked.
4. Deploy, or **Redeploy** if the project already exists, because new variables only apply to fresh deploys. The `api/` folder becomes the `/api/analyze` and `/api/complaint` functions automatically.

If you later get Claude credits, add `ANTHROPIC_API_KEY` too; Claude is used when both are set. Without any key, or on a static host such as GitHub Pages or Netlify without functions, the app still works fully in offline mode. It uses the rule engine and the complaint template in place of AI.

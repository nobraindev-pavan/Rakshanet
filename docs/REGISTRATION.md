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
| Demo video | Ready, 40 s | [`docs/media/rakshanet-demo.mp4`](media/rakshanet-demo.mp4) |
| Pitch deck (PPT) | Ready, 8 slides | [`docs/RakshaNet-Pitch-Deck.pptx`](RakshaNet-Pitch-Deck.pptx). Put your live link and team names on slide 8. |
| Short description | Ready | Below |
| Full idea description | Ready | Below |

---

## Step 6: project credentials

| Field | Value |
|---|---|
| Project Name | `RakshaNet` |
| Industry Type | Closest fit to safety or social impact (for example Social Good, Security, or Consumer). If none fits, choose **Others**. |
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

Hold-to-SOS with live location, a Safe Walk timer that alerts your people if you don't check in, and a tamper-evident evidence ledger you can sign with your wallet.

Try it: <live link>
Code: github.com/nobraindev-pavan/Rakshanet
```

## Step 8 to 10: media

- Logo: `assets/logo-512.png`
- Banner: skip
- Additional media: `docs/media/rakshanet-demo.mp4` and `docs/RakshaNet-Pitch-Deck.pptx`

## Step 12: short description

> One-tap SOS, a Safe Walk check-in timer and a tamper-evident evidence ledger: help in seconds, proof nobody can quietly edit.

## Step 13: describe your idea

**What it is**

RakshaNet ("raksha" means protection) is a personal safety web app that installs like a native app. It has three layers: a hold-to-send SOS that shares your live location with your guardians, a Safe Walk timer that raises the alarm automatically if you don't check in, and an evidence ledger that seals every alert into a hash-chained log you can sign with your crypto wallet.

**Why it was built**

Safety apps tend to fail at the moments that matter. They are too slow to open, one-tap buttons misfire so people turn them off, and they do nothing if you can't reach your phone. Afterwards, screenshots and chat logs are easy to dispute. India's NCRB recorded 4,45,256 cases of crimes against women in 2022. We wanted something that takes one gesture to use, protects you even when you can't act, and leaves a record that is provably untouched.

**How it works (technical approach)**

- Installable PWA in plain HTML, CSS and JavaScript with no framework and no backend. About 40 KB of app code, cached by a service worker so SOS, Safe Walk and the ledger work offline.
- **SOS:** a 1.5-second hold with a progress ring prevents misfires (keyboard accessible too). It captures high-accuracy GPS through the Geolocation API and builds an alert with a Google Maps link and the evidence hash. The alert is ready to send by SMS to all guardians, WhatsApp, the native share sheet, or a 112 call.
- **Safe Walk:** a dead-man's switch. The deadline is saved on the device, so it survives a reload. If it expires, an SOS fires automatically.
- **Evidence ledger:** each event is `{index, timestamp, type, payload, prevHash}`, canonicalised (sorted-key JSON) and hashed with WebCrypto SHA-256. Every record commits to the previous one, so editing, deleting or reordering any record is detected and the broken record is pinpointed. Writes are serialised so the chain never forks. A built-in tamper test demonstrates this on a copy.
- **Wallet anchoring:** any EIP-1193 wallet (for example MetaMask) signs the ledger head with `personal_sign`. That gives a cryptographic, timestamped proof of the evidence without gas or tokens.
- **Nearby help:** an OpenStreetMap Overpass query lists police stations and hospitals within 3 km, with call or directions buttons. Leaflet is bundled locally and loaded only when the map opens.
- The ledger core has unit tests (`npm test`), including tests for forged-entry and deletion detection.

**Unique selling point**

It protects you before, during and after an incident. The hold-to-send trigger can't misfire. Safe Walk works even when you can't touch your phone. The hash-chained, wallet-signed ledger makes evidence tampering provable. Everything is private by default: data stays on your device until you choose to send it.

**Additional details (optional)**

No sign-up and no server, so there is nothing to breach. Works on any modern phone browser and adapts to dark and light mode. Built for Indian emergency numbers (112, women's helpline 1091).

## Step 14: roadmap (optional)

> **Current status:** working prototype covering hold-to-SOS, Safe Walk, the hash-chained evidence ledger, wallet signing, the nearby-help map and offline PWA support.
>
> **Next:** periodic on-chain anchoring of ledger Merkle roots on a low-fee chain, background SMS alerts through a gateway, and a shake or power-button trigger.
>
> **Later:** a verified volunteer responder network with reputation, hashed audio and photo evidence capture, an NGO and police dashboard, and multilingual voice SOS.

## Step 15: highlights

Paste the same X post link used in Step 7.

## Step 16: team leader and wallet

1. Name: `<your name>`. Role: `Team Leader`
2. Wallet address: click **Authenticate** (top right), then **Read and Sign**, then **Manage Wallet** (top right) to confirm the address. Copy it and paste it into the form.
3. Bio template:

> `<Name>` is a `<role, e.g. full-stack developer>` focused on `<areas, e.g. web apps and Web3>`. Built RakshaNet for Async'26: a PWA with hash-chained evidence and wallet signing. Previous projects: `<project 1: one line>`, `<project 2: one line>`, `<project 3: one line>`. Skills: `<JavaScript, React, Solidity, ...>`.

## Step 17: team members

Skip this section.

---

## Deploying for the live link

The app is static files with no build step. Pick one:

- **Vercel:** go to vercel.com, choose Add New, then Project, import `nobraindev-pavan/Rakshanet`, and deploy. Leave the framework preset as "Other" and the build command empty.
- **Netlify:** go to app.netlify.com, choose Add new site, then Import from Git, and pick the repo. Leave the build command empty and set the publish directory to `/`.
- **GitHub Pages:** in the repo, open Settings, then Pages, choose Deploy from a branch, and pick your branch with `/ (root)`.

Geolocation and the service worker need HTTPS. All three hosts provide it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText, analyzeUrl, extractIndicators, registeredDomain } from '../lib/scam-rules.js';

test('KYC phishing SMS with look-alike bank link is high risk', () => {
  const r = analyzeText('Dear customer your SBI account will be blocked today. Update KYC immediately: http://sbi-kyc-update.xyz/login');
  assert.equal(r.risk, 'high');
  assert.equal(r.category, 'kyc_update');
  assert.ok(r.redFlags.some((f) => f.includes('not an official SBI domain')));
});

test('digital arrest script is classified correctly', () => {
  const r = analyzeText('This is CBI officer. A parcel in your name with drugs was seized by customs. You are under digital arrest, stay on the video call and do not tell anyone.', 'call');
  assert.equal(r.risk, 'high');
  assert.equal(r.category, 'digital_arrest');
});

test('UPI "scan to receive" and OTP sharing are flagged', () => {
  assert.equal(analyzeText('Scan this QR and enter UPI PIN to receive your refund of Rs 5,000').category, 'upi_collect_fraud');
  assert.equal(analyzeText('Please share the OTP you received to verify').category, 'otp_fraud');
});

test('task scam and sextortion', () => {
  assert.equal(analyzeText('Part-time job! Earn ₹3000 per day by liking YouTube videos. Pay registration fee 500').category, 'job_task_scam');
  assert.equal(analyzeText('I recorded our video call. Pay 20000 or I will send your video to your family').category, 'sextortion');
});

test('ordinary message is low risk', () => {
  const r = analyzeText('Hey, are we still meeting for lunch at 1pm tomorrow?');
  assert.equal(r.risk, 'low');
  assert.equal(r.category, 'not_a_scam');
});

test('a bare suspicious link is labelled phishing', () => {
  assert.equal(analyzeText('http://hdfcbank-secure-login.com/verify', 'link').category, 'phishing');
});

test('official domains are not flagged as impersonation', () => {
  assert.equal(analyzeUrl('https://www.onlinesbi.sbi/').score, 0);
  assert.equal(analyzeUrl('https://www.hdfcbank.com/personal').score, 0);
  assert.ok(analyzeUrl('https://hdfcbank-secure-login.com').score >= 35);
  assert.ok(analyzeUrl('http://192.168.4.20/pay').score >= 30);
  assert.ok(analyzeUrl('https://bit.ly/3xYz').score >= 15);
});

test('registeredDomain handles Indian second-level suffixes', () => {
  assert.equal(registeredDomain('www.irctc.co.in'), 'irctc.co.in');
  assert.equal(registeredDomain('a.b.example.com'), 'example.com');
});

test('extracts phones, UPI IDs, emails, links and amounts', () => {
  const i = extractIndicators('Pay ₹1,999 to refund.help@ybl or call +91 98765 43210, mail support@sbi-care.com, visit bit.ly/abc');
  assert.deepEqual(i.upiIds, ['refund.help@ybl']);
  assert.deepEqual(i.phones, ['+919876543210']);
  assert.deepEqual(i.emails, ['support@sbi-care.com']);
  assert.deepEqual(i.urls, ['bit.ly/abc']);
  assert.deepEqual(i.amounts, ['₹1,999']);
  assert.deepEqual(extractIndicators('Send it to refund.cbi@ybl.').upiIds, ['refund.cbi@ybl']);
});

import { describe, expect, it } from 'vitest';
import { scrub, summariseRedactions } from '../../src/analysis/scrub.ts';

describe('scrub', () => {
  it('redacts GitHub PATs and reports the type', () => {
    const r = scrub('token = ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    expect(r.text).not.toContain('ghp_abcdef');
    expect(r.text).toContain('<redacted: github-pat>');
    expect(r.redactions).toHaveLength(1);
    expect(r.redactions[0].type).toBe('github-pat');
  });

  it('redacts AWS access keys', () => {
    const r = scrub('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
    expect(r.text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(r.redactions.some((x) => x.type === 'aws-access-key')).toBe(true);
  });

  it('redacts Stripe live keys', () => {
    const r = scrub('STRIPE_SECRET=sk_live_abcdefghijklmnopqrstuvwx');
    expect(r.text).not.toContain('sk_live_abc');
    expect(r.redactions.some((x) => x.type === 'stripe-key')).toBe(true);
  });

  it('redacts PEM private key blocks', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIB...\nfake\n-----END RSA PRIVATE KEY-----';
    const r = scrub(pem);
    expect(r.text).not.toContain('MIIB');
    expect(r.redactions.some((x) => x.type === 'pem-private-key')).toBe(true);
  });

  it('passes clean text through unchanged with no redactions', () => {
    const r = scrub('A perfectly innocuous README sentence.');
    expect(r.text).toBe('A perfectly innocuous README sentence.');
    expect(r.redactions).toHaveLength(0);
  });

  it('handles empty input', () => {
    const r = scrub('');
    expect(r.text).toBe('');
    expect(r.redactions).toHaveLength(0);
  });

  it('summariseRedactions counts by type', () => {
    const r = scrub('one ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaa another ghp_bbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(summariseRedactions(r.redactions)).toBe('2× github-pat');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildProvenance,
  provenanceFooter,
  provenanceHeaders,
} from '../../src/analysis/provenance.ts';

describe('provenance', () => {
  it('hashes the body deterministically', async () => {
    const a = await buildProvenance({
      body: 'hello world',
      toolVersion: '0.1.0',
      generatedAt: '2026-01-01T00:00:00Z',
    });
    const b = await buildProvenance({
      body: 'hello world',
      toolVersion: '0.1.0',
      generatedAt: '2026-01-01T00:00:00Z',
    });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different bodies', async () => {
    const a = await buildProvenance({ body: 'one', toolVersion: '0.1.0' });
    const b = await buildProvenance({ body: 'two', toolVersion: '0.1.0' });
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('renders a footer that includes generated_at + content_hash + tool_version', async () => {
    const p = await buildProvenance({
      body: 'body',
      toolVersion: '0.1.0',
      generatedAt: '2026-01-01T00:00:00Z',
      sourceSha: 'abc123',
    });
    const footer = provenanceFooter(p);
    expect(footer).toContain('generated_at: 2026-01-01T00:00:00Z');
    expect(footer).toContain('content_hash: sha256:');
    expect(footer).toContain('source_sha: abc123');
    expect(footer).toContain('tool_version: 0.1.0');
  });

  it('omits source_sha line when not provided', async () => {
    const p = await buildProvenance({ body: 'body', toolVersion: '0.1.0' });
    expect(provenanceFooter(p)).not.toContain('source_sha');
  });

  it('mirrors footer fields into headers', async () => {
    const p = await buildProvenance({
      body: 'body',
      toolVersion: '0.2.0',
      sourceSha: 'deadbeef',
    });
    const h = provenanceHeaders(p);
    expect(h['X-Devprint-Hash']).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(h['X-Devprint-Tool-Version']).toBe('0.2.0');
    expect(h['X-Devprint-Sha']).toBe('deadbeef');
    expect(h['X-Devprint-Generated-At']).toBeDefined();
  });
});

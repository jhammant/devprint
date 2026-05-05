import { describe, expect, it } from 'vitest';
import { parseAgentPath, cleanTarget } from '../../src/analysis/router.ts';

describe('parseAgentPath', () => {
  it('parses a user pack', () => {
    const r = parseAgentPath('/jhammant.md');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.route.kind).toBe('user');
      if (r.route.kind === 'user') expect(r.route.user).toBe('jhammant');
    }
  });

  it('parses a repo pack', () => {
    const r = parseAgentPath('/jhammant/factcheck.md');
    expect(r.ok).toBe(true);
    if (r.ok && r.route.kind === 'repo') {
      expect(r.route.user).toBe('jhammant');
      expect(r.route.repo).toBe('factcheck');
    }
  });

  it('parses an AGENTS.md alias', () => {
    const r = parseAgentPath('/jhammant/factcheck/AGENTS.md');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.route.kind).toBe('repo-agents');
  });

  it('parses safety.md', () => {
    const r = parseAgentPath('/jhammant/factcheck/safety.md');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.route.kind).toBe('safety');
  });

  it('parses receipt.md', () => {
    const r = parseAgentPath('/jhammant/factcheck/receipt.md');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.route.kind).toBe('receipt');
  });

  it('parses vs page', () => {
    const r = parseAgentPath('/vs/jhammant/sindresorhus.md');
    expect(r.ok).toBe(true);
    if (r.ok && r.route.kind === 'vs') {
      expect(r.route.a).toBe('jhammant');
      expect(r.route.b).toBe('sindresorhus');
    }
  });

  it('extracts task query parameter', () => {
    const r = parseAgentPath('/jhammant/factcheck.md', '?task=add-tests');
    expect(r.ok).toBe(true);
    if (r.ok && r.route.kind === 'repo') expect(r.route.task).toBe('add-tests');
  });

  it('extracts sha for drift', () => {
    const r = parseAgentPath('/jhammant/factcheck/drift', '?sha=abc123');
    expect(r.ok).toBe(true);
    if (r.ok && r.route.kind === 'drift') expect(r.route.sha).toBe('abc123');
  });

  it('rejects empty path', () => {
    const r = parseAgentPath('/');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('empty');
  });

  it('rejects unparseable path', () => {
    const r = parseAgentPath('/some/random/junk');
    expect(r.ok).toBe(false);
  });

  it('repo match wins over user match for two-segment paths ending in .md', () => {
    const r = parseAgentPath('/foo/bar.md');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.route.kind).toBe('repo');
  });
});

describe('cleanTarget', () => {
  it('strips github.com prefixes', () => {
    expect(cleanTarget('https://github.com/jhammant/factcheck')).toBe('jhammant/factcheck');
    expect(cleanTarget('github.com/jhammant')).toBe('jhammant');
    expect(cleanTarget('@jhammant')).toBe('jhammant');
  });

  it('drops trailing slashes and querystrings', () => {
    expect(cleanTarget('jhammant/factcheck?utm=x')).toBe('jhammant/factcheck');
    expect(cleanTarget('/jhammant/')).toBe('jhammant');
  });
});

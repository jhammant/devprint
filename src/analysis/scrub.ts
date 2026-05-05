// Token / PII scrubber. Patterns flagged here are NEVER reproduced verbatim
// in any pack body — only their type and count.

export type ScrubKind = 'readme' | 'config' | 'description' | 'commit';

export type Redaction = {
  type: string;
  line?: number;
};

export type ScrubResult = {
  text: string;
  redactions: Redaction[];
};

type Pattern = { type: string; re: RegExp };

const PATTERNS: readonly Pattern[] = [
  { type: 'github-pat', re: /\b(ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g },
  { type: 'aws-access-key', re: /\b(AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b/g },
  { type: 'stripe-key', re: /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{24,}\b/g },
  { type: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'twilio-sid', re: /\bAC[a-f0-9]{32}\b/g },
  { type: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { type: 'pem-private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  // Suspicious env-style assignments with long opaque values.
  { type: 'env-shaped-secret', re: /\b([A-Z][A-Z0-9_]{2,}_(?:KEY|SECRET|TOKEN|PASSWORD|PASS))\s*=\s*['"]?([A-Za-z0-9+/_=-]{20,})/g },
];

export function scrub(text: string, _kind: ScrubKind = 'readme'): ScrubResult {
  if (!text) return { text: '', redactions: [] };
  const redactions: Redaction[] = [];
  let out = text;
  for (const { type, re } of PATTERNS) {
    out = out.replace(re, () => {
      redactions.push({ type });
      return `<redacted: ${type}>`;
    });
  }
  return { text: out, redactions };
}

export function summariseRedactions(redactions: readonly Redaction[]): string {
  if (redactions.length === 0) return '';
  const counts = new Map<string, number>();
  for (const r of redactions) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n}× ${t}`);
  return parts.join(', ');
}

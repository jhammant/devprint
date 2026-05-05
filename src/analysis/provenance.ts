import type { Provenance } from './types.ts';

export type BuildProvenanceInput = {
  body: string;          // markdown body WITHOUT the provenance footer
  sourceSha?: string;
  toolVersion: string;
  generatedAt?: string;  // override for tests
  hashFn?: (s: string) => Promise<string>;
};

export async function buildProvenance(
  input: BuildProvenanceInput,
): Promise<Provenance> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const contentHash = await (input.hashFn ?? sha256Hex)(input.body.trim());
  return {
    generatedAt,
    contentHash,
    sourceSha: input.sourceSha,
    toolVersion: input.toolVersion,
  };
}

export function provenanceFooter(p: Provenance): string {
  return [
    '',
    '---',
    '',
    '> _Devprint pack provenance_',
    `> generated_at: ${p.generatedAt}`,
    `> content_hash: sha256:${p.contentHash}`,
    p.sourceSha ? `> source_sha: ${p.sourceSha}` : null,
    `> tool_version: ${p.toolVersion}`,
    '',
  ].filter((l): l is string => l !== null).join('\n');
}

export function provenanceHeaders(p: Provenance): Record<string, string> {
  const h: Record<string, string> = {
    'X-Devprint-Generated-At': p.generatedAt,
    'X-Devprint-Hash': `sha256:${p.contentHash}`,
    'X-Devprint-Tool-Version': p.toolVersion,
  };
  if (p.sourceSha) h['X-Devprint-Sha'] = p.sourceSha;
  return h;
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

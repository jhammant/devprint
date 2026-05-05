import type { Claim, Confidence, Evidence } from './types.ts';

export function claim<T>(
  value: T,
  confidence: Confidence,
  evidence: Evidence[],
): Claim<T> {
  return { value, confidence, evidence };
}

export function highClaim<T>(value: T, evidence: Evidence[]): Claim<T> {
  return claim(value, 'high', evidence);
}

export function mediumClaim<T>(value: T, evidence: Evidence[]): Claim<T> {
  return claim(value, 'medium', evidence);
}

export function lowClaim<T>(value: T, evidence: Evidence[]): Claim<T> {
  return claim(value, 'low', evidence);
}

const CONFIDENCE_PERCENT: Record<Confidence, number> = {
  high: 90,
  medium: 70,
  low: 45,
};

export function confidencePercent(c: Confidence): number {
  return CONFIDENCE_PERCENT[c];
}

export function formatClaim<T>(c: Claim<T>): string {
  const ev = c.evidence.map((e) => e.ref).join(', ');
  return `${c.value} (${confidencePercent(c.confidence)}%${ev ? `, evidence: ${ev}` : ''})`;
}

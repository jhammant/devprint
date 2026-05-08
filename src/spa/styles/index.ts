// Style registry — maps `?style=<id>` to a renderer. The default renderer is
// `null` because the existing SPA flow handles it; the rest are alternate
// takeover renderers that replace the result section's HTML.

import { holofoil } from './holofoil.ts';
import { letterhead } from './letterhead.ts';
import { newspaper } from './newspaper.ts';
import { tradingCard } from './trading-card.ts';
import type { StyleId, StyleRenderer } from './types.ts';

export const STYLES: Record<Exclude<StyleId, 'default'>, StyleRenderer> = {
  'trading-card': tradingCard,
  letterhead,
  holofoil,
  newspaper,
};

export const STYLE_LIST: ReadonlyArray<{ id: StyleId; name: string; blurb: string }> = [
  { id: 'default', name: 'Default', blurb: 'The full Devprint dashboard' },
  ...Object.values(STYLES).map((s) => ({ id: s.id, name: s.name, blurb: s.blurb })),
];

export function getStyle(id: string | null | undefined): StyleRenderer | null {
  if (!id || id === 'default') return null;
  return (STYLES as Record<string, StyleRenderer | undefined>)[id] ?? null;
}

export type { ProfileData, StyleId, StyleRenderer } from './types.ts';

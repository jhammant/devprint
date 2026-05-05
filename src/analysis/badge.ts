// SVG badge — drop-in for README files.
// Style: borrows the shields.io flat-square aesthetic. Two-pane: left = label
// "devprint", right = archetype tier and short summary.

import type { GhClient } from './github.ts';
import { archetype, battleStats, getThemes, scoreRepo } from './infer.ts';

export type BadgeOptions = {
  client: GhClient;
  owner: string;
  repo: string;
};

export type BadgeData = {
  label: string;
  message: string;
  tier: string;
};

export async function buildBadgeData(
  client: GhClient,
  owner: string,
  repoName: string,
): Promise<BadgeData> {
  const [profile, repo] = await Promise.all([
    client.getUser(owner),
    client.getRepo(owner, repoName),
  ]);
  const repos = [repo];
  const langs: Record<string, number> = repo.language ? { [repo.language]: 1 } : {};
  const themes = getThemes(repos);
  const battle = battleStats(profile, repos, langs, repo.stargazers_count, themes, repo);
  const arch = archetype(langs, repos);
  return {
    label: 'devprint',
    message: `${arch} · ${battle.tier}`,
    tier: battle.tier,
  };
}

export async function buildUserBadgeData(
  client: GhClient,
  owner: string,
): Promise<BadgeData> {
  const profile = await client.getUser(owner);
  const reposRaw = await client.listUserRepos(owner, { max: 100 });
  const repos = reposRaw.filter((r) => !r.fork).sort((a, b) => scoreRepo(b) - scoreRepo(a));
  const langs: Record<string, number> = {};
  for (const r of repos) if (r.language) langs[r.language] = (langs[r.language] ?? 0) + 1;
  const themes = getThemes(repos);
  const totalStars = repos.reduce((n, r) => n + r.stargazers_count, 0);
  const battle = battleStats(profile, repos, langs, totalStars, themes);
  const arch = archetype(langs, repos);
  return {
    label: 'devprint',
    message: `${arch} · ${battle.tier}`,
    tier: battle.tier,
  };
}

const TIER_COLOR: Record<string, string> = {
  Emerging: '#7c5cff',
  Rare: '#31d9ff',
  Epic: '#ff5cc8',
  Legendary: '#ffd166',
};

// Naive monospaced char width. Good enough for a badge — for production,
// consider measuring with the real font, but this avoids a 300KB font payload.
function approxWidth(s: string, fontSize = 11): number {
  return Math.ceil(s.length * fontSize * 0.6);
}

export function renderBadgeSvg(data: BadgeData): string {
  const labelW = approxWidth(data.label) + 16;
  const messageW = approxWidth(data.message) + 16;
  const totalW = labelW + messageW;
  const right = TIER_COLOR[data.tier] ?? '#31d9ff';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${escapeXml(data.label)}: ${escapeXml(data.message)}">
<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<rect width="${totalW}" height="20" rx="3" fill="#0a0d18"/>
<rect x="${labelW}" width="${messageW}" height="20" rx="3" fill="${right}"/>
<rect width="${totalW}" height="20" rx="3" fill="url(#g)"/>
<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
  <text x="${labelW / 2}" y="14">${escapeXml(data.label)}</text>
  <text x="${labelW + messageW / 2}" y="14" fill="#0a0d18">${escapeXml(data.message)}</text>
</g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

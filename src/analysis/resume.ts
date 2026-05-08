// JSON Resume export — maps Devprint user data to the jsonresume.org schema
// (https://jsonresume.org/schema). Recruiters & ATS pipelines parse this
// natively; surfacing it for free is a big credibility multiplier.

import type { GhUser, GhRepo } from './types.ts';
import type { Insights, ProfileExtra } from './insights.ts';

/**
 * Standard JSON Resume v1.0.0 shape — partial, only the fields we populate.
 * @see https://jsonresume.org/schema
 */
export type JsonResume = {
  $schema: string;
  basics: {
    name?: string;
    label?: string;
    email?: string;
    url?: string;
    image?: string;
    summary?: string;
    location?: { region?: string };
    profiles?: Array<{ network: string; username?: string; url: string }>;
  };
  work?: Array<{
    name: string;
    position?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    url?: string;
  }>;
  education?: Array<{
    institution: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
  }>;
  publications?: Array<{
    name: string;
    publisher?: string;
    releaseDate?: string;
    url: string;
  }>;
  skills?: Array<{ name: string; level?: string; keywords?: string[] }>;
  projects?: Array<{
    name: string;
    description?: string;
    url?: string;
    startDate?: string;
    endDate?: string;
    keywords?: string[];
    highlights?: string[];
  }>;
  awards?: Array<{ title: string; date?: string; awarder?: string; summary?: string }>;
  references?: Array<{ name: string; reference: string }>;
  meta?: {
    generatedAt: string;
    generator: string;
    canonical: string;
  };
};

const SCHEMA = 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json';

export function buildJsonResume(args: {
  profile: GhUser;
  repos: readonly GhRepo[];
  insights: Insights;
  url: string;
}): JsonResume {
  const { profile, repos, insights, url } = args;
  const x: ProfileExtra | undefined = insights.profileExtra;

  // Top projects ranked by stars; trim descriptions to a reasonable length.
  const topRepos = [...repos]
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 8);

  const projects: JsonResume['projects'] = topRepos.map((r) => ({
    name: r.name,
    ...(r.description ? { description: r.description } : {}),
    url: r.html_url,
    ...(r.created_at ? { startDate: yearOnly(r.created_at) } : {}),
    ...(r.pushed_at ?? r.updated_at ? { endDate: yearOnly(r.pushed_at ?? r.updated_at) } : {}),
    ...(r.language ? { keywords: [r.language] } : {}),
    highlights: [
      `${r.stargazers_count.toLocaleString()} stars`,
      `${r.forks_count.toLocaleString()} forks`,
    ],
  }));

  // Skills: detected stack + user-supplied skills + top languages.
  const skillSet = new Map<string, { keywords: Set<string> }>();
  for (const t of insights.stack.detected.slice(0, 8)) {
    skillSet.set(t.name, { keywords: new Set([t.category]) });
  }
  for (const s of x?.skills ?? []) {
    if (!skillSet.has(s)) skillSet.set(s, { keywords: new Set() });
  }
  const skills: JsonResume['skills'] = Array.from(skillSet.entries()).map(([name, v]) => ({
    name,
    ...(v.keywords.size ? { keywords: Array.from(v.keywords) } : {}),
  }));

  const work: JsonResume['work'] = (x?.experience ?? []).map((e) => ({
    name: e.org ?? e.role,
    position: e.role,
    ...(e.from ? { startDate: e.from } : {}),
    ...(e.to ? { endDate: e.to } : {}),
    ...(e.summary ? { summary: e.summary } : {}),
    ...(e.href ? { url: e.href } : {}),
  }));

  const education: JsonResume['education'] = (x?.education ?? []).map((e) => ({
    institution: e.org,
    ...(e.degree ? { studyType: e.degree } : {}),
    ...(e.date ? { startDate: e.date } : {}),
  }));

  const publications: JsonResume['publications'] = (x?.writing ?? []).map((p) => ({
    name: p.title,
    ...(p.publisher ? { publisher: p.publisher } : {}),
    ...(p.date ? { releaseDate: p.date } : {}),
    url: p.href,
  }));

  // Talks → awards (closest match in the schema).
  const awards: JsonResume['awards'] = (x?.talks ?? []).map((t) => ({
    title: t.title,
    ...(t.venue ? { awarder: t.venue } : {}),
    ...(t.date ? { date: t.date } : {}),
  }));

  // Endorsements → references.
  const references: JsonResume['references'] = (x?.endorsements ?? []).map((e) => ({
    name: `${e.from}${e.role ? ` (${e.role})` : ''}${e.github ? ` · @${e.github}` : ''}`,
    reference: e.blurb,
  }));

  // Profiles: GitHub + user-supplied links.
  const profiles: NonNullable<JsonResume['basics']['profiles']> = [
    { network: 'GitHub', username: profile.login, url: `https://github.com/${profile.login}` },
  ];
  for (const l of x?.links ?? []) {
    profiles.push({ network: l.name, url: l.href });
  }

  return {
    $schema: SCHEMA,
    basics: {
      ...(profile.name ? { name: profile.name } : {}),
      ...(x?.tagline ? { label: x.tagline } : {}),
      ...(x?.contact ? { email: x.contact } : {}),
      url,
      image: profile.avatar_url,
      ...(x?.about ? { summary: x.about } : {}),
      profiles,
    },
    ...(work.length ? { work } : {}),
    ...(education.length ? { education } : {}),
    ...(publications.length ? { publications } : {}),
    ...(skills.length ? { skills } : {}),
    ...(projects.length ? { projects } : {}),
    ...(awards.length ? { awards } : {}),
    ...(references.length ? { references } : {}),
    meta: {
      generatedAt: insights.generatedAt,
      generator: 'devprint.dev',
      canonical: url,
    },
  };
}

function yearOnly(iso: string): string {
  return iso.slice(0, 4);
}

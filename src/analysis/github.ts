import type { GhContributor, GhRepo, GhUser, RepoFile } from './types.ts';

export type FetchImpl = typeof fetch;

export type GhClientOptions = {
  token?: string;
  fetchImpl?: FetchImpl;
  userAgent?: string;
};

export class GitHubError extends Error {
  readonly status: number;
  readonly isRateLimit: boolean;
  readonly isNotFound: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.isRateLimit = status === 403 || status === 429;
    this.isNotFound = status === 404;
  }
}

export type GhClient = {
  getUser(login: string): Promise<GhUser>;
  getRepo(owner: string, repo: string): Promise<GhRepo>;
  listUserRepos(login: string, opts?: { max?: number }): Promise<GhRepo[]>;
  getReadme(owner: string, repo: string): Promise<string | undefined>;
  getRepoFile(owner: string, repo: string, path: string): Promise<RepoFile | undefined>;
  getRepoHeadSha(owner: string, repo: string, branch?: string): Promise<string | undefined>;
  getRecentCommits(
    owner: string,
    repo: string,
    branch?: string,
    count?: number,
  ): Promise<Array<{ sha: string; message: string; author?: string; date: string }>>;
  getCommitActivity(
    owner: string,
    repo: string,
  ): Promise<Array<{ week: number; total: number }> | undefined>;
  getContributors(
    owner: string,
    repo: string,
    limit?: number,
  ): Promise<GhContributor[]>;
  /**
   * Optional: search merged PRs authored by the given user. Used to find
   * "external contributions" — work the user's done in other people's
   * repos. Optional because unauthenticated clients hit the search rate
   * limit (10/min) very fast; the Lambda's authed client has the full
   * 30/min and is the one that actually calls this.
   */
  searchMergedPRs?(
    user: string,
    limit?: number,
  ): Promise<Array<{ owner: string; repo: string; title: string; html_url: string; merged_at: string }>>;
};

const PACKAGE_FILES = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'Gemfile',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'Makefile',
];

export function packageFileCandidates(): readonly string[] {
  return PACKAGE_FILES;
}

export function createGitHubClient(opts: GhClientOptions = {}): GhClient {
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.userAgent) headers['User-Agent'] = opts.userAgent;

  async function get<T>(url: string): Promise<T> {
    const r = await f(url, { headers });
    if (!r.ok) {
      const body = await safeReadText(r);
      throw new GitHubError(
        r.status,
        r.status === 404
          ? 'GitHub target not found'
          : `GitHub API error ${r.status}${body ? `: ${body.slice(0, 120)}` : ''}`,
      );
    }
    return (await r.json()) as T;
  }

  async function getOptional<T>(url: string): Promise<T | undefined> {
    try {
      return await get<T>(url);
    } catch (e) {
      if (e instanceof GitHubError && e.isNotFound) return undefined;
      throw e;
    }
  }

  return {
    getUser: (login) => get<GhUser>(`https://api.github.com/users/${enc(login)}`),
    getRepo: (owner, repo) =>
      get<GhRepo>(`https://api.github.com/repos/${enc(owner)}/${enc(repo)}`),
    async listUserRepos(login, listOpts) {
      const max = Math.min(listOpts?.max ?? 100, 300);
      const perPage = 100;
      const out: GhRepo[] = [];
      for (let page = 1; out.length < max; page++) {
        const url = `https://api.github.com/users/${enc(login)}/repos?per_page=${perPage}&sort=updated&page=${page}`;
        const batch = await get<GhRepo[]>(url);
        out.push(...batch);
        if (batch.length < perPage) break;
      }
      return out.slice(0, max);
    },
    async getReadme(owner, repo) {
      const r = await getOptional<{ content: string; encoding: string }>(
        `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/readme`,
      );
      if (!r) return undefined;
      return r.encoding === 'base64' ? decodeBase64(r.content) : r.content;
    },
    async getRepoFile(owner, repo, path) {
      const r = await getOptional<{ content: string; encoding: string }>(
        `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/contents/${enc(path)}`,
      );
      if (!r) return undefined;
      return {
        path,
        content: r.encoding === 'base64' ? decodeBase64(r.content) : r.content,
      };
    },
    async getRepoHeadSha(owner, repo, branch) {
      const ref = branch ?? 'HEAD';
      const r = await getOptional<{ sha: string }>(
        `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/commits/${enc(ref)}`,
      );
      return r?.sha;
    },
    async getRecentCommits(owner, repo, branch, count) {
      const perPage = Math.min(Math.max(count ?? 30, 1), 100);
      type GhCommit = {
        sha: string;
        commit: {
          message: string;
          author?: { name?: string | null; date?: string | null } | null;
        };
        author?: { login?: string | null } | null;
      };
      const ref = branch ? `&sha=${enc(branch)}` : '';
      const list = await getOptional<GhCommit[]>(
        `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/commits?per_page=${perPage}${ref}`,
      );
      if (!list) return [];
      return list.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.author?.login ?? c.commit.author?.name ?? undefined,
        date: c.commit.author?.date ?? '',
      }));
    },
    async getCommitActivity(owner, repo) {
      // /stats/commit_activity returns 52 weeks of weekly counts. The endpoint
      // can return 202 while GitHub builds the cache; treat that as "no data
      // yet" and let callers fall back to the synthetic activity chart.
      const r = await f(
        `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/stats/commit_activity`,
        { headers },
      );
      if (r.status === 202) return undefined;
      if (!r.ok) {
        if (r.status === 404) return undefined;
        throw new GitHubError(r.status, `commit_activity ${r.status}`);
      }
      const json = (await r.json()) as Array<{ week: number; total: number; days?: number[] }>;
      if (!Array.isArray(json) || json.length === 0) return undefined;
      return json.map((w) => ({ week: w.week, total: w.total }));
    },
    async getContributors(owner, repo, limit) {
      const perPage = Math.min(Math.max(limit ?? 10, 1), 100);
      type GhContributorApi = {
        login?: string | null;
        avatar_url?: string | null;
        contributions?: number | null;
        type?: string;
      };
      const list = await getOptional<GhContributorApi[]>(
        `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/contributors?per_page=${perPage}&anon=false`,
      );
      if (!list) return [];
      return list
        // Skip the synthetic "[bot]" contributor entries — they're noise for a
        // "people often building with this person" panel.
        .filter((c) => c.login && c.type !== 'Bot' && !c.login.endsWith('[bot]'))
        .map((c) => ({
          login: c.login as string,
          avatar_url: c.avatar_url ?? '',
          contributions: c.contributions ?? 0,
        }));
    },
    async searchMergedPRs(user, limit) {
      // /search/issues?q=author:<u>+is:pr+is:merged returns merged PRs by
      // this user across the entire public GitHub. We use it to detect
      // "external contributions" — repos they don't own. Search has a
      // narrower rate-limit (30/min authed, 10/min unauth) and 1000-result
      // cap; we ask for `limit` items, default 30.
      const perPage = Math.min(Math.max(limit ?? 30, 1), 100);
      const q = encodeURIComponent(`author:${user} is:pr is:merged`);
      type SearchItem = {
        title?: string;
        html_url?: string;
        repository_url?: string;
        pull_request?: { merged_at?: string | null };
      };
      const out = await getOptional<{ items?: SearchItem[] }>(
        `https://api.github.com/search/issues?q=${q}&per_page=${perPage}&sort=created&order=desc`,
      );
      if (!out?.items) return [];
      return out.items
        .map((it) => {
          const m = (it.repository_url ?? '').match(/repos\/([^/]+)\/([^/]+)$/);
          if (!m || !it.html_url) return null;
          return {
            owner: m[1],
            repo: m[2],
            title: it.title ?? '',
            html_url: it.html_url,
            merged_at: it.pull_request?.merged_at ?? '',
          };
        })
        .filter((v): v is { owner: string; repo: string; title: string; html_url: string; merged_at: string } => !!v);
    },
  };
}

function enc(s: string) {
  return encodeURIComponent(s);
}

async function safeReadText(r: Response) {
  try {
    return await r.text();
  } catch {
    return '';
  }
}

function decodeBase64(b64: string): string {
  const cleaned = b64.replace(/\s+/g, '');
  const bin = atob(cleaned);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

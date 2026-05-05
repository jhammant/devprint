import type { GhRepo, GhUser, RepoFile } from './types.ts';

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

// Stack inference. Parses package manifests (package.json, pyproject.toml,
// Cargo.toml, go.mod, Gemfile, composer.json) and surfaces a normalised list of
// detected frameworks / libraries an AI agent (or human reader) cares about.
//
// Pure function: takes already-fetched RepoFile[], returns DetectedTech[]. No
// network. Callers are responsible for fetching the manifest files via
// GhClient.getRepoFile.

import type { RepoFile } from './types.ts';

export type TechCategory =
  | 'framework'
  | 'ui'
  | 'testing'
  | 'db'
  | 'ai'
  | 'cloud'
  | 'payments'
  | 'tooling'
  | 'auth'
  | 'lang'
  | 'other';

export type DetectedTech = {
  name: string;
  category: TechCategory;
  confidence: 'high' | 'medium' | 'low';
  evidence: string; // e.g. "package.json: next"
};

export type StackInference = {
  ecosystems: ReadonlyArray<'node' | 'python' | 'rust' | 'go' | 'ruby' | 'php' | 'java'>;
  detected: DetectedTech[];
};

// ---- Dictionaries ---------------------------------------------------------

type Rule = { match: RegExp | string; name: string; category: TechCategory };

// Node — match against keys in dependencies/devDependencies. Order doesn't
// matter, but more-specific matches should appear first so e.g. "@nestjs/core"
// is detected as NestJS rather than its parent Node ecosystem.
const NODE_RULES: Rule[] = [
  // frameworks
  { match: 'next', name: 'Next.js', category: 'framework' },
  { match: 'nuxt', name: 'Nuxt', category: 'framework' },
  { match: 'astro', name: 'Astro', category: 'framework' },
  { match: '@remix-run/react', name: 'Remix', category: 'framework' },
  { match: 'remix', name: 'Remix', category: 'framework' },
  { match: 'svelte', name: 'Svelte', category: 'framework' },
  { match: '@sveltejs/kit', name: 'SvelteKit', category: 'framework' },
  { match: 'vue', name: 'Vue', category: 'framework' },
  { match: '@angular/core', name: 'Angular', category: 'framework' },
  { match: 'react', name: 'React', category: 'framework' },
  { match: 'solid-js', name: 'SolidJS', category: 'framework' },
  { match: 'preact', name: 'Preact', category: 'framework' },
  { match: '@builder.io/qwik', name: 'Qwik', category: 'framework' },
  { match: 'gatsby', name: 'Gatsby', category: 'framework' },
  { match: 'vite', name: 'Vite', category: 'tooling' },
  // backend
  { match: 'express', name: 'Express', category: 'framework' },
  { match: 'fastify', name: 'Fastify', category: 'framework' },
  { match: 'hono', name: 'Hono', category: 'framework' },
  { match: 'koa', name: 'Koa', category: 'framework' },
  { match: '@nestjs/core', name: 'NestJS', category: 'framework' },
  { match: '@trpc/server', name: 'tRPC', category: 'framework' },
  { match: 'apollo-server', name: 'Apollo', category: 'framework' },
  { match: '@apollo/server', name: 'Apollo', category: 'framework' },
  // ui
  { match: 'tailwindcss', name: 'Tailwind', category: 'ui' },
  { match: '@radix-ui/react-dialog', name: 'Radix UI', category: 'ui' },
  { match: '@mui/material', name: 'Material UI', category: 'ui' },
  { match: '@chakra-ui/react', name: 'Chakra UI', category: 'ui' },
  { match: 'styled-components', name: 'styled-components', category: 'ui' },
  { match: '@emotion/react', name: 'Emotion', category: 'ui' },
  { match: 'shadcn-ui', name: 'shadcn/ui', category: 'ui' },
  { match: 'lucide-react', name: 'Lucide', category: 'ui' },
  { match: 'framer-motion', name: 'Framer Motion', category: 'ui' },
  // testing
  { match: 'vitest', name: 'Vitest', category: 'testing' },
  { match: 'jest', name: 'Jest', category: 'testing' },
  { match: '@playwright/test', name: 'Playwright', category: 'testing' },
  { match: 'cypress', name: 'Cypress', category: 'testing' },
  { match: '@testing-library/react', name: 'React Testing Library', category: 'testing' },
  { match: 'mocha', name: 'Mocha', category: 'testing' },
  // db / orm
  { match: 'prisma', name: 'Prisma', category: 'db' },
  { match: '@prisma/client', name: 'Prisma', category: 'db' },
  { match: 'drizzle-orm', name: 'Drizzle ORM', category: 'db' },
  { match: 'sequelize', name: 'Sequelize', category: 'db' },
  { match: 'typeorm', name: 'TypeORM', category: 'db' },
  { match: 'mongoose', name: 'Mongoose', category: 'db' },
  { match: '@supabase/supabase-js', name: 'Supabase', category: 'db' },
  { match: 'firebase', name: 'Firebase', category: 'cloud' },
  { match: 'redis', name: 'Redis', category: 'db' },
  { match: 'pg', name: 'Postgres', category: 'db' },
  // ai
  { match: '@anthropic-ai/sdk', name: 'Anthropic SDK', category: 'ai' },
  { match: 'openai', name: 'OpenAI SDK', category: 'ai' },
  { match: 'langchain', name: 'LangChain', category: 'ai' },
  { match: '@langchain/core', name: 'LangChain', category: 'ai' },
  { match: 'llamaindex', name: 'LlamaIndex', category: 'ai' },
  { match: 'ai', name: 'Vercel AI SDK', category: 'ai' },
  { match: '@ai-sdk/openai', name: 'Vercel AI SDK', category: 'ai' },
  { match: '@google/generative-ai', name: 'Google Generative AI', category: 'ai' },
  // payments
  { match: 'stripe', name: 'Stripe', category: 'payments' },
  { match: '@stripe/stripe-js', name: 'Stripe', category: 'payments' },
  { match: '@paypal/checkout-server-sdk', name: 'PayPal', category: 'payments' },
  // cloud / infra
  { match: 'sst', name: 'SST', category: 'cloud' },
  { match: 'aws-sdk', name: 'AWS SDK v2', category: 'cloud' },
  { match: '@aws-sdk/client-s3', name: 'AWS SDK v3', category: 'cloud' },
  { match: 'wrangler', name: 'Cloudflare Workers', category: 'cloud' },
  { match: 'serverless', name: 'Serverless Framework', category: 'cloud' },
  { match: 'pulumi', name: 'Pulumi', category: 'cloud' },
  // auth
  { match: 'next-auth', name: 'NextAuth', category: 'auth' },
  { match: '@auth/core', name: 'Auth.js', category: 'auth' },
  { match: 'clerk', name: 'Clerk', category: 'auth' },
  { match: '@clerk/nextjs', name: 'Clerk', category: 'auth' },
  // lang/build
  { match: 'typescript', name: 'TypeScript', category: 'lang' },
  { match: 'eslint', name: 'ESLint', category: 'tooling' },
  { match: 'prettier', name: 'Prettier', category: 'tooling' },
  { match: 'turbo', name: 'Turborepo', category: 'tooling' },
];

const PYTHON_RULES: Rule[] = [
  { match: /^django(\b|$)/i, name: 'Django', category: 'framework' },
  { match: /^flask(\b|$)/i, name: 'Flask', category: 'framework' },
  { match: /^fastapi(\b|$)/i, name: 'FastAPI', category: 'framework' },
  { match: /^starlette(\b|$)/i, name: 'Starlette', category: 'framework' },
  { match: /^tornado(\b|$)/i, name: 'Tornado', category: 'framework' },
  { match: /^streamlit(\b|$)/i, name: 'Streamlit', category: 'framework' },
  { match: /^gradio(\b|$)/i, name: 'Gradio', category: 'framework' },
  { match: /^anthropic(\b|$)/i, name: 'Anthropic SDK', category: 'ai' },
  { match: /^openai(\b|$)/i, name: 'OpenAI SDK', category: 'ai' },
  { match: /^langchain(\b|$)/i, name: 'LangChain', category: 'ai' },
  { match: /^llama-index(\b|$)/i, name: 'LlamaIndex', category: 'ai' },
  { match: /^transformers(\b|$)/i, name: 'Transformers', category: 'ai' },
  { match: /^torch(\b|$)/i, name: 'PyTorch', category: 'ai' },
  { match: /^tensorflow(\b|$)/i, name: 'TensorFlow', category: 'ai' },
  { match: /^scikit-learn(\b|$)/i, name: 'scikit-learn', category: 'ai' },
  { match: /^pandas(\b|$)/i, name: 'pandas', category: 'ai' },
  { match: /^numpy(\b|$)/i, name: 'NumPy', category: 'ai' },
  { match: /^jax(\b|$)/i, name: 'JAX', category: 'ai' },
  { match: /^pytest(\b|$)/i, name: 'pytest', category: 'testing' },
  { match: /^scrapy(\b|$)/i, name: 'Scrapy', category: 'tooling' },
  { match: /^beautifulsoup4(\b|$)/i, name: 'BeautifulSoup', category: 'tooling' },
  { match: /^httpx(\b|$)/i, name: 'httpx', category: 'tooling' },
  { match: /^requests(\b|$)/i, name: 'requests', category: 'tooling' },
  { match: /^sqlalchemy(\b|$)/i, name: 'SQLAlchemy', category: 'db' },
  { match: /^psycopg/i, name: 'Postgres', category: 'db' },
  { match: /^stripe(\b|$)/i, name: 'Stripe', category: 'payments' },
  { match: /^boto3(\b|$)/i, name: 'AWS (boto3)', category: 'cloud' },
];

const RUST_RULES: Rule[] = [
  { match: /^actix-web(\b|$)/i, name: 'Actix Web', category: 'framework' },
  { match: /^axum(\b|$)/i, name: 'Axum', category: 'framework' },
  { match: /^rocket(\b|$)/i, name: 'Rocket', category: 'framework' },
  { match: /^warp(\b|$)/i, name: 'Warp', category: 'framework' },
  { match: /^tower(\b|$)/i, name: 'Tower', category: 'framework' },
  { match: /^tokio(\b|$)/i, name: 'Tokio', category: 'tooling' },
  { match: /^async-std(\b|$)/i, name: 'async-std', category: 'tooling' },
  { match: /^clap(\b|$)/i, name: 'clap', category: 'tooling' },
  { match: /^sqlx(\b|$)/i, name: 'sqlx', category: 'db' },
  { match: /^diesel(\b|$)/i, name: 'Diesel', category: 'db' },
  { match: /^candle/i, name: 'Candle', category: 'ai' },
  { match: /^serde(\b|$)/i, name: 'serde', category: 'tooling' },
];

const GO_RULES: Rule[] = [
  { match: 'github.com/gin-gonic/gin', name: 'Gin', category: 'framework' },
  { match: 'github.com/labstack/echo', name: 'Echo', category: 'framework' },
  { match: 'github.com/gofiber/fiber', name: 'Fiber', category: 'framework' },
  { match: 'github.com/go-chi/chi', name: 'chi', category: 'framework' },
  { match: 'github.com/aws/aws-sdk-go', name: 'AWS SDK (go)', category: 'cloud' },
  { match: 'cloud.google.com/go', name: 'Google Cloud (go)', category: 'cloud' },
  { match: 'gorm.io/gorm', name: 'GORM', category: 'db' },
  { match: 'github.com/jackc/pgx', name: 'pgx', category: 'db' },
];

const RUBY_RULES: Rule[] = [
  { match: /^rails(\b|$)/i, name: 'Rails', category: 'framework' },
  { match: /^sinatra(\b|$)/i, name: 'Sinatra', category: 'framework' },
  { match: /^hanami(\b|$)/i, name: 'Hanami', category: 'framework' },
  { match: /^rspec(\b|$)/i, name: 'RSpec', category: 'testing' },
  { match: /^minitest(\b|$)/i, name: 'Minitest', category: 'testing' },
  { match: /^sidekiq(\b|$)/i, name: 'Sidekiq', category: 'tooling' },
];

const PHP_RULES: Rule[] = [
  { match: /^laravel\/framework(\b|$)/i, name: 'Laravel', category: 'framework' },
  { match: /^symfony\//i, name: 'Symfony', category: 'framework' },
  { match: /^phpunit\//i, name: 'PHPUnit', category: 'testing' },
];

// ---- Public API -----------------------------------------------------------

export function detectStack(files: readonly RepoFile[]): StackInference {
  const detected: DetectedTech[] = [];
  const ecosystems = new Set<StackInference['ecosystems'][number]>();

  for (const f of files) {
    if (f.path === 'package.json') {
      ecosystems.add('node');
      detected.push(...parseNode(f.content));
    } else if (f.path === 'pyproject.toml') {
      ecosystems.add('python');
      detected.push(...parsePyProject(f.content));
    } else if (f.path === 'requirements.txt') {
      ecosystems.add('python');
      detected.push(...parseRequirementsTxt(f.content));
    } else if (f.path === 'Cargo.toml') {
      ecosystems.add('rust');
      detected.push(...parseCargo(f.content));
    } else if (f.path === 'go.mod') {
      ecosystems.add('go');
      detected.push(...parseGoMod(f.content));
    } else if (f.path === 'Gemfile') {
      ecosystems.add('ruby');
      detected.push(...parseGemfile(f.content));
    } else if (f.path === 'composer.json') {
      ecosystems.add('php');
      detected.push(...parseComposer(f.content));
    } else if (f.path === 'pom.xml' || f.path === 'build.gradle') {
      ecosystems.add('java');
    }
  }

  return { ecosystems: Array.from(ecosystems), detected: dedupe(detected) };
}

// Merge detected tech across multiple repos (used for user packs). Keeps the
// highest confidence and accumulates evidence references.
export function mergeStacks(stacks: readonly StackInference[]): StackInference {
  const ecoSet = new Set<StackInference['ecosystems'][number]>();
  const byName = new Map<string, DetectedTech>();
  for (const s of stacks) {
    for (const e of s.ecosystems) ecoSet.add(e);
    for (const t of s.detected) {
      const existing = byName.get(t.name);
      if (!existing) {
        byName.set(t.name, { ...t });
      } else {
        existing.confidence = strongerConfidence(existing.confidence, t.confidence);
        if (!existing.evidence.includes(t.evidence)) {
          existing.evidence = `${existing.evidence}, ${t.evidence}`;
        }
      }
    }
  }
  return { ecosystems: Array.from(ecoSet), detected: Array.from(byName.values()) };
}

export function summariseStack(stack: StackInference, max = 8): string {
  if (stack.detected.length === 0) return '';
  const ranked = rankDetected(stack.detected).slice(0, max);
  return ranked.map((t) => t.name).join(' · ');
}

export function rankDetected(detected: readonly DetectedTech[]): DetectedTech[] {
  const order: TechCategory[] = ['framework', 'ai', 'ui', 'db', 'auth', 'payments', 'cloud', 'testing', 'tooling', 'lang', 'other'];
  const conf = { high: 0, medium: 1, low: 2 };
  return [...detected].sort((a, b) => {
    const oa = order.indexOf(a.category);
    const ob = order.indexOf(b.category);
    if (oa !== ob) return oa - ob;
    return conf[a.confidence] - conf[b.confidence];
  });
}

// ---- Parsers --------------------------------------------------------------

function parseNode(content: string): DetectedTech[] {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(content);
  } catch {
    return [];
  }
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
  const out: DetectedTech[] = [];
  for (const dep of Object.keys(deps)) {
    for (const rule of NODE_RULES) {
      if (matches(rule.match, dep)) {
        out.push({
          name: rule.name,
          category: rule.category,
          confidence: 'high',
          evidence: `package.json: ${dep}`,
        });
      }
    }
  }
  return out;
}

function parsePyProject(content: string): DetectedTech[] {
  // Naive TOML scan for dependency lists. Avoid pulling a full TOML parser —
  // we only need package names from `dependencies = ["…"]` and
  // `[tool.poetry.dependencies]` blocks.
  const out: DetectedTech[] = [];

  // Project deps under [project]
  const projectDepsMatch = content.match(/dependencies\s*=\s*\[([^\]]*)\]/s);
  if (projectDepsMatch) {
    const items = projectDepsMatch[1]
      .split(/[,\n]/)
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    for (const item of items) {
      const name = item.split(/[\s<>=!~;]/)[0];
      if (name) pushPython(out, name, 'pyproject.toml');
    }
  }

  // Poetry-style [tool.poetry.dependencies]
  const poetrySection = content.match(/\[tool\.poetry\.dependencies\]([^\[]*)/s);
  if (poetrySection) {
    const lines = poetrySection[1].split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([a-zA-Z0-9_\-.]+)\s*=/);
      if (m && m[1] !== 'python') pushPython(out, m[1], 'pyproject.toml');
    }
  }
  return out;
}

function parseRequirementsTxt(content: string): DetectedTech[] {
  const out: DetectedTech[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const name = line.split(/[\s<>=!~;\[]/)[0];
    if (!name) continue;
    pushPython(out, name, 'requirements.txt');
  }
  return out;
}

function pushPython(out: DetectedTech[], name: string, file: string) {
  for (const rule of PYTHON_RULES) {
    if (matches(rule.match, name)) {
      out.push({
        name: rule.name,
        category: rule.category,
        confidence: 'high',
        evidence: `${file}: ${name}`,
      });
    }
  }
}

function parseCargo(content: string): DetectedTech[] {
  const out: DetectedTech[] = [];
  // Walk line-by-line. A section header is a line that *starts* with `[…]`.
  // Inline arrays inside dependency lines (e.g. `features = ["full"]`) must
  // not terminate the section — that was the bug an earlier regex hit.
  const sectionNames = new Set(['dependencies', 'dev-dependencies', 'build-dependencies']);
  let inDeps = false;
  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.trim();
    const headerMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (headerMatch) {
      inDeps = sectionNames.has(headerMatch[1]);
      continue;
    }
    if (!inDeps) continue;
    const km = raw.match(/^([a-zA-Z0-9_\-]+)\s*=/);
    if (!km) continue;
    const name = km[1];
    for (const rule of RUST_RULES) {
      if (matches(rule.match, name)) {
        out.push({
          name: rule.name,
          category: rule.category,
          confidence: 'high',
          evidence: `Cargo.toml: ${name}`,
        });
      }
    }
  }
  return out;
}

function parseGoMod(content: string): DetectedTech[] {
  const out: DetectedTech[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim().replace(/^require\s+/, '');
    if (!line || line.startsWith('//') || line.startsWith('module ') || line.startsWith('go ')) continue;
    const cleaned = line.replace(/^\(|\)$/, '').trim();
    const parts = cleaned.split(/\s+/);
    const path = parts[0];
    if (!path || !path.includes('.')) continue;
    for (const rule of GO_RULES) {
      if (matches(rule.match, path)) {
        out.push({
          name: rule.name,
          category: rule.category,
          confidence: 'high',
          evidence: `go.mod: ${path}`,
        });
      }
    }
  }
  return out;
}

function parseGemfile(content: string): DetectedTech[] {
  const out: DetectedTech[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const m = raw.match(/^\s*gem\s+["']([^"']+)["']/);
    if (!m) continue;
    const name = m[1];
    for (const rule of RUBY_RULES) {
      if (matches(rule.match, name)) {
        out.push({
          name: rule.name,
          category: rule.category,
          confidence: 'high',
          evidence: `Gemfile: ${name}`,
        });
      }
    }
  }
  return out;
}

function parseComposer(content: string): DetectedTech[] {
  let json: { require?: Record<string, string>; 'require-dev'?: Record<string, string> };
  try {
    json = JSON.parse(content);
  } catch {
    return [];
  }
  const deps = { ...(json.require ?? {}), ...(json['require-dev'] ?? {}) };
  const out: DetectedTech[] = [];
  for (const dep of Object.keys(deps)) {
    for (const rule of PHP_RULES) {
      if (matches(rule.match, dep)) {
        out.push({
          name: rule.name,
          category: rule.category,
          confidence: 'high',
          evidence: `composer.json: ${dep}`,
        });
      }
    }
  }
  return out;
}

// ---- helpers --------------------------------------------------------------

function matches(rule: RegExp | string, value: string): boolean {
  return typeof rule === 'string' ? rule === value : rule.test(value);
}

function dedupe(items: DetectedTech[]): DetectedTech[] {
  const byName = new Map<string, DetectedTech>();
  for (const t of items) {
    const existing = byName.get(t.name);
    if (!existing) {
      byName.set(t.name, t);
    } else if (!existing.evidence.includes(t.evidence)) {
      existing.evidence = `${existing.evidence}, ${t.evidence}`;
    }
  }
  return Array.from(byName.values());
}

function strongerConfidence(
  a: DetectedTech['confidence'],
  b: DetectedTech['confidence'],
): DetectedTech['confidence'] {
  const order = { high: 3, medium: 2, low: 1 } as const;
  return order[a] >= order[b] ? a : b;
}

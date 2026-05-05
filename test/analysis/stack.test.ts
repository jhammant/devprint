import { describe, expect, it } from 'vitest';
import { detectStack, mergeStacks, rankDetected, summariseStack } from '../../src/analysis/stack.ts';
import type { RepoFile } from '../../src/analysis/types.ts';

const file = (path: string, content: string): RepoFile => ({ path, content });

describe('detectStack — node', () => {
  it('detects Next.js + Tailwind + Stripe + Anthropic SDK + Vitest from package.json', () => {
    const pkg = JSON.stringify({
      dependencies: {
        next: '14.0.0',
        react: '18.0.0',
        '@stripe/stripe-js': '^2.0.0',
        '@anthropic-ai/sdk': '^0.20.0',
      },
      devDependencies: {
        tailwindcss: '^3.4.0',
        vitest: '^1.0.0',
        typescript: '^5.0.0',
      },
    });
    const stack = detectStack([file('package.json', pkg)]);
    const names = stack.detected.map((d) => d.name);
    expect(names).toContain('Next.js');
    expect(names).toContain('React');
    expect(names).toContain('Tailwind');
    expect(names).toContain('Stripe');
    expect(names).toContain('Anthropic SDK');
    expect(names).toContain('Vitest');
    expect(names).toContain('TypeScript');
    expect(stack.ecosystems).toContain('node');
  });

  it('survives malformed package.json', () => {
    const stack = detectStack([file('package.json', '{not json')]);
    expect(stack.detected).toEqual([]);
  });
});

describe('detectStack — python', () => {
  it('detects Django + pytest + openai from requirements.txt', () => {
    const stack = detectStack([
      file('requirements.txt', 'django==5.0\npytest>=8\nopenai\n# comment\n'),
    ]);
    const names = stack.detected.map((d) => d.name);
    expect(names).toContain('Django');
    expect(names).toContain('pytest');
    expect(names).toContain('OpenAI SDK');
    expect(stack.ecosystems).toContain('python');
  });

  it('detects FastAPI + transformers from pyproject.toml [project] block', () => {
    const py = `
[project]
name = "demo"
dependencies = [
  "fastapi>=0.100",
  "transformers",
  "torch~=2.0"
]
`;
    const stack = detectStack([file('pyproject.toml', py)]);
    const names = stack.detected.map((d) => d.name);
    expect(names).toContain('FastAPI');
    expect(names).toContain('Transformers');
    expect(names).toContain('PyTorch');
  });
});

describe('detectStack — rust', () => {
  it('detects Axum + Tokio from Cargo.toml', () => {
    const cargo = `
[package]
name = "demo"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
serde = "1"
`;
    const stack = detectStack([file('Cargo.toml', cargo)]);
    const names = stack.detected.map((d) => d.name);
    expect(names).toContain('Axum');
    expect(names).toContain('Tokio');
    expect(names).toContain('serde');
  });
});

describe('detectStack — go', () => {
  it('detects Gin from go.mod', () => {
    const goMod = `module example.com/demo

go 1.21

require (
  github.com/gin-gonic/gin v1.9.0
  gorm.io/gorm v1.25.0
)
`;
    const stack = detectStack([file('go.mod', goMod)]);
    const names = stack.detected.map((d) => d.name);
    expect(names).toContain('Gin');
    expect(names).toContain('GORM');
  });
});

describe('mergeStacks', () => {
  it('aggregates detected tech across multiple repos', () => {
    const a = detectStack([file('package.json', JSON.stringify({ dependencies: { next: '14' } }))]);
    const b = detectStack([file('package.json', JSON.stringify({ dependencies: { next: '15', tailwindcss: '3' } }))]);
    const merged = mergeStacks([a, b]);
    const names = merged.detected.map((d) => d.name);
    expect(names).toContain('Next.js');
    expect(names).toContain('Tailwind');
    // Next.js evidence should mention both repos
    const nextItem = merged.detected.find((d) => d.name === 'Next.js')!;
    expect(nextItem.evidence.split(',').length).toBeGreaterThanOrEqual(1);
  });
});

describe('summariseStack + rankDetected', () => {
  it('puts frameworks before tooling', () => {
    const stack = detectStack([
      file('package.json', JSON.stringify({ dependencies: { next: '14', vitest: '1', typescript: '5' } })),
    ]);
    const ranked = rankDetected(stack.detected);
    expect(ranked[0].name).toBe('Next.js'); // framework
    const summary = summariseStack(stack);
    expect(summary.startsWith('Next.js')).toBe(true);
  });
});

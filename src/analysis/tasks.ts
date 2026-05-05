// ?task= modifiers — small overlays that re-shape an existing pack for a
// specific agent task.

import type { Pack } from './types.ts';

export type TaskName = 'add-tests' | 'review' | 'fix-bug' | 'ship-mvp' | 'docs' | 'refactor';

const KNOWN_TASKS = new Set<TaskName>([
  'add-tests', 'review', 'fix-bug', 'ship-mvp', 'docs', 'refactor',
]);

export function isKnownTask(s: string): s is TaskName {
  return KNOWN_TASKS.has(s as TaskName);
}

export function applyTaskOverlay(pack: Pack, task: TaskName): Pack {
  const overlay = renderOverlay(task, pack.target);
  // Insert overlay BEFORE the provenance footer so the hash still matches the
  // body. We do that by reading the existing markdown, finding the footer
  // delimiter, and splicing.
  const footerIdx = pack.markdown.indexOf('\n---\n\n> _Devprint pack provenance_');
  if (footerIdx < 0) {
    return { ...pack, markdown: pack.markdown + '\n' + overlay };
  }
  const body = pack.markdown.slice(0, footerIdx);
  const footer = pack.markdown.slice(footerIdx);
  return { ...pack, markdown: `${body}\n${overlay}${footer}` };
}

function renderOverlay(task: TaskName, target: string): string {
  switch (task) {
    case 'add-tests':
      return [
        '## Task overlay: add-tests',
        `- **Goal:** raise meaningful test coverage on \`${target}\` without changing behaviour.`,
        '- **First files:** existing test directories or files with `test`/`spec` in their name; the most-edited source modules.',
        '- **Likely command:** the smallest test command surfaced above; run it once before adding tests, fix it if broken.',
        '- **Success:** new tests pass; existing tests still pass; coverage on touched files goes up.',
        '- **Starter prompt:** "Add tests for the highest-traffic untested module. Prefer integration over unit. Match the existing test style."',
        '',
      ].join('\n');
    case 'review':
      return [
        '## Task overlay: review',
        `- **Goal:** review recent changes to \`${target}\` like a thoughtful peer.`,
        '- **First files:** recently-changed files; anything that changes public API; tests for those files.',
        '- **Likely command:** lint + test + typecheck (whatever this stack uses).',
        '- **Success:** a written review covering correctness, security, and style; surfacing 1–3 concrete improvements.',
        '- **Starter prompt:** "Review the most recent changeset. Flag bugs, suspect patterns, missing tests, and style mismatches. Be specific."',
        '',
      ].join('\n');
    case 'fix-bug':
      return [
        '## Task overlay: fix-bug',
        `- **Goal:** reproduce, isolate, and fix a single bug in \`${target}\`.`,
        '- **First files:** the test for the bug if it exists; otherwise the most-relevant module.',
        '- **Likely command:** a focused test command targeting the failing case before any change.',
        '- **Success:** failing test reproduces the bug, then passes after the fix; no other tests regress.',
        '- **Starter prompt:** "Reproduce the bug with a failing test, then make it pass with the smallest possible change. Explain the root cause."',
        '',
      ].join('\n');
    case 'ship-mvp':
      return [
        '## Task overlay: ship-mvp',
        `- **Goal:** take \`${target}\` from skeleton to a working first version.`,
        '- **First files:** README + entry-point + the simplest happy-path code path.',
        '- **Likely command:** start dev server / run the simplest possible end-to-end gate.',
        '- **Success:** one user-visible scenario works end-to-end; a single deployable artefact exists.',
        '- **Starter prompt:** "Identify the smallest end-to-end scenario that delivers value. Implement just that. Stop when it works."',
        '',
      ].join('\n');
    case 'docs':
      return [
        '## Task overlay: docs',
        `- **Goal:** make \`${target}\` understandable to a stranger in under 10 minutes.`,
        '- **First files:** README, top-level docs/, package metadata.',
        '- **Likely command:** none for the doc itself; whatever runs the project to verify the doc is accurate.',
        '- **Success:** a stranger can clone, install, run, and explain the project from the README alone.',
        '- **Starter prompt:** "Rewrite README so a new contributor can be productive in 10 minutes. Verify every command before keeping it."',
        '',
      ].join('\n');
    case 'refactor':
      return [
        '## Task overlay: refactor',
        `- **Goal:** improve internal structure of \`${target}\` without changing behaviour.`,
        '- **First files:** the messiest module; modules with duplicated patterns; tests covering those.',
        '- **Likely command:** the existing test gate before, during, and after.',
        '- **Success:** tests still pass; diff is small and reversible; no public API changed.',
        '- **Starter prompt:** "Pick one piece of duplication or one too-long function. Refactor with green tests at every step. Stop after one improvement."',
        '',
      ].join('\n');
  }
}

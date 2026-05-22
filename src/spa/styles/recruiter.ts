// Recruiter view — a clean, scannable read of any GitHub user for a
// non-technical recruiter. Answers four questions up front: what they do,
// how good they are, their overall level, and whether they use AI. Built on
// hard-to-fake signals; honest about what public data can't show.

import {
  seniorityLabel,
  type CommitActivityWeek,
  type GhRepo,
} from '../../analysis/index.ts';
import {
  escapeAttr,
  escapeHtml,
  flashLabel,
  linkedinShareUrl,
  relativeDate,
  saveAsPng,
  topRepos,
  type ProfileData,
  type StyleRenderer,
} from './types.ts';

/** Top repo topics by frequency across the analysed repo set. */
function topTopics(repos: readonly GhRepo[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const r of repos) {
    for (const t of r.topics ?? []) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

/** Qualitative recent-commit cadence — never a raw number (spikes are gameable). */
function cadenceLabel(activity?: readonly CommitActivityWeek[]): string {
  if (!activity || activity.length < 8) return 'Recent cadence unavailable — GitHub is still computing it.';
  const recent = activity.slice(-4).reduce((n, w) => n + w.total, 0);
  if (recent === 0) return 'No public commits in the last month.';
  const prior = activity.slice(-16, -4);
  const priorAvg = prior.length ? prior.reduce((n, w) => n + w.total, 0) / prior.length : 0;
  if (priorAvg > 0 && recent / 4 < priorAvg * 0.5) return 'Committing, but quieter than usual.';
  return 'Actively committing.';
}

const SUBSTANCE_TONE: Record<string, string> = {
  substantial: '#1a7f37',
  mixed: '#9a6700',
  'mostly-trivial': '#b22',
  'insufficient-data': '#656d76',
};

export const recruiter: StyleRenderer = {
  id: 'recruiter',
  name: 'Recruiter view',
  blurb: 'Hard-to-fake hiring signals',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, archetype, target, langs, repos, insights, profileExtra: x } = data;
    const seniority = insights?.seniority;
    const provenanceBadges = insights?.provenanceBadges ?? [];
    const aiUsage = insights?.aiUsage;
    const commitSubstance = insights?.commitSubstance;
    const timeline = insights?.timeline;
    const externalContribs = insights?.externalContribs ?? [];
    const stack = insights?.stack;
    const langList = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topLangCount = langList[0]?.[1] ?? 1;
    const topics = topTopics(repos, 3);
    const tops = topRepos(repos, 5);

    // "What they do" — archetype + primary languages + topics.
    const doesLine = isRepo
      ? escapeHtml(repo!.description || 'a repository')
      : [
          escapeHtml(archetype),
          langList.slice(0, 3).map(([l]) => escapeHtml(l)).join(', '),
          topics.length ? topics.map((t) => escapeHtml(t)).join(', ') : '',
        ].filter(Boolean).join('  ·  ');

    const cadence = cadenceLabel(insights?.commitActivity);
    const bandLabel = seniority ? seniorityLabel(seniority.band) : '';

    return {
      html: `
<style>
body.style-recruiter{background:#eef0f3;color:#1c2128;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;padding:24px 16px;-webkit-font-smoothing:antialiased}
.rv-card{max-width:860px;margin:0 auto;background:#fff;border:1px solid #d8dde3;border-radius:14px;box-shadow:0 12px 40px rgba(20,30,50,.12);overflow:hidden}
.rv-pad{padding:32px 40px}
.rv-head{display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center}
.rv-head img{width:88px;height:88px;border-radius:12px;object-fit:cover;border:1px solid #d8dde3}
.rv-name{font-size:28px;font-weight:800;letter-spacing:-.02em;margin:0;line-height:1.1}
.rv-gh{font-size:13px;color:#57606a;margin-top:2px}
.rv-gh a{color:#1f6feb;text-decoration:none}
.rv-does{font-size:15px;font-weight:600;color:#1c2128;margin-top:8px}
.rv-tag{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#1f6feb;background:#ddeafe;padding:3px 9px;border-radius:5px;margin-bottom:10px}
.rv-section{border-top:1px solid #e6e9ee}
.rv-h{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.13em;color:#57606a;margin:0 0 14px}
.rv-level{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.rv-band{font-size:38px;font-weight:900;letter-spacing:-.03em;color:#1f3b6f;line-height:1}
.rv-band-note{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#8b949e}
.rv-basis{margin:12px 0 0;padding:0;list-style:none;font-size:14px;color:#37414d;line-height:1.6}
.rv-basis li{padding-left:18px;position:relative}
.rv-basis li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:#1f6feb}
.rv-badges{display:grid;gap:10px}
.rv-badge{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;font-size:14px}
.rv-badge .dot{width:9px;height:9px;border-radius:50%;margin-top:5px}
.rv-badge b{font-weight:700}
.rv-badge span{color:#57606a}
.rv-line{font-size:14px;line-height:1.6;color:#37414d}
.rv-line .ev{color:#57606a;font-size:13px}
.rv-verdict{display:inline-block;font-weight:800;font-size:15px}
.rv-muted{font-size:12px;color:#8b949e;margin-top:6px}
.rv-arc{margin:14px 0 0;padding:0;list-style:none;font-size:14px}
.rv-arc li{display:grid;grid-template-columns:54px 1fr;gap:14px;padding:6px 0;color:#37414d}
.rv-arc .yr{font-weight:800;color:#1f6feb;font-variant-numeric:tabular-nums}
.rv-chips{display:flex;flex-wrap:wrap;gap:6px}
.rv-chip{font-size:12px;background:#f1f3f6;border:1px solid #d8dde3;border-radius:6px;padding:4px 9px;color:#37414d}
.rv-skill{display:grid;grid-template-columns:120px 1fr 56px;gap:12px;align-items:center;font-size:13px;padding:5px 0}
.rv-skill .bar{height:7px;background:#e6e9ee;border-radius:4px;overflow:hidden}
.rv-skill .bar i{display:block;height:100%;background:#1f6feb}
.rv-skill .ct{text-align:right;color:#8b949e;font-size:12px}
.rv-repos{margin:0;padding:0;list-style:none}
.rv-repos li{padding:10px 0;border-bottom:1px solid #f0f2f5}
.rv-repos li:last-child{border-bottom:0}
.rv-repos .rn{font-weight:700;font-size:14px}
.rv-repos .rn a{color:#1f6feb;text-decoration:none}
.rv-repos .rd{font-size:13px;color:#57606a;margin-top:2px}
.rv-repos .rm{font-size:12px;color:#8b949e;margin-top:3px}
.rv-honesty{background:#f7f8fa;border-top:1px solid #e6e9ee}
.rv-honesty ul{margin:12px 0 0;padding-left:18px;font-size:13px;color:#57606a;line-height:1.7}
.rv-cta{background:#1c2128;color:#fff;padding:24px 40px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.rv-cta .grow{flex:1;min-width:180px;font-size:13px;color:#adbac7}
.rv-btn{padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;border-radius:7px;background:#2f3742;color:#fff;border:1px solid #444c56;text-decoration:none;cursor:pointer}
.rv-btn:hover{background:#3a434f}
.rv-btn.primary{background:#1f6feb;border-color:#1f6feb}
.rv-foot{padding:14px 40px;font-size:11px;color:#8b949e;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media(max-width:680px){.rv-pad{padding:24px 22px}.rv-head{grid-template-columns:auto 1fr}.rv-head img{width:64px;height:64px}.rv-name{font-size:22px}.rv-skill{grid-template-columns:90px 1fr 48px}.rv-cta,.rv-foot{padding-left:22px;padding-right:22px}}
body.style-recruiter a:focus-visible,.rv-btn:focus-visible{outline:2px solid #1f6feb;outline-offset:2px}
@media print{body.style-recruiter{background:#fff;padding:0}.rv-card{box-shadow:none;border:0}.rv-cta,#dpStylePicker{display:none!important}a{color:#000}}
</style>

<div class="rv-card">
  <div class="rv-pad">
    <header class="rv-head">
      <img src="${escapeAttr(profile.avatar_url)}" alt="" crossorigin="anonymous" />
      <div>
        <span class="rv-tag">Recruiter view</span>
        <h1 class="rv-name">${isRepo ? escapeHtml(repo!.full_name) : escapeHtml(profile.name || profile.login)}</h1>
        <div class="rv-gh">github.com/<a href="https://github.com/${escapeAttr(target)}" target="_blank" rel="noreferrer">${escapeHtml(target)}</a>${x?.available ? ` · ${escapeHtml(x.available)}` : ''}</div>
        <div class="rv-does">${doesLine}</div>
      </div>
    </header>
  </div>

  ${seniority ? `<div class="rv-pad rv-section">
    <h2 class="rv-h">Overall level</h2>
    <div class="rv-level">
      <span class="rv-band">${escapeHtml(bandLabel)}</span>
      <span class="rv-band-note">signals-based estimate</span>
    </div>
    <ul class="rv-basis">
      ${seniority.basis.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="rv-pad rv-section">
    <h2 class="rv-h">How good — verified signals (hard to fake)</h2>
    ${provenanceBadges.length ? `<div class="rv-badges">
      ${provenanceBadges.map((b) => {
        const color = b.tone === 'positive' ? '#1a7f37' : b.tone === 'milestone' ? '#1f6feb' : '#8b949e';
        return `<div class="rv-badge"><span class="dot" style="background:${color}"></span><div><b>${escapeHtml(b.label)}</b> — <span>${escapeHtml(b.detail)}</span></div></div>`;
      }).join('')}
    </div>` : `<p class="rv-line ev">No standout provenance signals from public data — common for newer or mostly-private profiles.</p>`}
  </div>

  <div class="rv-pad rv-section">
    <h2 class="rv-h">AI tooling</h2>
    ${aiUsage && aiUsage.detected ? `<p class="rv-line"><b>AI-assisted${aiUsage.tools.length ? ` — ${aiUsage.tools.map((t) => escapeHtml(t)).join(', ')}` : ''}.</b><br><span class="ev">${aiUsage.signals.map((s) => escapeHtml(s)).join(' · ')} (confidence: ${escapeHtml(aiUsage.confidence)})</span></p>` : `<p class="rv-line ev">No AI-tool signals found in public data. This is not proof AI was not used — only disclosed usage is detectable.</p>`}
  </div>

  <div class="rv-pad rv-section">
    <h2 class="rv-h">Substance, not noise</h2>
    ${commitSubstance ? `<p class="rv-line"><span class="rv-verdict" style="color:${SUBSTANCE_TONE[commitSubstance.verdict] ?? '#37414d'}">${escapeHtml(commitSubstance.summary)}</span><br><span class="ev">${commitSubstance.detail.map((d) => escapeHtml(d)).join(' ')}</span></p>` : `<p class="rv-line ev">Not enough recent commit history to assess substance.</p>`}
    <p class="rv-muted">Recent cadence: ${escapeHtml(cadence)} · Stars and raw commit counts are easy to inflate and are intentionally not shown here.</p>
    ${timeline?.milestones?.length ? `<ul class="rv-arc">
      ${timeline.milestones.map((m) => `<li><span class="yr">${m.year}</span><span>${escapeHtml(m.label)}${m.repo ? ` — <a href="${escapeAttr(m.repo.html_url)}" target="_blank" rel="noreferrer" style="color:#1f6feb;text-decoration:none">${escapeHtml(m.repo.name)}</a>` : ''}</span></li>`).join('')}
    </ul>` : ''}
    ${externalContribs.length ? `<p class="rv-line" style="margin-top:14px"><b>Merged PRs into ${externalContribs.length} org${externalContribs.length === 1 ? '' : 's'} they don't own</b> — <span class="ev">${externalContribs.slice(0, 4).map((c) => escapeHtml(c.org)).join(', ')}</span></p>` : ''}
  </div>

  <div class="rv-pad rv-section">
    <h2 class="rv-h">Depth — what they build</h2>
    ${stack?.detected?.length ? `<div class="rv-chips" style="margin-bottom:14px">
      ${stack.detected.slice(0, 12).map((t) => `<span class="rv-chip">${escapeHtml(t.name)}</span>`).join('')}
    </div>` : ''}
    ${langList.length ? `<div>
      ${langList.map(([l, c]) => `<div class="rv-skill"><span>${escapeHtml(l)}</span><span class="bar"><i style="width:${Math.round((c / topLangCount) * 100)}%"></i></span><span class="ct">${c} repo${c === 1 ? '' : 's'}</span></div>`).join('')}
    </div>` : ''}
    ${tops.length ? `<ul class="rv-repos" style="margin-top:14px">
      ${tops.map((r) => `<li>
        <div class="rn"><a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(r.name)}</a></div>
        <div class="rd">${escapeHtml(r.description ?? '—')}</div>
        <div class="rm">Last pushed ${relativeDate(r.pushed_at ?? r.updated_at)} · ${r.stargazers_count.toLocaleString()}★</div>
      </li>`).join('')}
    </ul>` : ''}
  </div>

  <div class="rv-pad rv-honesty">
    <h2 class="rv-h">What this can't tell you</h2>
    <ul>
      <li>Code quality and test coverage aren't visible from public metadata.</li>
      <li>Private and work repositories are invisible — this reflects public output only.</li>
      <li>Communication, collaboration and other soft skills aren't measured here.</li>
      <li>How much of any repository is this person's own work can't be determined from the outside.</li>
      <li>The level above is a <b>signals-based estimate, not a verified seniority</b> — senior engineers often have little public code.</li>
      <li>AI-tool detection finds <b>disclosed usage only</b>; absence of signals is not proof AI was not used.</li>
    </ul>
  </div>

  <div class="rv-cta">
    <span class="grow">A live read of public GitHub data — no resume, no buzzwords. Updates automatically.</span>
    <a class="rv-btn primary" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">Share</a>
    <button class="rv-btn" type="button" data-action="save-png">Save PNG</button>
    <button class="rv-btn" type="button" data-action="copy-link">Copy link</button>
    <button class="rv-btn" type="button" data-action="print">Print</button>
    <a class="rv-btn" href="/${escapeAttr(target)}?style=default">Full view</a>
  </div>

  <div class="rv-foot">
    <span>devprint.dev/${escapeHtml(target)}</span>
    <span>public GitHub data only · live</span>
  </div>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const printBtn = root.querySelector<HTMLButtonElement>('[data-action="print"]');
        const card = root.querySelector<HTMLElement>('.rv-card');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, 'Copied');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !card) return;
          flashLabel(saveBtn, 'Rendering…', 6000);
          const ok = await saveAsPng(card, `devprint-recruiter-${target.replace(/\W+/g, '-')}.png`, '#ffffff');
          flashLabel(saveBtn, ok ? 'Saved' : 'Failed');
        };
        const onPrint = (e: Event) => { e.preventDefault(); window.print(); };
        copyBtn?.addEventListener('click', onCopy);
        saveBtn?.addEventListener('click', onSave);
        printBtn?.addEventListener('click', onPrint);
        return () => {
          copyBtn?.removeEventListener('click', onCopy);
          saveBtn?.removeEventListener('click', onSave);
          printBtn?.removeEventListener('click', onPrint);
        };
      },
    };
  },
};

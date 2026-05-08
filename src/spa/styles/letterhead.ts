// v2 Letterhead — printed-CV aesthetic. Off-white paper, slab serif headings,
// single red accent, double-rule dividers.

import { BATTLE_FORMULAS } from '../../analysis/index.ts';
import {
  escapeAttr,
  escapeHtml,
  flashLabel,
  linkedinShareUrl,
  relativeDate,
  saveAsPng,
  topRepos,
  tweetUrl,
  yearsActive,
  type ProfileData,
  type StyleRenderer,
} from './types.ts';

export const letterhead: StyleRenderer = {
  id: 'letterhead',
  name: 'Letterhead',
  blurb: 'Printed CV · share-as-document',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, langs, repos, themes, profileExtra: x, insights } = data;
    const timeline = insights?.timeline;
    const externalContribs = insights?.externalContribs ?? [];
    const provenanceBadges = insights?.provenanceBadges ?? [];
    // User-controlled override: pin specific repo names ahead of the
    // score-based ranking, then fill the rest by score.
    const pinned = (x?.pinned ?? []).map((n) => repos.find((r) => r.name === n)).filter(Boolean) as typeof repos;
    const rest = topRepos(repos.filter((r) => !pinned.some((p) => p.name === r.name)), Math.max(0, 6 - pinned.length));
    const tops = [...pinned, ...rest].slice(0, 6);
    const yrs = yearsActive(repos);
    const langList = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topLangCount = langList[0]?.[1] ?? 1;
    const isOrgOrUser = !isRepo;
    // Tagline: prefer user-supplied; fall back to inferred copy.
    const titleLine = isRepo
      ? `${escapeHtml(repo!.full_name)} — ${escapeHtml(repo!.description || 'a repository fingerprint')}`
      : x?.tagline
        ? escapeHtml(x.tagline)
        : `A ${escapeHtml(archetype)}${yrs ? ` — ${yrs} years of public commits` : ''}`;

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;700&display=swap');
body.style-letterhead{background:#1a1817;color:#111;font-family:Inter,ui-sans-serif,system-ui;padding:24px 16px}
.lh-paper{max-width:920px;margin:0 auto;background:#f5f1e8;background-image:radial-gradient(circle at 20% 30%,rgba(180,150,100,.08) 0%,transparent 40%),radial-gradient(circle at 80% 70%,rgba(180,150,100,.06) 0%,transparent 40%),repeating-linear-gradient(45deg,transparent 0px,transparent 80px,rgba(0,0,0,.012) 80px,rgba(0,0,0,.012) 81px);box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.06);position:relative;padding:54px 64px}
.lh-paper::before{content:"";position:absolute;top:0;right:0;width:60px;height:60px;background:linear-gradient(135deg,transparent 0%,transparent 50%,#1a1817 50%,#1a1817 51%,#e0d8c0 51.5%,#e8e0c8 100%);box-shadow:-3px 3px 6px rgba(0,0,0,.2)}
.lh-topbar{display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;letter-spacing:.1em;text-transform:uppercase;padding-bottom:18px;border-bottom:1px solid #c9bfa3;margin-bottom:32px}
.lh-topbar .brand{color:#c0392b;font-weight:700;letter-spacing:.18em}
.lh-topbar a{color:#666;text-decoration:none;border-bottom:1px dotted #999}
.lh-head{display:grid;grid-template-columns:auto 1fr auto;gap:28px;align-items:flex-start;padding-bottom:24px;border-bottom:6px double #111;margin-bottom:32px}
.lh-head img{width:120px;height:120px;border-radius:0;border:1px solid #111;filter:contrast(1.05) saturate(.85);object-fit:cover}
.lh-name{font-family:Fraunces,Georgia,serif;font-weight:900;font-size:clamp(36px,6.4vw,64px);letter-spacing:-.04em;line-height:.92;font-style:italic;font-variation-settings:"opsz" 144;word-break:break-word;margin:0}
.lh-title-line{font-family:Fraunces,Georgia,serif;font-style:normal;font-weight:400;font-size:18px;color:#666;letter-spacing:0;margin-top:6px}
.lh-meta{text-align:right;font-family:'JetBrains Mono',monospace;font-size:11px;color:#444;line-height:1.7;padding-top:8px}
.lh-meta a{color:#c0392b;text-decoration:none}
.lh-meta .ribbon{display:inline-block;background:#c0392b;color:#f5f1e8;padding:3px 10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:10px;margin-bottom:8px}
.lh-paper h2{font-family:Fraunces,Georgia,serif;font-weight:900;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#111;margin-top:40px;margin-bottom:16px;padding-bottom:6px;border-bottom:1px solid #111;font-variation-settings:"opsz" 12}
.lh-paper h2::before{content:"§ ";color:#c0392b}
.lh-about{font-family:Fraunces,Georgia,serif;font-size:18px;line-height:1.6;letter-spacing:.005em;font-variation-settings:"opsz" 18;max-width:64ch}
.lh-about strong{font-weight:900;color:#c0392b;font-style:normal}
.lh-stats{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #111;border-bottom:1px solid #111;margin-top:24px}
.lh-stat{padding:14px 16px;border-right:1px solid #c9bfa3}
.lh-stat:last-child{border-right:0}
.lh-stat .num{font-family:Fraunces,Georgia,serif;font-weight:900;font-size:30px;letter-spacing:-.03em;line-height:1;color:#111;display:block}
.lh-stat .lbl{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#666;margin-top:6px;display:block}
.lh-bat{width:100%;border-collapse:collapse;margin-top:8px;font-family:Fraunces,Georgia,serif;font-size:16px}
.lh-bat tr{border-bottom:1px dotted #c9bfa3}
.lh-bat tr:last-child{border-bottom:0}
.lh-bat td{padding:9px 0}
.lh-bat td:first-child{font-style:italic;color:#444}
.lh-bat td:nth-child(2){text-align:right;font-weight:900;font-size:22px;letter-spacing:-.02em;color:#111;width:80px}
.lh-bat td:last-child{padding-left:14px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#666;width:auto}
.lh-skills{margin-top:8px}
.lh-skill{display:grid;grid-template-columns:160px 1fr 60px;gap:14px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:12px;padding:8px 0;border-bottom:1px dotted #c9bfa3}
.lh-skill:last-child{border-bottom:0}
.lh-skill .lname{font-weight:700;color:#111}
.lh-skill .lbar{height:8px;background:#e0d8c0;border:1px solid #999;position:relative}
.lh-skill .lbar i{display:block;height:100%;background:#111}
.lh-skill .lcount{text-align:right;color:#666;font-size:11px}
.lh-repos{margin-top:8px;font-family:Fraunces,Georgia,serif;font-size:16px;line-height:1.6;list-style:none;padding:0}
.lh-repos li{display:grid;grid-template-columns:32px 1fr auto auto;gap:14px;padding:12px 0;border-bottom:1px dotted #c9bfa3;align-items:baseline}
.lh-repos li:last-child{border-bottom:0}
.lh-repos .idx{font-family:'JetBrains Mono',monospace;font-size:11px;color:#999;font-feature-settings:"tnum"}
.lh-repos .rname{font-weight:700;font-style:italic}
.lh-repos .rname a{color:#c0392b;text-decoration:none;border-bottom:1px solid currentColor}
.lh-repos .rdesc{display:block;font-size:14px;color:#444;font-style:normal;font-weight:400;margin-top:4px}
.lh-repos .rmeta{font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;text-align:right;white-space:nowrap}
.lh-cta{margin-top:40px;padding:24px;background:#111;color:#f5f1e8;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
.lh-cta h3{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:900;font-size:24px;letter-spacing:-.02em;line-height:1.2}
.lh-cta p{font-size:13px;color:#c9bfa3;margin-top:6px;max-width:46ch}
.lh-buttons{display:flex;gap:8px;flex-wrap:wrap}
.lh-btn{padding:11px 16px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;background:#f5f1e8;color:#111;border:1px solid #f5f1e8;text-decoration:none;cursor:pointer}
.lh-btn:hover{background:#c0392b;color:#f5f1e8;border-color:#c0392b}
.lh-btn.outline{background:transparent;color:#f5f1e8;border:1px solid #f5f1e8}
.lh-btn.outline:hover{background:#f5f1e8;color:#111}
.lh-foot{margin-top:32px;padding-top:24px;border-top:1px solid #c9bfa3;font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;letter-spacing:.05em;display:flex;justify-content:space-between}
.lh-stamp{position:absolute;bottom:48px;right:60px;color:rgba(192,57,43,.18);border:5px double rgba(192,57,43,.3);padding:14px 24px;font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:900;font-size:32px;letter-spacing:-.02em;transform:rotate(-12deg);pointer-events:none;line-height:1}
.lh-stamp small{display:block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;font-style:normal;font-weight:400;text-transform:uppercase;text-align:center;margin-top:4px;color:rgba(192,57,43,.4)}
@media(max-width:740px){.lh-paper{padding:32px 24px}.lh-head{grid-template-columns:auto 1fr;gap:18px}.lh-meta{display:none}.lh-stats{grid-template-columns:repeat(2,1fr)}.lh-skill{grid-template-columns:100px 1fr 50px}}
.lh-paper a:focus-visible,.lh-btn:focus-visible{outline:2px solid #c0392b;outline-offset:2px}
@media print{
  body.style-letterhead{background:#fff!important;padding:0;color:#000}
  .lh-paper{box-shadow:none!important;padding:32px 36px;background:#fff}
  .lh-paper::before,.lh-stamp,#dpStylePicker,.lh-cta{display:none!important}
  .lh-foot{display:none}
  .lh-head{break-inside:avoid}
  .lh-paper h2{break-after:avoid}
  .lh-repos li,.lh-skill,.lh-bat tr{break-inside:avoid}
  a{color:#000;text-decoration:underline}
}
</style>

<div class="lh-paper">
  <div class="lh-topbar">
    <span class="brand">D · DEVPRINT</span>
    <span>Letterhead · <a href="?style=default">default view</a></span>
  </div>

  <header class="lh-head">
    <img src="${escapeAttr(profile.avatar_url)}" alt="" crossorigin="anonymous" />
    <div>
      <h1 class="lh-name">${isRepo ? escapeHtml(repo!.full_name) : escapeHtml(profile.name || profile.login)}</h1>
      <div class="lh-title-line">${titleLine}</div>
    </div>
    <div class="lh-meta">
      ${isRepo
        ? '<span class="ribbon">Repository</span><br>'
        : x?.status
          ? `<span class="ribbon">${escapeHtml(x.status)}</span><br>`
          : x?.available
            ? `<span class="ribbon">${escapeHtml(x.available)}</span><br>`
            : ''}
      github.com/<a href="https://github.com/${escapeAttr(target)}" target="_blank" rel="noreferrer">${escapeHtml(target)}</a><br>
      ${x?.contact ? `<a href="mailto:${escapeAttr(x.contact)}">${escapeHtml(x.contact)}</a><br>` : ''}
      ${x?.links?.length ? x.links.slice(0, 4).map((l) => `<a href="${escapeAttr(l.href)}" target="_blank" rel="noreferrer">${escapeHtml(l.name)}</a>`).join(' · ') + '<br>' : ''}
      <em style="color:#c0392b">live · synced ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</em>
    </div>
  </header>

  ${provenanceBadges.length ? `<div class="lh-prov" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.04em">
    ${provenanceBadges.map((b) => {
      const tone = b.tone === 'positive' ? 'background:#fff;border:1px solid #c0392b;color:#c0392b' : b.tone === 'milestone' ? 'background:#111;color:#f5f1e8;border:1px solid #111' : 'background:transparent;border:1px solid #c9bfa3;color:#444';
      return `<span title="${escapeAttr(b.detail)}" style="${tone};padding:5px 10px;text-transform:uppercase;font-weight:700;cursor:help">★ ${escapeHtml(b.label)}</span>`;
    }).join('')}
  </div>` : ''}

  <h2>About</h2>
  <p class="lh-about">${
    isOrgOrUser
      ? x?.about
        ? escapeHtml(x.about)
        : `${escapeHtml(profile.name || profile.login)} is a <strong>${escapeHtml(archetype.toLowerCase())}</strong> whose public output spans ${repos.length} non-fork repositories totalling <strong>${totalStars.toLocaleString()} stars</strong>${langList.length > 1 ? `, mostly ${langList.slice(0, 3).map(([l]) => escapeHtml(l)).join(', ')}` : ''}${themes.length ? ` with a focus on ${themes.slice(0, 2).map(([t]) => escapeHtml(t.toLowerCase())).join(' and ')}` : ''}. ${profile.followers.toLocaleString()} followers across the platform.`
      : `${escapeHtml(repo!.full_name)} is a <strong>${escapeHtml(repo!.language ?? 'mixed')}</strong> project with ${repo!.stargazers_count.toLocaleString()} stars and ${repo!.forks_count.toLocaleString()} forks. Last push <strong>${relativeDate(repo!.pushed_at ?? repo!.updated_at)}</strong>. ${repo!.description ? escapeHtml(repo!.description) : ''}`
  }</p>
  ${x?.now ? `<p class="lh-about" style="margin-top:14px;font-style:italic;color:#444"><strong style="color:#c0392b;font-style:normal">Right now —</strong> ${escapeHtml(x.now)}</p>` : ''}

  ${x?.highlights?.length ? `<h2>Highlights</h2>
  <ul style="font-family:Fraunces,Georgia,serif;font-size:16px;line-height:1.6;list-style:none;padding:0;margin:0">
    ${x.highlights.slice(0, 6).map((h) => `<li style="display:grid;grid-template-columns:24px 1fr;gap:10px;padding:8px 0;border-bottom:1px dotted #c9bfa3;align-items:baseline"><span style="color:#c0392b;font-weight:900">§</span><span>${escapeHtml(h)}</span></li>`).join('')}
  </ul>` : ''}

  ${x?.skills?.length ? `<h2>Skills, in their words</h2>
  <div style="display:flex;flex-wrap:wrap;gap:6px;font-family:'JetBrains Mono',monospace;font-size:11px">
    ${x.skills.slice(0, 16).map((s) => `<span style="background:#fff;border:1px solid #c9bfa3;padding:5px 10px;color:#111;letter-spacing:.04em">${escapeHtml(s)}</span>`).join('')}
  </div>` : ''}

  <div class="lh-stats">
    <div class="lh-stat"><span class="num">${(isRepo ? (repo!.open_issues_count || 0) : profile.public_repos).toLocaleString()}</span><span class="lbl">${isRepo ? 'open issues' : 'public repos'}</span></div>
    <div class="lh-stat"><span class="num">${totalStars.toLocaleString()}</span><span class="lbl">${isRepo ? 'stars' : 'stars earned'}</span></div>
    <div class="lh-stat"><span class="num">${(isRepo ? repo!.forks_count : profile.followers).toLocaleString()}</span><span class="lbl">${isRepo ? 'forks' : 'followers'}</span></div>
    <div class="lh-stat"><span class="num">${yrs ? `${yrs} yr` : '—'}</span><span class="lbl">${isRepo ? 'last activity' : 'of commits'}</span></div>
  </div>

  <h2>Quantified Profile</h2>
  <table class="lh-bat">
    <tr><td>Build</td><td>${battle.build.value}</td><td>${escapeHtml(BATTLE_FORMULAS.build.split('. ')[1] ?? '')}</td></tr>
    <tr><td>Impact</td><td>${battle.impact.value}</td><td>${escapeHtml(BATTLE_FORMULAS.impact.split('. ')[1] ?? '')}</td></tr>
    <tr><td>Versatility</td><td>${battle.versatility.value}</td><td>${escapeHtml(BATTLE_FORMULAS.versatility.split('. ')[1] ?? '')}</td></tr>
    <tr><td>Momentum</td><td>${battle.momentum.value}</td><td>${escapeHtml(BATTLE_FORMULAS.momentum.split('. ')[1] ?? '')}</td></tr>
    <tr><td>Community</td><td>${battle.community.value}</td><td>${escapeHtml(BATTLE_FORMULAS.community.split('. ')[1] ?? '')}</td></tr>
    <tr><td>Originality</td><td>${battle.originality.value}</td><td>${escapeHtml(BATTLE_FORMULAS.originality.split('. ')[1] ?? '')}</td></tr>
    <tr><td><em>Tier</em></td><td>${escapeHtml(battle.tier)}</td><td>average across the six</td></tr>
  </table>

  ${langList.length ? `<h2>Strengths, with evidence</h2>
  <div class="lh-skills">
    ${langList.map(([l, c]) => `<div class="lh-skill"><span class="lname">${escapeHtml(l)}</span><span class="lbar"><i style="width:${Math.round((c / topLangCount) * 100)}%"></i></span><span class="lcount">${c} repo${c === 1 ? '' : 's'}</span></div>`).join('')}
  </div>` : ''}

  ${timeline?.milestones?.length ? `<h2>Career, in public commits</h2>
  <ol style="font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.55;list-style:none;padding:0;margin:0;border-top:1px solid #c9bfa3">
    ${timeline.milestones.map((m) => `<li style="display:grid;grid-template-columns:90px 1fr;gap:18px;padding:10px 0;border-bottom:1px dotted #c9bfa3;align-items:baseline">
      <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#c0392b;font-weight:700">${m.year}</span>
      <span>${escapeHtml(m.label)}${m.repo ? ` <a href="${escapeAttr(m.repo.html_url)}" target="_blank" rel="noreferrer" style="color:#c0392b;text-decoration:none;border-bottom:1px solid currentColor;font-style:italic">${escapeHtml(m.repo.name)}</a>` : ''}</span>
    </li>`).join('')}
  </ol>` : ''}

  ${x?.experience?.length ? `<h2>Experience</h2>
  <ol style="font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.55;list-style:none;padding:0;margin:0">
    ${x.experience.map((e) => `<li style="padding:12px 0;border-bottom:1px dotted #c9bfa3">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap"><b style="font-style:italic">${escapeHtml(e.role)}${e.org ? ` <span style="font-style:normal;color:#444">·</span> ${e.href ? `<a href="${escapeAttr(e.href)}" target="_blank" rel="noreferrer" style="color:#c0392b;text-decoration:none;border-bottom:1px solid currentColor">${escapeHtml(e.org)}</a>` : escapeHtml(e.org)}` : ''}</b>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666">${escapeHtml(e.from ?? '')}${e.to ? ` – ${escapeHtml(e.to)}` : e.from ? ' – present' : ''}</span></div>
      ${e.summary ? `<p style="margin-top:4px;font-size:14px;color:#333">${escapeHtml(e.summary)}</p>` : ''}
    </li>`).join('')}
  </ol>` : ''}

  ${x?.education?.length ? `<h2>Education</h2>
  <ol style="font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.55;list-style:none;padding:0;margin:0">
    ${x.education.map((e) => `<li style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted #c9bfa3;gap:12px;flex-wrap:wrap">
      <span><b style="font-style:italic">${escapeHtml(e.org)}</b>${e.degree ? ` <span style="color:#444">·</span> ${escapeHtml(e.degree)}` : ''}</span>
      ${e.date ? `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666">${escapeHtml(e.date)}</span>` : ''}
    </li>`).join('')}
  </ol>` : ''}

  ${externalContribs.length ? `<h2>Working with the world</h2>
  <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;letter-spacing:.04em;margin:-6px 0 12px">Merged PRs into repos this person doesn't own — proof of work outside their own org.</p>
  <ol style="font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.55;list-style:none;padding:0;margin:0">
    ${externalContribs.map((c) => `<li style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dotted #c9bfa3;align-items:baseline;gap:14px;flex-wrap:wrap">
      <span><b style="font-style:italic"><a href="https://github.com/${escapeAttr(c.org)}" target="_blank" rel="noreferrer" style="color:#c0392b;text-decoration:none;border-bottom:1px solid currentColor">${escapeHtml(c.org)}</a></b><span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;margin-left:10px">${c.topRepos.slice(0, 3).map((r) => `<a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer" style="color:#666;text-decoration:none;border-bottom:1px dotted #999">${escapeHtml(r.name)}</a>`).join(' · ')}</span></span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#444;font-feature-settings:'tnum'">${c.contributions} merged PR${c.contributions === 1 ? '' : 's'}</span>
    </li>`).join('')}
  </ol>` : ''}

  ${x?.talks?.length ? `<h2>Talks</h2>
  <ol style="font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.55;list-style:none;padding:0;margin:0">
    ${x.talks.map((t) => `<li style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted #c9bfa3;gap:12px;flex-wrap:wrap;align-items:baseline">
      <span><b style="font-style:italic">${t.href ? `<a href="${escapeAttr(t.href)}" target="_blank" rel="noreferrer" style="color:#111;text-decoration:none;border-bottom:1px solid #c0392b">${escapeHtml(t.title)}</a>` : escapeHtml(t.title)}</b>${t.venue ? ` <span style="color:#444">·</span> ${escapeHtml(t.venue)}` : ''}</span>
      ${t.date ? `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666">${escapeHtml(t.date)}</span>` : ''}
    </li>`).join('')}
  </ol>` : ''}

  ${x?.writing?.length ? `<h2>Writing</h2>
  <ol style="font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.55;list-style:none;padding:0;margin:0">
    ${x.writing.map((p) => `<li style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted #c9bfa3;gap:12px;flex-wrap:wrap;align-items:baseline">
      <span><b style="font-style:italic"><a href="${escapeAttr(p.href)}" target="_blank" rel="noreferrer" style="color:#111;text-decoration:none;border-bottom:1px solid #c0392b">${escapeHtml(p.title)}</a></b>${p.publisher ? ` <span style="color:#444">·</span> ${escapeHtml(p.publisher)}` : ''}</span>
      ${p.date ? `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666">${escapeHtml(p.date)}</span>` : ''}
    </li>`).join('')}
  </ol>` : ''}

  ${x?.endorsements?.length ? `<h2>What people say</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.55">
    ${x.endorsements.map((e) => `<blockquote style="margin:0;padding:14px 16px;border-left:3px solid #c0392b;background:rgba(192,57,43,.04);font-style:italic">"${escapeHtml(e.blurb)}"<footer style="margin-top:8px;font-style:normal;font-family:'JetBrains Mono',monospace;font-size:11px;color:#444;letter-spacing:.02em">— <b>${escapeHtml(e.from)}</b>${e.role ? `, ${escapeHtml(e.role)}` : ''}${e.github ? ` · <a href="https://github.com/${escapeAttr(e.github)}" target="_blank" rel="noreferrer" style="color:#c0392b;text-decoration:none">@${escapeHtml(e.github)}</a>` : ''}</footer></blockquote>`).join('')}
  </div>` : ''}

  ${tops.length ? `<h2>Selected Works</h2>
  <ol class="lh-repos">
    ${tops.map((r, i) => `<li>
      <span class="idx">${['i.','ii.','iii.','iv.','v.','vi.'][i] ?? `${i + 1}.`}</span>
      <span class="rname"><a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(r.name)}</a><span class="rdesc">${escapeHtml(r.description ?? '—')}</span></span>
      <span class="rmeta">★ ${r.stargazers_count.toLocaleString()}</span>
      <span class="rmeta">${relativeDate(r.pushed_at ?? r.updated_at)}</span>
    </li>`).join('')}
  </ol>` : ''}

  ${!isRepo && !x ? `<div class="lh-cta" style="margin-top:32px;padding:24px;background:linear-gradient(135deg,#fff8eb,#f5e8c8);color:#111;border:1px solid #c9bfa3;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center">
    <div>
      <h3 style="font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:900;font-size:22px;color:#c0392b">Is this you? Customise your Devprint.</h3>
      <p style="font-size:13px;color:#444;margin-top:6px;max-width:60ch;font-family:Inter,sans-serif">
        Add a tagline, what you're available for, your career history, talks, writing, and endorsements. Devprint reads
        a small JSON file from <code style="font-family:'JetBrains Mono',monospace;background:#fff;border:1px solid #c9bfa3;padding:1px 6px">${escapeHtml(profile.login)}/.github/devprint.json</code>,
        <code style="font-family:'JetBrains Mono',monospace;background:#fff;border:1px solid #c9bfa3;padding:1px 6px">${escapeHtml(profile.login)}/${escapeHtml(profile.login)}/devprint.json</code>, or
        the easiest path — fork our template repo to <code style="font-family:'JetBrains Mono',monospace;background:#fff;border:1px solid #c9bfa3;padding:1px 6px">${escapeHtml(profile.login)}/devprint</code>.
      </p>
    </div>
    <div class="lh-buttons" style="display:flex;flex-direction:column;gap:8px;align-items:stretch">
      <a class="lh-btn" href="/customise.html" style="text-align:center;background:#c0392b;color:#fff;border-color:#c0392b">Customise →</a>
      <a class="lh-btn outline" href="https://github.com/jhammant/devprint/blob/main/docs/DEVPRINT_JSON.md" target="_blank" rel="noreferrer" style="text-align:center;background:transparent;color:#111;border-color:#111">Read the schema</a>
    </div>
  </div>` : ''}

  <div class="lh-cta">
    <div>
      <h3>${x?.ask ? escapeHtml(x.ask.split(/[.!?]\s+/)[0] ?? x.ask) : 'This page is a living CV.'}</h3>
      <p>${x?.ask
        ? escapeHtml(x.ask)
        : 'Send the link to a hiring manager. It updates automatically from public GitHub data — no resume to maintain, no LinkedIn polish, no buzzword bingo.'}</p>
    </div>
    <div class="lh-buttons">
      <a class="lh-btn" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">Share on LinkedIn</a>
      <a class="lh-btn outline" href="${escapeAttr(tweetUrl(`A printable Devprint CV — ${escapeHtml(archetype)}. devprint.dev/${target}`))}" target="_blank" rel="noreferrer">Tweet</a>
      <button class="lh-btn outline" type="button" data-action="save-png">Save PNG</button>
      <button class="lh-btn outline" type="button" data-action="copy-link">Copy link</button>
      <button class="lh-btn outline" type="button" data-action="print">Print as PDF</button>
      <a class="lh-btn outline" href="/${escapeAttr(target)}.resume.json" target="_blank" rel="noreferrer">JSON Resume</a>
    </div>
  </div>

  <div class="lh-foot">
    <span>devprint.dev/${escapeHtml(target)}</span>
    <span>set in Fraunces &amp; JetBrains Mono · public data only · live</span>
  </div>

  <div class="lh-stamp">${escapeHtml(battle.tier.toUpperCase())}<small>tier · ${new Date().getFullYear()}</small></div>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const printBtn = root.querySelector<HTMLButtonElement>('[data-action="print"]');
        const paper = root.querySelector<HTMLElement>('.lh-paper');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, 'Copied');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !paper) return;
          flashLabel(saveBtn, 'Rendering…', 6000);
          const ok = await saveAsPng(paper, `devprint-cv-${target.replace(/\W+/g, '-')}.png`, '#f5f1e8');
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

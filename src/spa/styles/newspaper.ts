// v6 The Devprint Times — newspaper front page.

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

export const newspaper: StyleRenderer = {
  id: 'newspaper',
  name: 'Newspaper',
  blurb: 'The Devprint Times · share-as-broadside',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, repos, themes, langs } = data;
    const tops = topRepos(repos, 4);
    const yrs = yearsActive(repos);
    const langList = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const peerNames = data.insights?.relatedProfiles?.slice(0, 5).map((p) => `@${p.login}`).join(', ');
    const dateLong = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const issue = (profile.public_repos || 1) + 1000;
    const subjectName = isRepo ? escapeHtml(repo!.full_name) : escapeHtml(profile.name || profile.login);

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Old+Standard+TT:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Special+Elite&display=swap');
body.style-newspaper{background:#1a1a1a;color:#111;font-family:'Old Standard TT',Georgia,serif;padding:24px 16px}
.np-news{width:100%;max-width:980px;margin:0 auto;background:#f4ead0;background-image:radial-gradient(circle at 10% 80%,rgba(140,90,40,.12),transparent 40%),radial-gradient(circle at 90% 30%,rgba(140,90,40,.10),transparent 40%);box-shadow:0 30px 80px rgba(0,0,0,.6);padding:22px 28px;color:#111;position:relative}
.np-news::before{content:"";position:absolute;inset:0;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='1' fill='%23000' opacity='0.04'/></svg>") repeat;background-size:6px 6px;pointer-events:none;mix-blend-mode:multiply}
.np-mast{text-align:center;border-bottom:6px double #111;padding-bottom:12px;margin-bottom:14px;position:relative}
.np-mast-top{display:flex;justify-content:space-between;align-items:center;font-family:Inter,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.18em;margin-bottom:8px;color:#444}
.np-mast-top .latin{font-family:'Old Standard TT',serif;font-style:italic;font-size:11px;letter-spacing:.04em;color:#666;text-transform:none}
.np-nameplate{font-family:'Playfair Display',serif;font-weight:900;font-size:84px;letter-spacing:-.02em;line-height:.92;font-style:italic}
.np-tagline{font-family:'Old Standard TT',serif;font-style:italic;font-size:14px;color:#444;margin-top:6px}
.np-mast-bottom{display:flex;justify-content:space-between;align-items:center;font-family:Inter,sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;margin-top:10px;padding-top:8px;border-top:1px solid #888}
.np-mast-bottom strong{color:#a02828}
.np-deck{text-align:center;margin:18px 0 14px;border-bottom:1px solid #222;padding-bottom:12px}
.np-deck-kicker{font-family:Inter,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.24em;color:#a02828;font-weight:700;margin-bottom:8px}
.np-deck h1{font-family:'Playfair Display',serif;font-weight:900;font-size:50px;line-height:.95;letter-spacing:-.025em;margin-bottom:8px}
.np-deck h2{font-family:'Playfair Display',serif;font-weight:400;font-style:italic;font-size:20px;color:#444;line-height:1.3;max-width:36em;margin:0 auto 4px}
.np-byline{font-family:Inter,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#666;margin-top:6px}
.np-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:20px;border-bottom:1px solid #222;padding-bottom:18px;margin-bottom:14px}
.np-art{margin-bottom:10px}
.np-art img{width:100%;height:auto;display:block;filter:contrast(1.05) saturate(.6) sepia(.1)}
.np-cap{font-family:Inter,sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:#666;padding:4px 0;border-bottom:1px solid #888}
.np-col p{font-family:'Old Standard TT',serif;font-size:13.5px;line-height:1.55;text-align:justify;hyphens:auto;text-indent:1.4em;margin-bottom:6px}
.np-col p:first-of-type{text-indent:0}
.np-col p:first-of-type::first-letter{font-family:'Playfair Display',serif;font-weight:900;font-size:54px;float:left;line-height:.85;margin:6px 6px 0 0;color:#a02828}
.np-col p:first-of-type::first-line{font-family:Inter,sans-serif;font-size:11px;letter-spacing:.04em;text-transform:uppercase;font-weight:700}
.np-col h3{font-family:'Playfair Display',serif;font-weight:900;font-size:18px;margin:8px 0 6px;line-height:1.1}
.np-col h3 + p{text-indent:0}
.np-stats{background:#111;color:#f4ead0;padding:14px;margin-bottom:10px}
.np-stats h4{font-family:Inter,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#ffd166;margin-bottom:8px}
.np-stats .num{font-family:'Playfair Display',serif;font-weight:900;font-size:30px;line-height:1;font-style:italic}
.np-stats .num + .lbl{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#bbb;margin-top:4px}
.np-stats hr{border:0;border-top:1px solid #444;margin:10px 0}
.np-bgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-top:8px}
.np-bgrid div{padding:4px 0}
.np-bgrid b{font-family:'Playfair Display',serif;font-weight:900;font-size:18px;color:#ffd166;display:block;line-height:1}
.np-bgrid span{font-family:Inter,sans-serif;font-size:8px;letter-spacing:.14em;color:#bbb;text-transform:uppercase}
.np-classifieds{background:rgba(0,0,0,.05);padding:12px 14px;border:1px solid #888}
.np-classifieds h4{font-family:'Playfair Display',serif;font-weight:900;font-size:14px;text-align:center;border-bottom:3px double #111;padding-bottom:4px;margin-bottom:8px;letter-spacing:-.01em}
.np-cit{font-family:'Old Standard TT',serif;font-size:11.5px;line-height:1.5;border-bottom:1px dotted #888;padding:6px 0}
.np-cit:last-child{border-bottom:0}
.np-cit b{font-weight:700}
.np-pull{background:#a02828;color:#f4ead0;padding:14px 16px;font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:18px;line-height:1.3;margin:8px 0;text-align:center}
.np-pull em{display:block;font-size:11px;font-style:normal;font-family:Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,234,208,.7);margin-top:8px;font-weight:700}
.np-listings{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.np-listing{border-top:1px solid #222;padding-top:8px;text-decoration:none;color:inherit}
.np-listing .lk{font-family:Inter,sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#a02828;font-weight:700}
.np-listing h5{font-family:'Playfair Display',serif;font-weight:900;font-size:16px;letter-spacing:-.01em;line-height:1.1;margin:4px 0}
.np-listing p{font-family:'Old Standard TT',serif;font-size:11.5px;line-height:1.4;color:#444}
.np-listing .meta{font-family:Inter,sans-serif;font-size:9px;color:#777;margin-top:6px}
.np-foot{margin-top:14px;padding-top:8px;border-top:6px double #111;display:flex;justify-content:space-between;font-family:Inter,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#666}
.np-stamp{position:absolute;top:120px;right:24px;font-family:'Special Elite',monospace;color:#a02828;border:3px solid #a02828;padding:8px 12px;transform:rotate(-8deg);text-align:center;font-size:18px;line-height:1;opacity:.65;pointer-events:none}
.np-stamp small{display:block;font-size:9px;letter-spacing:.15em;margin-top:3px}
@media(max-width:740px){.np-grid,.np-listings{grid-template-columns:1fr}}
</style>

<article class="np-news">
  <header class="np-mast">
    <div class="np-mast-top">
      <span>Vol. CXXXIV · No. ${issue}</span>
      <span class="latin">Sine commit, nihil — nothing without commits</span>
      <span>£1.20 · Free Online</span>
    </div>
    <div class="np-nameplate" role="banner">The Devprint Times</div>
    <p class="np-tagline">All the public commits that are fit to print.</p>
    <div class="np-mast-bottom">
      <span>${escapeHtml(dateLong)}</span>
      <span><strong>Today's Edition:</strong> ${subjectName}</span>
      <span>Open-Source Bureau</span>
    </div>
  </header>

  <div class="np-deck">
    <div class="np-deck-kicker">★ Profile of the Day ★</div>
    <h1>${isRepo ? `"${escapeHtml(repo!.description ?? 'Quiet but consequential')}"` : `"They're just shipping," sources say.`}${yrs ? ` <em style="font-style:italic">For ${yrs} years.</em>` : ''}</h1>
    <h2>${isRepo
      ? `${escapeHtml(repo!.full_name)} now holds <strong>${repo!.stargazers_count.toLocaleString()} stars</strong>, <strong>${repo!.forks_count.toLocaleString()} forks</strong>, and ${repo!.open_issues_count.toLocaleString()} open issues. Last push <strong>${relativeDate(repo!.pushed_at ?? repo!.updated_at)}</strong>.`
      : `${escapeHtml(profile.name || profile.login)}, maintainer of <strong>${profile.public_repos.toLocaleString()}</strong> public repositories, now holds <strong>${totalStars.toLocaleString()}</strong> stars across the portfolio.`}</h2>
    <div class="np-byline">By Devprint Staff Reporter · ${escapeHtml(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))}</div>
  </div>

  <div class="np-grid">
    <div class="np-col">
      <div class="np-art">
        <img src="${escapeAttr(profile.avatar_url)}" alt="" crossorigin="anonymous" />
        <div class="np-cap">Above: ${escapeHtml(profile.name || profile.login)}, photographed for this paper. (DEVPRINT)</div>
      </div>
      <p>On a quiet ${new Date().toLocaleDateString('en-US', { weekday: 'long' })} morning, while most of the open-source world was still arguing about which framework to use, ${escapeHtml(profile.name || profile.login)} pushed${yrs ? ` what might be considered another in a ${yrs}-year run of` : ''} a quiet but consequential commit. ${profile.public_repos > 100 ? `By the end of the working day, the portfolio's combined dependency footprint had been counted in five figures.` : `Sources close to the matter could not estimate the dependency footprint, but suggested it was "growing."`}</p>
      ${langList.length ? `<h3>The Stack</h3><p>Of the ${repos.length} most active repositories, ${langList[0] ? `<strong>${langList[0][1]}</strong> are <strong>${escapeHtml(langList[0][0])}</strong>` : ''}${langList.slice(1, 3).length ? `, with ${langList.slice(1, 3).map(([l, n]) => `${n} ${escapeHtml(l)}`).join(' and ')} for variety` : ''}.</p>` : ''}
    </div>

    <div class="np-col">
      <div class="np-stats">
        <h4>By the numbers</h4>
        <div class="num">${profile.public_repos.toLocaleString()}</div>
        <div class="lbl">public repositories</div>
        <hr>
        <div class="num">${totalStars.toLocaleString()}</div>
        <div class="lbl">stars across portfolio</div>
        <hr>
        <div class="num">${profile.followers.toLocaleString()}</div>
        <div class="lbl">followers worldwide</div>
        <hr>
        <div class="np-bgrid">
          <div><b>${battle.build.value}</b><span>Build</span></div>
          <div><b>${battle.impact.value}</b><span>Impact</span></div>
          <div><b>${battle.community.value}</b><span>Community</span></div>
          <div><b>${battle.versatility.value}</b><span>Versatility</span></div>
          <div><b>${battle.momentum.value}</b><span>Momentum</span></div>
          <div><b>${battle.originality.value}</b><span>Originality</span></div>
        </div>
      </div>
      <div class="np-pull">
        ${escapeHtml(archetype)} · ${escapeHtml(battle.tier)} tier.
        <em>— a recent observer</em>
      </div>
    </div>

    <div class="np-col">
      <div class="np-classifieds">
        <h4>★ Career Listings ★</h4>
        <div class="np-cit"><b>OPEN TO OPPORTUNITIES.</b> Maintainer of ${profile.public_repos.toLocaleString()} public repositories seeks ad-hoc consulting on ${langList[0] ? escapeHtml(langList[0][0]) : 'modern stacks'}. References: ${profile.followers.toLocaleString()} followers. <em>Contact via the GitHub address.</em></div>
        ${peerNames ? `<div class="np-cit"><b>WANTED.</b> Frequent collaborators across the portfolio: <i>${escapeHtml(peerNames)}</i> — please apply within.</div>` : ''}
        ${themes.length ? `<div class="np-cit"><b>FOCUS AREAS.</b> Recent work tagged: ${themes.slice(0, 4).map(([t]) => escapeHtml(t)).join(', ')}.</div>` : ''}
      </div>
    </div>
  </div>

  ${tops.length ? `<h3 style="font-family:'Playfair Display',serif;font-weight:900;font-size:24px;letter-spacing:-.01em;margin:6px 0;border-bottom:1px solid #222;padding-bottom:6px">★ Top Releases &amp; What People Are Reading</h3>
  <div class="np-listings">
    ${tops.map((r, i) => `<a class="np-listing" href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><div class="lk">No. ${i + 1}${i === 0 ? ' · Best-Seller' : i === 2 ? ' · Editor\'s Pick' : ''}</div><h5>${escapeHtml(r.name)}</h5><p>${escapeHtml((r.description ?? 'Reviewed in this paper.').slice(0, 100))}</p><div class="meta">★ ${r.stargazers_count.toLocaleString()} · ${relativeDate(r.pushed_at ?? r.updated_at)}</div></a>`).join('')}
  </div>` : ''}

  <footer class="np-foot">
    <span>devprint.dev/${escapeHtml(target)} · subscribe with your username</span>
    <span>printed live · public data only · synced ${escapeHtml(new Date().toLocaleDateString('en-GB'))}</span>
  </footer>

  <div class="np-share" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;border-top:1px solid #888;padding-top:14px">
    <a class="np-btn" href="${escapeAttr(tweetUrl(`Today's edition of The Devprint Times: ${subjectName}. devprint.dev/${target}`))}" target="_blank" rel="noreferrer" style="font-family:'Special Elite',monospace;font-size:12px;padding:8px 14px;background:#a02828;color:#f4ead0;text-decoration:none;letter-spacing:.08em;text-transform:uppercase">↗ Tweet</a>
    <a class="np-btn" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer" style="font-family:'Special Elite',monospace;font-size:12px;padding:8px 14px;background:#111;color:#f4ead0;text-decoration:none;letter-spacing:.08em;text-transform:uppercase">↗ LinkedIn</a>
    <button class="np-btn" type="button" data-action="save-png" style="font-family:'Special Elite',monospace;font-size:12px;padding:8px 14px;background:transparent;color:#111;border:2px solid #111;letter-spacing:.08em;text-transform:uppercase;cursor:pointer">📰 Save PNG</button>
    <button class="np-btn" type="button" data-action="copy-link" style="font-family:'Special Elite',monospace;font-size:12px;padding:8px 14px;background:transparent;color:#111;border:2px solid #111;letter-spacing:.08em;text-transform:uppercase;cursor:pointer">📋 Copy</button>
  </div>

  <div class="np-stamp">PRESS<br>COPY<small>· ${escapeHtml(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase())} ·</small></div>
</article>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const news = root.querySelector<HTMLElement>('.np-news');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !news) return;
          flashLabel(saveBtn, '⏳ Rendering…', 6000);
          const ok = await saveAsPng(news, `devprint-news-${target.replace(/\W+/g, '-')}.png`, '#f4ead0');
          flashLabel(saveBtn, ok ? '✓ SAVED' : '✗ FAILED');
        };
        copyBtn?.addEventListener('click', onCopy);
        saveBtn?.addEventListener('click', onSave);
        return () => {
          copyBtn?.removeEventListener('click', onCopy);
          saveBtn?.removeEventListener('click', onSave);
        };
      },
    };
  },
};

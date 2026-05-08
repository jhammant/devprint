// v9 Subway — transit-line poster aesthetic. Coloured lines, big station
// names, MTA-style typographic system.

import {
  escapeAttr,
  escapeHtml,
  flashLabel,
  linkedinShareUrl,
  saveAsPng,
  shortStars,
  topRepos,
  tweetUrl,
  yearsActive,
  type StyleRenderer,
} from './types.ts';

export const subway: StyleRenderer = {
  id: 'subway',
  name: 'Subway',
  blurb: 'Transit map · share-as-line',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, repos, langs } = data;
    const tops = topRepos(repos, 6);
    const yrs = yearsActive(repos);
    const colours = ['#ee352e', '#0039a6', '#fccc0a', '#00933c', '#ff6319', '#a626a4'];
    const lineLetter = (profile.login.toUpperCase().codePointAt(0) || 65) % 26;
    const lineChar = String.fromCharCode(65 + lineLetter);
    const lineColour = colours[lineLetter % colours.length];
    const tweetText = `Now boarding the ${lineChar} line · ${archetype} · ${battle.tier} · devprint.dev/${target}`;

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono&display=swap');
body.style-subway{background:#1a1a1a;color:#fff;font-family:Inter,ui-sans-serif,system-ui;padding:32px 16px;display:flex;flex-direction:column;align-items:center;min-height:100vh}
.sb-poster{width:100%;max-width:680px;background:#fff;color:#111;padding:36px 32px;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.6);position:relative;font-family:Inter,sans-serif}
.sb-head{display:flex;justify-content:space-between;align-items:center;border-bottom:6px solid #111;padding-bottom:18px;margin-bottom:24px}
.sb-title{font-family:Inter,sans-serif;font-weight:900;font-size:18px;letter-spacing:.04em;text-transform:uppercase}
.sb-title small{display:block;font-size:11px;letter-spacing:.18em;color:#666;margin-top:2px;font-weight:700}
.sb-medallion{width:64px;height:64px;border-radius:50%;background:${lineColour};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;font-weight:900;font-size:36px;letter-spacing:-.02em;box-shadow:0 4px 0 #1a1a1a}
.sb-name{font-family:Inter,sans-serif;font-weight:900;font-size:clamp(36px,7vw,64px);letter-spacing:-.04em;line-height:.95;margin-bottom:6px;color:#111;text-transform:uppercase}
.sb-arch{font-family:Inter,sans-serif;font-weight:700;font-size:16px;color:${lineColour};letter-spacing:.04em;margin-bottom:24px;text-transform:uppercase}
.sb-line{position:relative;padding-left:28px;margin-bottom:28px}
.sb-line::before{content:"";position:absolute;top:14px;bottom:14px;left:8px;width:8px;background:${lineColour};border-radius:4px}
.sb-stop{position:relative;display:flex;justify-content:space-between;align-items:baseline;padding:14px 0;border-bottom:1px solid #eee;font-family:Inter,sans-serif;font-size:18px;font-weight:700;color:#111;text-decoration:none;letter-spacing:-.01em}
.sb-stop:last-child{border-bottom:0}
.sb-stop:focus-visible{outline:2px solid ${lineColour};outline-offset:2px}
.sb-stop::before{content:"";position:absolute;left:-26px;top:50%;transform:translateY(-50%);width:14px;height:14px;border-radius:50%;background:#fff;border:4px solid ${lineColour};z-index:2}
.sb-stop:hover{color:${lineColour}}
.sb-stop .meta{font-family:'JetBrains Mono',monospace;font-size:13px;color:#666;font-weight:400;letter-spacing:.04em}
.sb-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;padding:18px 0;border-top:6px solid #111;border-bottom:1px solid #ccc}
.sb-stat{text-align:center}
.sb-stat b{display:block;font-family:Inter,sans-serif;font-weight:900;font-size:36px;color:#111;letter-spacing:-.04em;line-height:1}
.sb-stat span{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.18em;color:#666;text-transform:uppercase;margin-top:6px;display:block;font-weight:700}
.sb-foot{font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;border-top:1px solid #ccc;padding-top:14px;margin-top:14px;display:flex;justify-content:space-between;letter-spacing:.04em}
.sb-cta{margin-top:24px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.sb-btn{padding:10px 14px;font-family:Inter,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;color:#fff;background:${lineColour};border:0;border-radius:4px;cursor:pointer;font-weight:900}
.sb-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.sb-btn.dark{background:#111;color:#fff}
.sb-btn.line{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}
</style>

<div class="sb-poster">
  <div class="sb-head">
    <div class="sb-title">METROPOLITAN OPEN-SOURCE TRANSIT<small>NORTHBOUND · NOW BOARDING</small></div>
    <div class="sb-medallion">${lineChar}</div>
  </div>
  <div class="sb-name">${escapeHtml(profile.name || profile.login)}</div>
  <div class="sb-arch">${escapeHtml(archetype.toUpperCase())} · ${escapeHtml(battle.tier.toUpperCase())} TIER · ${yrs ? `${yrs} years on the line` : 'now in service'}</div>

  <div class="sb-stats">
    <div class="sb-stat"><b>${profile.public_repos.toLocaleString()}</b><span>repos</span></div>
    <div class="sb-stat"><b>${shortStars(totalStars)}</b><span>stars</span></div>
    <div class="sb-stat"><b>${shortStars(profile.followers)}</b><span>passengers</span></div>
  </div>

  ${tops.length ? `<div class="sb-line">
    ${tops.map((r) => `<a class="sb-stop" href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(r.name.toUpperCase())}</span><span class="meta">★ ${shortStars(r.stargazers_count)}</span></a>`).join('')}
  </div>` : ''}

  <div class="sb-foot">
    <span>devprint.dev/${escapeHtml(target)}</span>
    <span>${escapeHtml(new Date().toLocaleDateString('en-GB'))}</span>
  </div>
</div>

<div class="sb-cta">
  <a class="sb-btn" href="${escapeAttr(tweetUrl(tweetText))}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="sb-btn dark" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">↗ LINKEDIN</a>
  <button class="sb-btn dark" type="button" data-action="save-png">📥 SAVE PNG</button>
  <button class="sb-btn line" type="button" data-action="copy-link">📋 COPY</button>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const poster = root.querySelector<HTMLElement>('.sb-poster');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !poster) return;
          flashLabel(saveBtn, '⏳ RENDERING…', 6000);
          const ok = await saveAsPng(poster, `devprint-line-${target.replace(/\W+/g, '-')}.png`, '#fff');
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

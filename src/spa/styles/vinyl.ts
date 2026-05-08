// v8 Vinyl — record-sleeve aesthetic. Big circular record with the avatar
// at the centre, gatefold sleeve text on either side. Square-format → fits
// every album-sized social slot.

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

export const vinyl: StyleRenderer = {
  id: 'vinyl',
  name: 'Vinyl',
  blurb: 'Record sleeve · share-as-album',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, repos, themes } = data;
    const tops = topRepos(repos, 8);
    const yrs = yearsActive(repos);
    const tweetText = `My Devprint LP · ${archetype} · ${battle.tier}. devprint.dev/${target}`;
    const sideALabel = `${escapeHtml(profile.name || profile.login).slice(0, 22)}`;
    const yr = new Date().getFullYear();

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;700;900&family=JetBrains+Mono:wght@400;700&family=Anton&display=swap');
body.style-vinyl{background:#0a0a08;color:#fff;font-family:Inter,ui-sans-serif,system-ui;padding:32px 16px;display:flex;flex-direction:column;align-items:center;min-height:100vh}
body.style-vinyl::before{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at top,rgba(255,180,80,.1),transparent 50%),radial-gradient(ellipse at bottom,rgba(180,40,80,.1),transparent 50%);z-index:-1;pointer-events:none}
.vn-wrap{width:100%;max-width:740px}
.vn-sleeve{position:relative;aspect-ratio:1/1;background:linear-gradient(135deg,#fdf3d8 0%,#f5e6b8 50%,#e8c878 100%);color:#1a1a1a;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.1);overflow:hidden;font-family:'Bodoni Moda',serif}
.vn-sleeve::before{content:"";position:absolute;inset:0;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='30' cy='40' r='.7' fill='%23000' opacity='.07'/><circle cx='70' cy='65' r='.5' fill='%23000' opacity='.06'/><circle cx='15' cy='80' r='.4' fill='%23000' opacity='.05'/></svg>") repeat;pointer-events:none;mix-blend-mode:multiply;opacity:.6}
.vn-record{position:absolute;width:78%;height:78%;top:11%;left:11%;border-radius:50%;background:radial-gradient(circle,#0a0a0a 0%,#0a0a0a 16%,#1a1a1a 17%,#0a0a0a 18%,#1a1a1a 19%,#0a0a0a 20%,#1a1a1a 21%,#0a0a0a 100%);box-shadow:inset 0 0 40px rgba(0,0,0,.8),0 4px 20px rgba(0,0,0,.4);transform:translateX(8%);animation:vn-spin 24s linear infinite;will-change:transform}
@keyframes vn-spin{to{transform:translateX(8%) rotate(360deg)}}
.vn-record::before{content:"";position:absolute;width:62%;height:62%;top:19%;left:19%;border-radius:50%;background:radial-gradient(circle,#a02828,#7a1818);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.vn-record::after{content:"";position:absolute;width:8%;height:8%;top:46%;left:46%;border-radius:50%;background:#fdf3d8;box-shadow:inset 0 0 0 1px rgba(0,0,0,.3)}
.vn-label-text{position:absolute;width:62%;height:62%;top:19%;left:19%;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fdf3d8;font-family:'Anton',sans-serif;letter-spacing:.04em;z-index:2;pointer-events:none;padding:8%}
.vn-label-text .lbl-side{font-size:14px;letter-spacing:.16em;opacity:.7}
.vn-label-text .lbl-arche{font-size:clamp(14px,2vw,22px);line-height:1;margin-top:6px}
.vn-label-text .lbl-tier{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;margin-top:8px;opacity:.85}
.vn-cover{position:absolute;left:0;top:0;width:60%;height:100%;padding:36px 30px;display:flex;flex-direction:column;justify-content:space-between;z-index:3;mix-blend-mode:multiply}
.vn-cover .top{}
.vn-cover .label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#7a1818;margin-bottom:6px}
.vn-cover h1{font-family:'Bodoni Moda',serif;font-weight:900;font-size:clamp(28px,5vw,52px);line-height:.95;letter-spacing:-.02em;color:#1a1a1a;margin:0 0 6px}
.vn-cover h1 em{font-style:italic;color:#7a1818}
.vn-cover .sub{font-family:'Bodoni Moda',serif;font-style:italic;font-size:14px;color:#444;line-height:1.4}
.vn-cover .stars{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:auto}
.vn-cover .star b{font-family:'Anton',sans-serif;font-size:24px;color:#1a1a1a;line-height:1;letter-spacing:0}
.vn-cover .star span{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#666}
.vn-corner{position:absolute;right:8px;top:8px;width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#a02828,#7a1818);color:#fdf3d8;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:'Anton',sans-serif;letter-spacing:.04em;text-align:center;z-index:4;box-shadow:0 6px 14px rgba(0,0,0,.3)}
.vn-corner b{font-size:28px;line-height:.9}
.vn-corner span{font-size:9px;letter-spacing:.18em;font-family:'JetBrains Mono',monospace}
.vn-tracks{margin-top:24px;background:#1a1a1a;color:#fdf3d8;padding:24px 28px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:13px}
.vn-tracks h3{font-family:'Bodoni Moda',serif;font-weight:900;font-style:italic;font-size:24px;letter-spacing:-.01em;margin-bottom:14px;color:#ffb000}
.vn-tracks ol{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 32px}
.vn-tracks li{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dotted rgba(255,255,255,.18)}
.vn-tracks li:last-child{border-bottom:0}
.vn-tracks a{color:#fdf3d8;text-decoration:none;display:flex;justify-content:space-between;width:100%}
.vn-tracks a:hover{color:#ffb000}
.vn-tracks a:focus-visible{outline:2px solid #ffb000;outline-offset:2px}
.vn-tracks a span:first-child{display:flex;gap:10px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vn-tracks a span:first-child em{font-style:normal;color:rgba(255,255,255,.4);font-feature-settings:"tnum";flex-shrink:0}
.vn-tracks a span:last-child{color:#888;flex-shrink:0;margin-left:14px}
.vn-cta{margin-top:24px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.vn-btn{padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:#0a0a08;background:#ffb000;border:0;border-radius:4px;cursor:pointer;font-weight:700}
.vn-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.vn-btn.red{background:#a02828;color:#fdf3d8}
.vn-btn.dark{background:#1a1a1a;color:#fdf3d8}
.vn-btn.line{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}
@media(prefers-reduced-motion:reduce){.vn-record{animation:none}}
@media(max-width:520px){.vn-tracks ol{grid-template-columns:1fr}.vn-corner{width:64px;height:64px}.vn-corner b{font-size:20px}}
</style>

<div class="vn-wrap">
  <article class="vn-sleeve">
    <div class="vn-record">
      <div class="vn-label-text">
        <span class="lbl-side">SIDE A</span>
        <span class="lbl-arche">${escapeHtml(archetype.toUpperCase())}</span>
        <span class="lbl-tier">${escapeHtml(battle.tier.toUpperCase())}</span>
      </div>
    </div>
    <div class="vn-cover">
      <div class="top">
        <div class="label">DEVPRINT RECORDS · ${yr}</div>
        <h1>${escapeHtml((profile.name || profile.login).split(' ')[0] ?? profile.login)}<br><em>${escapeHtml(((profile.name || profile.login).split(' ').slice(1).join(' ')) || sideALabel)}</em></h1>
        <div class="sub">An LP in ${profile.public_repos.toLocaleString()} parts. ${shortStars(totalStars)} ★ pressed.</div>
      </div>
      <div class="stars">
        <div class="star"><b>${profile.public_repos.toLocaleString()}</b><br><span>repos</span></div>
        <div class="star"><b>${shortStars(totalStars)}</b><br><span>stars</span></div>
        <div class="star"><b>${shortStars(profile.followers)}</b><br><span>fans</span></div>
      </div>
    </div>
    <div class="vn-corner"><b>${battle.build.value}</b><span>BUILD</span></div>
  </article>

  ${tops.length ? `<div class="vn-tracks">
    <h3>Side A · The Tracks</h3>
    <ol>
      ${tops.map((r, i) => `<li><a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><span><em>${(i + 1).toString().padStart(2, '0')}</em>${escapeHtml(r.name)}</span><span>★ ${shortStars(r.stargazers_count)}</span></a></li>`).join('')}
    </ol>
  </div>` : ''}
</div>

<div class="vn-cta">
  <a class="vn-btn" href="${escapeAttr(tweetUrl(tweetText))}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="vn-btn red" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">↗ LINKEDIN</a>
  <button class="vn-btn dark" type="button" data-action="save-png">💿 SAVE PNG</button>
  <button class="vn-btn line" type="button" data-action="copy-link">📋 COPY</button>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const sleeve = root.querySelector<HTMLElement>('.vn-wrap');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !sleeve) return;
          flashLabel(saveBtn, '⏳ RENDERING…', 6000);
          const ok = await saveAsPng(sleeve, `devprint-vinyl-${target.replace(/\W+/g, '-')}.png`, '#0a0a08');
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

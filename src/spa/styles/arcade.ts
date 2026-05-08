// v1 Arcade — 8-bit menu-screen aesthetic. CRT scanlines, blocky pixel font.

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

export const arcade: StyleRenderer = {
  id: 'arcade',
  name: 'Arcade',
  blurb: '8-bit attract mode · share-as-pixels',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, repos } = data;
    const tops = topRepos(repos, 5);
    const yrs = yearsActive(repos);
    const tweetText = `INSERT COIN · ${archetype} · ${battle.tier} · devprint.dev/${target}`;

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
body.style-arcade{background:#0a0014;color:#00f0ff;font-family:'VT323',ui-monospace,monospace;padding:32px 16px;display:flex;flex-direction:column;align-items:center;min-height:100vh;font-size:18px}
body.style-arcade::before{content:"";position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(0,255,255,.05) 2px,rgba(0,255,255,.05) 3px);pointer-events:none;z-index:1000;mix-blend-mode:screen}
body.style-arcade::after{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.6) 100%);pointer-events:none;z-index:999}
.ar-screen{width:100%;max-width:680px;background:#000;border:4px solid #ff00ff;padding:36px 32px;border-radius:6px;box-shadow:0 0 40px rgba(255,0,255,.3),0 0 0 1px rgba(255,0,255,.6),inset 0 0 80px rgba(0,255,255,.05);position:relative}
.ar-screen::before{content:"INSERT COIN";position:absolute;top:8px;left:50%;transform:translateX(-50%);font-family:'Press Start 2P',monospace;font-size:8px;color:#ff00ff;letter-spacing:.2em;animation:ar-blink 1.4s steps(2) infinite}
@keyframes ar-blink{50%{opacity:0}}
.ar-title{font-family:'Press Start 2P',monospace;font-size:28px;color:#ffd166;text-shadow:0 0 12px currentColor,4px 4px 0 #ff00ff;text-align:center;letter-spacing:.04em;line-height:1.4;margin-bottom:8px;margin-top:14px}
.ar-sub{font-family:'Press Start 2P',monospace;font-size:10px;color:#62f0a7;text-align:center;letter-spacing:.16em;margin-bottom:24px}
.ar-portrait{display:flex;align-items:center;gap:18px;padding:18px;border:2px dashed #00f0ff;margin-bottom:18px}
.ar-avatar{width:84px;height:84px;border:3px solid #ffd166;image-rendering:pixelated;filter:contrast(1.05) saturate(.9)}
.ar-stats{flex:1;font-family:'VT323',monospace;font-size:18px;color:#fff;line-height:1.5}
.ar-stats b{color:#ff00ff}
.ar-meta{font-family:'Press Start 2P',monospace;font-size:8px;color:#888;letter-spacing:.1em;margin-top:4px}
.ar-section{margin-bottom:18px;padding:14px 18px;border:2px solid rgba(0,255,255,.4);background:rgba(0,255,255,.03)}
.ar-section h3{font-family:'Press Start 2P',monospace;font-size:11px;color:#ff00ff;text-shadow:0 0 8px currentColor;letter-spacing:.05em;margin-bottom:10px}
.ar-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-family:'Press Start 2P',monospace;font-size:11px}
.ar-grid div{padding:6px;background:rgba(255,0,255,.08);border:1px solid rgba(255,0,255,.4);text-align:center;color:#fff}
.ar-grid div b{display:block;font-size:14px;color:#ffd166;text-shadow:0 0 6px currentColor;margin-top:4px}
.ar-list a{display:flex;justify-content:space-between;align-items:baseline;font-family:'VT323',monospace;font-size:18px;color:#fff;text-decoration:none;padding:5px 0;border-bottom:1px dotted rgba(0,255,255,.2)}
.ar-list a:last-child{border-bottom:0}
.ar-list a:hover{color:#ffd166}
.ar-list a:focus-visible{outline:2px solid #ffd166;outline-offset:1px}
.ar-list a span:first-child::before{content:"▸ "}
.ar-list a span:last-child{color:#ff00ff}
.ar-cta{margin-top:24px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.ar-btn{padding:12px 16px;font-family:'Press Start 2P',monospace;font-size:10px;letter-spacing:.05em;text-decoration:none;color:#000;background:#ffd166;border:0;border-radius:0;cursor:pointer;box-shadow:0 4px 0 #a17a00}
.ar-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ar-btn.cyan{background:#00f0ff;box-shadow:0 4px 0 #007a85}
.ar-btn.pink{background:#ff00ff;color:#fff;box-shadow:0 4px 0 #88006c}
.ar-btn.line{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);box-shadow:0 4px 0 rgba(255,255,255,.1)}
@media(prefers-reduced-motion:reduce){.ar-screen::before{animation:none}}
</style>

<div class="ar-screen">
  <div class="ar-title">${escapeHtml((profile.name || profile.login).toUpperCase())}</div>
  <div class="ar-sub">PLAYER 1 · ${escapeHtml(archetype.toUpperCase())} · ${escapeHtml(battle.tier.toUpperCase())}</div>
  <div class="ar-portrait">
    <img class="ar-avatar" src="${escapeAttr(profile.avatar_url)}" alt="${escapeAttr(profile.login)} avatar" referrerpolicy="no-referrer" />
    <div class="ar-stats">
      <div>HP: <b>${battle.build.value}/99</b> ATK: <b>${battle.impact.value}/99</b></div>
      <div>SPD: <b>${battle.momentum.value}/99</b> DEF: <b>${battle.community.value}/99</b></div>
      <div class="ar-meta">@${escapeHtml(profile.login.toUpperCase())} · ${profile.public_repos.toLocaleString()} repos · ${shortStars(totalStars)} ★ · LV ${yrs ? Math.min(99, yrs * 4) : '??'}</div>
    </div>
  </div>

  <div class="ar-section">
    <h3>▸ BATTLE STATS</h3>
    <div class="ar-grid">
      <div>BUILD<b>${battle.build.value}</b></div>
      <div>IMPACT<b>${battle.impact.value}</b></div>
      <div>VERSAT<b>${battle.versatility.value}</b></div>
      <div>MOMNT<b>${battle.momentum.value}</b></div>
      <div>COMM<b>${battle.community.value}</b></div>
      <div>ORIGN<b>${battle.originality.value}</b></div>
    </div>
  </div>

  ${tops.length ? `<div class="ar-section ar-list">
    <h3>▸ HIGH SCORES</h3>
    ${tops.map((r) => `<a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(r.name.toUpperCase())}</span><span>${shortStars(r.stargazers_count)} ★</span></a>`).join('')}
  </div>` : ''}
</div>

<div class="ar-cta">
  <a class="ar-btn" href="${escapeAttr(tweetUrl(tweetText))}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="ar-btn cyan" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">↗ LINKEDIN</a>
  <button class="ar-btn pink" type="button" data-action="save-png">📥 SAVE PNG</button>
  <button class="ar-btn line" type="button" data-action="copy-link">📋 COPY</button>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const screen = root.querySelector<HTMLElement>('.ar-screen');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !screen) return;
          flashLabel(saveBtn, '⏳ RENDERING…', 6000);
          const ok = await saveAsPng(screen, `devprint-arcade-${target.replace(/\W+/g, '-')}.png`, '#000');
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

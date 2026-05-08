// v4 Holofoil — the trading card with mouse-tracked rainbow foil sheen.
//
// Design notes (post review):
// - mix-blend-mode is `screen` (not color-dodge): color-dodge over a dark
//   base clips to white, washing out the rainbow. `screen` lets the foil
//   stops actually show colour.
// - mousemove is bound to the card itself, not document — fixes "tilts when
//   I move my mouse anywhere on the page" feel.
// - archetype linebreak is built from already-escaped text — fixes the bug
//   where a multi-word archetype rendered the literal string `<br>`.
// - Returns an unmount() so the dispatcher can remove listeners on style
//   change (no full page reload anymore).

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
  type ProfileData,
  type StyleRenderer,
} from './types.ts';

export const holofoil: StyleRenderer = {
  id: 'holofoil',
  name: 'Holofoil',
  blurb: 'Trading card with mouse-tracked foil · share-as-grail',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target } = data;
    const tops = topRepos(data.repos, 3);
    const yrs = yearsActive(data.repos);
    const moves = tops.length
      ? tops.map((r, i) => {
          const prefix = ['★', '⚡', '↯'][i] ?? '◇';
          return `<a class="hf-move" href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><span class="hf-mn">${prefix} ${escapeHtml(r.name)} <small>${escapeHtml(r.description?.slice(0, 56) ?? '')}</small></span><span class="hf-md">${shortStars(r.stargazers_count)}</span></a>`;
        }).join('')
      : `<div class="hf-move"><span class="hf-mn">◈ portfolio <small>${profile.public_repos} public repos · ${profile.followers.toLocaleString()} followers</small></span><span class="hf-md">${shortStars(totalStars)}</span></div>`;

    // Escape the archetype FIRST, then turn whitespace into <br> — earlier
    // versions did it in the wrong order, so the literal string `<br>`
    // showed up rendered.
    const archeSafe = escapeHtml(archetype.toUpperCase()).replace(/\s+/g, '<br>');
    const tierSafe = escapeHtml(battle.tier.toUpperCase());
    const cardName = isRepo ? escapeHtml(repo!.full_name) : escapeHtml(profile.name || profile.login);
    const tweetText = `My Devprint card · ${archetype} · ${battle.tier}. See yours at devprint.dev/${target}`;

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Bebas+Neue&display=swap');
body.style-holofoil{background:#0a0210;color:#fff;font-family:Inter,ui-sans-serif,system-ui;display:flex;flex-direction:column;align-items:center;padding:24px 18px;perspective:2000px;min-height:100vh}
body.style-holofoil::before{content:"";position:fixed;inset:-30%;background:radial-gradient(ellipse at center,rgba(255,0,170,.18) 0%,rgba(0,240,255,.10) 30%,transparent 60%);animation:hf-drift 24s ease-in-out infinite alternate;z-index:-1;pointer-events:none}
@keyframes hf-drift{from{transform:translate(-2%,-2%) rotate(0deg)}to{transform:translate(2%,3%) rotate(8deg)}}
.hf-card{position:relative;width:380px;height:560px;border-radius:24px;cursor:default;transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .08s ease-out;will-change:transform;margin-top:8px}
.hf-base{position:absolute;inset:0;border-radius:24px;background:linear-gradient(160deg,#1a0030 0%,#3a0a55 30%,#5a004a 60%,#0a0530 100%);border:3px solid #ffd166;box-shadow:0 40px 80px -10px rgba(255,0,170,.4),0 0 0 1px rgba(255,255,255,.08),inset 0 0 60px rgba(255,209,102,.05);overflow:hidden}
.hf-base::before{content:"";position:absolute;inset:6px;border:1px solid rgba(255,209,102,.35);border-radius:18px;pointer-events:none;z-index:5}
.hf-foil{position:absolute;inset:0;border-radius:24px;mix-blend-mode:screen;background:radial-gradient(ellipse 320px 540px at var(--mx,50%) var(--my,50%),rgba(255,80,200,.85) 0%,rgba(255,209,80,.7) 18%,rgba(80,255,220,.6) 36%,rgba(180,80,255,.5) 56%,transparent 78%);filter:saturate(1.2);pointer-events:none;z-index:8;opacity:.92}
.hf-grain{position:absolute;inset:0;border-radius:24px;background:repeating-linear-gradient(var(--ang,115deg),rgba(255,255,255,.04) 0px,rgba(255,255,255,.04) 1px,transparent 1px,transparent 8px);mix-blend-mode:soft-light;pointer-events:none;z-index:9;opacity:.6}
.hf-header{position:absolute;left:14px;right:14px;top:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;z-index:10}
.hf-arche{font-family:'Press Start 2P',monospace;font-size:9px;color:#ffd166;text-shadow:0 0 8px currentColor;letter-spacing:.05em;line-height:1.5;max-width:160px}
.hf-hp{font-family:'Bebas Neue',Inter,sans-serif;font-size:30px;color:#fff;letter-spacing:.05em;line-height:1;text-shadow:0 0 8px rgba(255,209,102,.8);text-align:right;flex-shrink:0}
.hf-hp small{font-family:'Press Start 2P',monospace;font-size:9px;color:#ff5cc8;display:block;letter-spacing:.1em;margin-top:2px}
.hf-frame{position:absolute;left:24px;right:24px;top:62px;height:230px;border-radius:14px;overflow:hidden;border:3px solid #ffd166;box-shadow:0 0 24px rgba(255,209,102,.4),inset 0 0 20px rgba(0,0,0,.3);background:linear-gradient(135deg,#0a0530,#3a0a55);z-index:10}
.hf-frame::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.4),transparent 60%);z-index:2;pointer-events:none}
.hf-frame img{width:100%;height:100%;object-fit:cover;filter:saturate(1.1) contrast(1.05)}
.hf-fc{position:absolute;background:#ffd166;width:14px;height:14px;z-index:3}
.hf-tl{top:-2px;left:-2px;clip-path:polygon(0 0,100% 0,0 100%)}
.hf-tr{top:-2px;right:-2px;clip-path:polygon(0 0,100% 0,100% 100%)}
.hf-bl{bottom:-2px;left:-2px;clip-path:polygon(0 0,0 100%,100% 100%)}
.hf-br{bottom:-2px;right:-2px;clip-path:polygon(100% 0,100% 100%,0 100%)}
.hf-np{position:absolute;left:24px;right:24px;top:300px;height:60px;background:linear-gradient(90deg,rgba(0,0,0,.45),rgba(255,209,102,.22),rgba(0,0,0,.45));border-top:1px solid rgba(255,209,102,.5);border-bottom:1px solid rgba(255,209,102,.5);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 14px;z-index:10}
.hf-nm{font-family:Inter,sans-serif;font-weight:900;font-size:18px;letter-spacing:-.02em;line-height:1;text-shadow:0 0 12px rgba(255,209,102,.5);min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf-nm small{display:block;font-weight:400;font-size:11px;color:#ff5cc8;letter-spacing:.05em;margin-top:3px;text-shadow:0 0 6px currentColor}
.hf-tier{font-family:'Bebas Neue',Inter,sans-serif;font-size:18px;color:#000;background:linear-gradient(135deg,#ffd166,#ff7e3a);padding:5px 9px;border-radius:6px;letter-spacing:.05em;line-height:1;box-shadow:0 4px 12px rgba(255,126,58,.6);flex-shrink:0;white-space:nowrap}
.hf-moves{position:absolute;left:24px;right:24px;top:380px;z-index:10}
.hf-move{display:flex;justify-content:space-between;align-items:baseline;padding:7px 11px;background:rgba(0,0,0,.45);border:1px solid rgba(255,209,102,.3);border-radius:8px;margin-bottom:5px;font-size:11px;text-decoration:none;color:#fff;transition:transform .12s,border-color .12s}
.hf-move:hover,.hf-move:focus-visible{transform:translateX(2px);border-color:#ffd166;outline:none}
.hf-move:focus-visible{box-shadow:0 0 0 2px rgba(255,209,102,.6)}
.hf-mn{color:#fff;text-transform:uppercase;letter-spacing:.1em;font-weight:700;font-size:9px;min-width:0;flex:1}
.hf-mn small{display:block;color:#bbb;font-weight:400;font-size:9px;letter-spacing:0;text-transform:none;margin-top:2px;font-family:'JetBrains Mono',monospace;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf-md{font-family:'Bebas Neue',Inter,sans-serif;font-size:22px;color:#ffd166;text-shadow:0 0 8px currentColor;letter-spacing:.05em;line-height:1;flex-shrink:0;margin-left:8px}
.hf-foot{position:absolute;left:14px;right:14px;bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;z-index:10}
.hf-set{font-family:'Press Start 2P',monospace;font-size:7px;color:#ffd166;text-shadow:0 0 6px currentColor;line-height:1.4}
.hf-url{font-family:'JetBrains Mono',monospace;font-size:9px;color:#ccc}
.hf-sig{font-family:'Press Start 2P',monospace;font-size:7px;color:#ff5cc8;text-shadow:0 0 6px currentColor;letter-spacing:.1em;text-align:right;line-height:1.4}
.hf-desc{margin-top:32px;text-align:center;color:#bbb;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;max-width:480px}
.hf-desc strong{color:#ffd166;font-weight:700}
.hf-cta{margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.hf-btn{font-family:'Press Start 2P',monospace;font-size:10px;padding:12px 16px;background:#ffd166;color:#1a0a00;text-decoration:none;border-radius:6px;box-shadow:0 4px 0 #a17a00;letter-spacing:.05em;border:0;cursor:pointer}
.hf-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.hf-btn.cyan{background:#00f0ff;box-shadow:0 4px 0 #007a85}
.hf-btn.pink{background:#ff5cc8;box-shadow:0 4px 0 #88006c}
.hf-btn.blue{background:#0a66c2;color:#fff;box-shadow:0 4px 0 #003c7a}
@media(max-width:420px){.hf-card{transform:scale(.88) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transform-origin:top center}.hf-desc,.hf-cta{transform:scale(.95)}}
@media(prefers-reduced-motion:reduce){.hf-card{transition:none}body.style-holofoil::before{animation:none}}
</style>

<article class="hf-card" id="hfCard">
  <div class="hf-base"></div>
  <div class="hf-grain"></div>
  <div class="hf-foil"></div>
  <header class="hf-header">
    <span class="hf-arche">▸ ${archeSafe}<br>${yrs ? `· LV ${Math.min(99, yrs * 4)} ·` : '· LV ?? ·'}</span>
    <span class="hf-hp">${battle.build.value}<small>BUILD</small></span>
  </header>
  <div class="hf-frame">
    <span class="hf-fc hf-tl"></span>
    <span class="hf-fc hf-tr"></span>
    <span class="hf-fc hf-bl"></span>
    <span class="hf-fc hf-br"></span>
    <img src="${escapeAttr(profile.avatar_url)}" alt="${escapeAttr(profile.login)} avatar" referrerpolicy="no-referrer" />
  </div>
  <div class="hf-np">
    <span class="hf-nm">${cardName}<small>@${escapeHtml(profile.login)}${yrs ? ` · ${yrs} yr active` : ''}</small></span>
    <span class="hf-tier">${tierSafe} ★</span>
  </div>
  <div class="hf-moves">${moves}</div>
  <footer class="hf-foot">
    <span class="hf-set">SET 26-1<br>· ${(profile.public_repos % 999).toString().padStart(3, '0')}/${profile.public_repos} ·</span>
    <span class="hf-url">devprint.dev/${escapeHtml(target)}</span>
    <span class="hf-sig">★ HOLO ★<br>· FOIL ·</span>
  </footer>
</article>

<p class="hf-desc">Move your mouse over the card. The holographic foil tracks your cursor — rainbow rolls across the art and the angle tilts with you. <strong>Built to be screenshotted, GIF'd, and tweeted.</strong></p>

<div class="hf-cta">
  <a class="hf-btn" href="${escapeAttr(tweetUrl(tweetText))}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="hf-btn blue" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">↗ LINKEDIN</a>
  <button class="hf-btn cyan" type="button" data-action="save-png">📥 SAVE PNG</button>
  <button class="hf-btn pink" type="button" data-action="copy-link">📋 COPY</button>
</div>
`,
      mount(root) {
        const card = root.querySelector<HTMLElement>('#hfCard');
        if (!card) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const apply = (clientX: number, clientY: number) => {
          if (reduced) return;
          const r = card.getBoundingClientRect();
          const x = (clientX - r.left) / r.width;
          const y = (clientY - r.top) / r.height;
          // Clamp tilt to ±15deg — was ±28/22, which felt seasick.
          const ry = (x - 0.5) * 22;
          const rx = -(y - 0.5) * 16;
          card.style.setProperty('--rx', rx + 'deg');
          card.style.setProperty('--ry', ry + 'deg');
          card.style.setProperty('--mx', x * 100 + '%');
          card.style.setProperty('--my', y * 100 + '%');
          card.style.setProperty('--ang', (115 + x * 30) + 'deg');
        };
        const onMove = (e: MouseEvent) => apply(e.clientX, e.clientY);
        const onTouch = (e: TouchEvent) => { if (e.touches[0]) apply(e.touches[0].clientX, e.touches[0].clientY); };
        const reset = () => {
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
          card.style.setProperty('--mx', '50%');
          card.style.setProperty('--my', '50%');
        };
        // Bind to the card, not document — listening on document made the
        // card tilt anywhere on the page (haunted-feeling).
        card.addEventListener('mousemove', onMove);
        card.addEventListener('touchmove', onTouch, { passive: true });
        card.addEventListener('mouseleave', reset);
        card.addEventListener('touchend', reset);

        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn) return;
          flashLabel(saveBtn, '⏳ RENDERING…', 6000);
          // Briefly straighten the card so the export captures a flat foil.
          const prevX = card.style.getPropertyValue('--rx');
          const prevY = card.style.getPropertyValue('--ry');
          reset();
          await new Promise((r) => requestAnimationFrame(r));
          const ok = await saveAsPng(card, `devprint-holofoil-${target.replace(/\W+/g, '-')}.png`, '#0a0210');
          card.style.setProperty('--rx', prevX);
          card.style.setProperty('--ry', prevY);
          flashLabel(saveBtn, ok ? '✓ SAVED' : '✗ FAILED');
        };
        copyBtn?.addEventListener('click', onCopy);
        saveBtn?.addEventListener('click', onSave);

        return () => {
          card.removeEventListener('mousemove', onMove);
          card.removeEventListener('touchmove', onTouch);
          card.removeEventListener('mouseleave', reset);
          card.removeEventListener('touchend', reset);
          copyBtn?.removeEventListener('click', onCopy);
          saveBtn?.removeEventListener('click', onSave);
        };
      },
    };
  },
};

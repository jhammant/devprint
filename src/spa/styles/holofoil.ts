// v4 Holofoil — the trading card with mouse-tracked rainbow foil sheen.

import { escapeAttr, escapeHtml, shortStars, topRepos, yearsActive, type ProfileData, type StyleRenderer } from './types.ts';

export const holofoil: StyleRenderer = {
  id: 'holofoil',
  name: 'Holofoil',
  blurb: 'Trading card with mouse-tracked foil · share-as-grail',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target } = data;
    const tops = topRepos(data.repos, 4);
    const yrs = yearsActive(data.repos);
    const moves = tops.length
      ? tops.map((r, i) => {
          const prefix = ['★', '⚡', '↯', '◈'][i] ?? '◇';
          return `<a class="hf-move" href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><span class="hf-mn">${prefix} ${escapeHtml(r.name)} <small>${escapeHtml(r.description?.slice(0, 64) ?? '')}</small></span><span class="hf-md">${shortStars(r.stargazers_count)}</span></a>`;
        }).join('')
      : `<div class="hf-move"><span class="hf-mn">◈ portfolio <small>${profile.public_repos} public repos · ${profile.followers.toLocaleString()} followers</small></span><span class="hf-md">${shortStars(totalStars)}</span></div>`;

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Bebas+Neue&display=swap');
body.style-holofoil{background:#0a0210;color:#fff;font-family:Inter,ui-sans-serif,system-ui;display:flex;flex-direction:column;align-items:center;padding:24px 18px;perspective:2000px;min-height:100vh}
body.style-holofoil::before{content:"";position:fixed;inset:-30%;background:radial-gradient(ellipse at center,rgba(255,0,170,.15) 0%,rgba(0,240,255,.08) 30%,transparent 60%);animation:hf-drift 24s ease-in-out infinite alternate;z-index:-1;pointer-events:none}
@keyframes hf-drift{from{transform:translate(-2%,-2%) rotate(0deg)}to{transform:translate(2%,3%) rotate(8deg)}}
.hf-card{position:relative;width:380px;height:560px;border-radius:24px;cursor:grab;transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .08s ease-out;will-change:transform;margin-top:8px}
.hf-card:active{cursor:grabbing}
.hf-base{position:absolute;inset:0;border-radius:24px;background:linear-gradient(160deg,#1a0030 0%,#3a0a55 30%,#5a004a 60%,#0a0530 100%);border:3px solid #ffd166;box-shadow:0 40px 80px -10px rgba(255,0,170,.4),0 0 0 1px rgba(255,255,255,.08),inset 0 0 60px rgba(255,209,102,.05);overflow:hidden}
.hf-base::before{content:"";position:absolute;inset:6px;border:1px solid rgba(255,209,102,.35);border-radius:18px;pointer-events:none;z-index:5}
.hf-foil{position:absolute;inset:0;border-radius:24px;mix-blend-mode:color-dodge;background:radial-gradient(ellipse 350px 600px at var(--mx,50%) var(--my,50%),rgba(255,0,200,.7) 0%,rgba(255,200,0,.5) 18%,rgba(0,255,255,.4) 36%,rgba(180,0,255,.3) 54%,transparent 75%);filter:saturate(1.5) brightness(1.1);pointer-events:none;z-index:8;opacity:.95}
.hf-grain{position:absolute;inset:0;border-radius:24px;background:repeating-linear-gradient(var(--ang,115deg),rgba(255,255,255,.08) 0px,rgba(255,255,255,.08) 2px,transparent 2px,transparent 6px);mix-blend-mode:overlay;pointer-events:none;z-index:9}
.hf-header{position:absolute;left:14px;right:14px;top:14px;display:flex;justify-content:space-between;align-items:flex-start;z-index:10}
.hf-arche{font-family:'Press Start 2P',monospace;font-size:9px;color:#ffd166;text-shadow:0 0 8px currentColor;letter-spacing:.05em;line-height:1.5}
.hf-hp{font-family:'Bebas Neue',Inter,sans-serif;font-size:26px;color:#fff;letter-spacing:.05em;line-height:1;text-shadow:0 0 8px rgba(255,209,102,.8);text-align:right}
.hf-hp small{font-family:'Press Start 2P',monospace;font-size:9px;color:#ff5cc8;display:block;letter-spacing:.1em;margin-top:2px}
.hf-frame{position:absolute;left:24px;right:24px;top:62px;height:230px;border-radius:14px;overflow:hidden;border:3px solid #ffd166;box-shadow:0 0 24px rgba(255,209,102,.4),inset 0 0 20px rgba(0,0,0,.3);background:linear-gradient(135deg,#0a0530,#3a0a55);z-index:10}
.hf-frame::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.4),transparent 60%);z-index:2;pointer-events:none}
.hf-frame img{width:100%;height:100%;object-fit:cover;filter:saturate(1.1) contrast(1.05)}
.hf-fc{position:absolute;background:#ffd166;width:14px;height:14px;z-index:3}
.hf-tl{top:-2px;left:-2px;clip-path:polygon(0 0,100% 0,0 100%)}
.hf-tr{top:-2px;right:-2px;clip-path:polygon(0 0,100% 0,100% 100%)}
.hf-bl{bottom:-2px;left:-2px;clip-path:polygon(0 0,0 100%,100% 100%)}
.hf-br{bottom:-2px;right:-2px;clip-path:polygon(100% 0,100% 100%,0 100%)}
.hf-np{position:absolute;left:24px;right:24px;top:300px;height:60px;background:linear-gradient(90deg,rgba(0,0,0,.4),rgba(255,209,102,.2),rgba(0,0,0,.4));border-top:1px solid rgba(255,209,102,.5);border-bottom:1px solid rgba(255,209,102,.5);display:flex;align-items:center;justify-content:space-between;padding:0 14px;z-index:10}
.hf-nm{font-family:Inter,sans-serif;font-weight:900;font-size:22px;letter-spacing:-.02em;line-height:1;text-shadow:0 0 12px rgba(255,209,102,.5);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf-nm small{display:block;font-weight:400;font-size:11px;color:#ff5cc8;letter-spacing:.05em;margin-top:3px;text-shadow:0 0 6px currentColor}
.hf-tier{font-family:'Bebas Neue',Inter,sans-serif;font-size:22px;color:#000;background:linear-gradient(135deg,#ffd166,#ff7e3a);padding:6px 10px;border-radius:6px;letter-spacing:.05em;line-height:1;box-shadow:0 4px 12px rgba(255,126,58,.6)}
.hf-moves{position:absolute;left:24px;right:24px;top:380px;z-index:10}
.hf-move{display:flex;justify-content:space-between;align-items:baseline;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,209,102,.3);border-radius:8px;margin-bottom:5px;font-size:11px;text-decoration:none;color:#fff;transition:transform .12s,border-color .12s}
.hf-move:hover{transform:translateX(2px);border-color:#ffd166}
.hf-mn{color:#fff;text-transform:uppercase;letter-spacing:.1em;font-weight:700;font-size:9px}
.hf-mn small{display:block;color:#aaa;font-weight:400;font-size:9px;letter-spacing:0;text-transform:none;margin-top:2px;font-family:'JetBrains Mono',monospace;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf-md{font-family:'Bebas Neue',Inter,sans-serif;font-size:22px;color:#ffd166;text-shadow:0 0 8px currentColor;letter-spacing:.05em;line-height:1}
.hf-foot{position:absolute;left:14px;right:14px;bottom:14px;display:flex;justify-content:space-between;align-items:center;z-index:10}
.hf-set{font-family:'Press Start 2P',monospace;font-size:7px;color:#ffd166;text-shadow:0 0 6px currentColor}
.hf-url{font-family:'JetBrains Mono',monospace;font-size:9px;color:#aaa}
.hf-sig{font-family:'Press Start 2P',monospace;font-size:7px;color:#ff5cc8;text-shadow:0 0 6px currentColor;letter-spacing:.1em;text-align:right}
.hf-desc{margin-top:32px;text-align:center;color:#999;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;max-width:480px}
.hf-desc strong{color:#ffd166;font-weight:700}
.hf-cta{margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.hf-btn{font-family:'Press Start 2P',monospace;font-size:10px;padding:12px 16px;background:#ffd166;color:#1a0a00;text-decoration:none;border-radius:6px;box-shadow:0 4px 0 #a17a00;letter-spacing:.05em}
.hf-btn.cyan{background:#00f0ff;box-shadow:0 4px 0 #007a85}
.hf-btn.pink{background:#ff5cc8;box-shadow:0 4px 0 #88006c}
</style>

<article class="hf-card" id="hfCard">
  <div class="hf-base"></div>
  <div class="hf-grain"></div>
  <div class="hf-foil"></div>
  <header class="hf-header">
    <span class="hf-arche">▸ ${escapeHtml(archetype.replace(/\s/g, '<br>').toUpperCase())}<br>${yrs ? `· LV ${Math.min(99, yrs * 4)} ·` : '· LV ?? ·'}</span>
    <span class="hf-hp">${battle.build.value}/${battle.impact.value}<small>HP</small></span>
  </header>
  <div class="hf-frame">
    <span class="hf-fc hf-tl"></span>
    <span class="hf-fc hf-tr"></span>
    <span class="hf-fc hf-bl"></span>
    <span class="hf-fc hf-br"></span>
    <img src="${escapeAttr(profile.avatar_url)}" alt="" crossorigin="anonymous" />
  </div>
  <div class="hf-np">
    <span class="hf-nm">${isRepo ? escapeHtml(repo!.full_name) : escapeHtml(profile.name || profile.login)}<small>@${escapeHtml(profile.login)}${yrs ? ` · ${yrs} yr active` : ''}</small></span>
    <span class="hf-tier">${escapeHtml(battle.tier.toUpperCase())} ★</span>
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
  <a class="hf-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`My Devprint card · ${archetype} · ${battle.tier}. See yours at devprint.dev/${target}`)}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="hf-btn cyan" href="#" data-action="copy-link">📋 COPY</a>
</div>
`,
      mount(root) {
        const card = root.querySelector<HTMLElement>('#hfCard');
        if (!card) return;
        const inner = (e: { clientX: number; clientY: number }) => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          const y = (e.clientY - r.top) / r.height;
          const ry = (x - 0.5) * 28;
          const rx = -(y - 0.5) * 22;
          card.style.setProperty('--rx', rx + 'deg');
          card.style.setProperty('--ry', ry + 'deg');
          card.style.setProperty('--mx', x * 100 + '%');
          card.style.setProperty('--my', y * 100 + '%');
          card.style.setProperty('--ang', (115 + x * 30) + 'deg');
        };
        const move = (e: MouseEvent) => inner(e);
        const touch = (e: TouchEvent) => { if (e.touches[0]) inner(e.touches[0]); };
        const reset = () => {
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
          card.style.setProperty('--mx', '50%');
          card.style.setProperty('--my', '50%');
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', touch, { passive: true });
        document.addEventListener('mouseleave', reset);
        root.querySelector('[data-action="copy-link"]')?.addEventListener('click', (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href);
          const t = e.currentTarget as HTMLElement;
          const o = t.textContent ?? '';
          t.textContent = '📋 COPIED';
          setTimeout(() => (t.textContent = o), 1200);
        });
      },
    };
  },
};

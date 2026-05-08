// v1 Trading Card — Top-Trumps × Pokémon. Pure black, neon palette,
// scan-line CRT overlay, big tier badge, isometric repo tower.

import { escapeAttr, escapeHtml, relativeDate, shortStars, topRepos, yearsActive, type ProfileData, type StyleRenderer } from './types.ts';

export const tradingCard: StyleRenderer = {
  id: 'trading-card',
  name: 'Trading Card',
  blurb: 'Top Trumps × Pokémon · share-as-flex',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target } = data;
    const tops = topRepos(data.repos, 6);
    const yrs = yearsActive(data.repos);
    const tier = battle.tier.toLowerCase();
    const tierColor = tier === 'legendary' ? '#ffd166' : tier === 'epic' ? '#ff5cc8' : tier === 'rare' ? '#31d9ff' : '#7c5cff';
    const heights = [200, 140, 108, 90, 84, 80];
    const hueShifts = [0, 180, 280, 120, 220, 40];
    const isolated = isRepo ? `${escapeHtml(repo!.full_name)}` : `${escapeHtml(profile.name || profile.login)}`;
    const handle = isRepo ? '' : `@${escapeHtml(profile.login)}`;
    const blocks = tops.map((r, i) => {
      const h = heights[i] ?? 60;
      const hue = hueShifts[i] ?? 0;
      return `<a class="tc-block" href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer" style="--h:${h}px;--hue:${hue}deg" title="${escapeAttr(r.name)} · ★ ${r.stargazers_count}">
        <div class="tc-top"></div><div class="tc-front"></div><div class="tc-right"></div>
        <div class="tc-blbl">${escapeHtml(r.name)}<span>★ ${shortStars(r.stargazers_count)}</span></div>
      </a>`;
    }).join('');

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
body.style-trading-card{background:#000;color:#fff;font-family:Inter,ui-sans-serif,system-ui}
body.style-trading-card::before{content:"";position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,255,255,.025) 2px,rgba(255,255,255,.025) 3px);pointer-events:none;z-index:1000}
body.style-trading-card::after{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.6) 100%);pointer-events:none;z-index:999}
.tc-wrap{max-width:680px;margin:0 auto;padding:24px 18px}
.tc-card{position:relative;background:linear-gradient(160deg,#1a0e2e 0%,#0a0814 60%,#1f0c2d 100%);border:3px solid ${tierColor};border-radius:24px;box-shadow:0 0 40px ${tierColor}30,inset 0 0 80px ${tierColor}08}
.tc-card::before{content:"";position:absolute;inset:6px;border:1px solid ${tierColor}55;border-radius:18px;pointer-events:none}
.tc-head{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px;border-bottom:2px dashed ${tierColor}3f}
.tc-arche{font-family:'Press Start 2P',monospace;font-size:10px;color:#00f0ff;text-shadow:0 0 8px rgba(0,240,255,.6);margin-bottom:6px;letter-spacing:.05em}
.tc-name{font-size:30px;font-weight:900;letter-spacing:-.04em;line-height:1.05}
.tc-handle{color:#888;font-size:13px;margin-top:4px;font-family:'JetBrains Mono',monospace}
.tc-tier{font-family:'Press Start 2P',monospace;font-size:13px;background:linear-gradient(135deg,${tierColor},#ff7e3a);color:#1a0a00;padding:10px 14px;border-radius:8px;box-shadow:0 0 20px ${tierColor}b3;text-shadow:0 1px 0 rgba(255,255,255,.3);animation:tc-pulse 2.4s ease-in-out infinite}
@keyframes tc-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
.tc-portrait{display:flex;align-items:center;gap:18px;padding:24px;border-bottom:2px dashed ${tierColor}3f}
.tc-avatar{width:96px;height:96px;border-radius:8px;border:3px solid ${tierColor};box-shadow:0 0 24px ${tierColor}66;background:#222;flex-shrink:0;object-fit:cover}
.tc-tag{color:#ddd;font-size:14px;line-height:1.5;font-style:italic}
.tc-tag strong{color:#00f0ff;font-style:normal;font-weight:700}
.tc-stats{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:2px dashed ${tierColor}3f}
.tc-stat{padding:18px 12px;text-align:center;border-right:1px dashed ${tierColor}26}
.tc-stat:last-child{border-right:0}
.tc-stat b{font-family:'Press Start 2P',monospace;font-size:18px;color:${tierColor};text-shadow:0 0 12px ${tierColor}80;display:block;margin-bottom:6px}
.tc-stat span{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#888}
.tc-bat{padding:22px 24px;border-bottom:2px dashed ${tierColor}3f}
.tc-bat-ttl{font-family:'Press Start 2P',monospace;font-size:11px;color:#ff5cc8;text-shadow:0 0 8px rgba(255,92,200,.5);margin-bottom:14px}
.tc-bgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.tc-bs{background:${tierColor}10;border:1px solid ${tierColor}33;padding:10px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:baseline}
.tc-bs span{color:#888;text-transform:uppercase;font-size:9px;letter-spacing:.15em;font-weight:700}
.tc-bs b{font-family:'Press Start 2P',monospace;font-size:14px;color:#fff}
.tc-tower{padding:24px;border-bottom:2px dashed ${tierColor}3f}
.tc-tower h3{font-family:'Press Start 2P',monospace;font-size:11px;color:#00f0ff;text-shadow:0 0 8px rgba(0,240,255,.5);margin-bottom:24px}
.tc-iso{display:flex;justify-content:center;align-items:flex-end;gap:14px;height:160px;perspective:800px}
.tc-block{position:relative;width:60px;transform-style:preserve-3d;transform:rotateX(28deg) rotateY(-15deg);transition:transform .3s;text-decoration:none}
.tc-block:hover{transform:rotateX(28deg) rotateY(-15deg) translateY(-6px)}
.tc-top{position:absolute;width:60px;height:60px;background:linear-gradient(135deg,#ffd166,#ff7e3a);border:1px solid #fff;transform:rotateX(90deg) translateZ(30px);box-shadow:0 0 12px rgba(255,209,102,.4);filter:hue-rotate(var(--hue,0deg))}
.tc-front{position:absolute;width:60px;height:var(--h,60px);background:linear-gradient(180deg,#ff7e3a,#a13d00);border:1px solid #fff;left:0;bottom:0;transform:translateZ(30px);filter:hue-rotate(var(--hue,0deg))}
.tc-right{position:absolute;width:60px;height:var(--h,60px);background:linear-gradient(180deg,#a13d00,#5a1f00);border:1px solid #fff;left:0;bottom:0;transform:rotateY(90deg) translateZ(30px);transform-origin:right;filter:hue-rotate(var(--hue,0deg))}
.tc-blbl{position:absolute;left:50%;bottom:-26px;transform:translateX(-50%) rotateX(-28deg) rotateY(15deg);font-family:'JetBrains Mono',monospace;font-size:10px;color:#ffd166;white-space:nowrap;text-align:center;width:120px;text-decoration:none;pointer-events:none}
.tc-blbl span{display:block;color:#888;font-size:9px;margin-top:2px}
.tc-cta{padding:22px 24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.tc-cta-l{font-family:'Press Start 2P',monospace;font-size:9px;color:#888;letter-spacing:.1em;flex:1;min-width:160px}
.tc-btn{font-family:'Press Start 2P',monospace;font-size:10px;padding:10px 14px;background:${tierColor};color:#1a0a00;border:0;border-radius:6px;box-shadow:0 4px 0 #a17a00,0 0 16px ${tierColor}66;cursor:pointer;text-decoration:none;letter-spacing:.05em;transition:transform .1s,box-shadow .1s}
.tc-btn:hover{transform:translateY(2px);box-shadow:0 2px 0 #a17a00}
.tc-btn.cyan{background:#00f0ff;box-shadow:0 4px 0 #007a85}
.tc-btn.pink{background:#ff5cc8;box-shadow:0 4px 0 #88006c}
.tc-foot{padding:14px 24px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;display:flex;justify-content:space-between}
.tc-foot .ts{color:${tierColor}}
.tc-ribbon{position:absolute;top:18px;right:-30px;background:#ff5cc8;color:#000;padding:4px 36px;font-family:'Press Start 2P',monospace;font-size:8px;transform:rotate(45deg);letter-spacing:.1em;box-shadow:0 0 16px rgba(255,92,200,.5);z-index:5}
</style>

<div class="tc-wrap">
  <article class="tc-card">
    <div class="tc-ribbon">★ HIRE ME</div>
    <div class="tc-head">
      <div>
        <div class="tc-arche">▸ ${escapeHtml(archetype.toUpperCase())}${yrs ? ` · LV ${Math.min(99, yrs * 4)}` : ''}</div>
        <div class="tc-name">${isolated}</div>
        <div class="tc-handle">${handle}${yrs ? ` · ${yrs} yr active` : ''}</div>
      </div>
      <div class="tc-tier">${escapeHtml(battle.tier.toUpperCase())}</div>
    </div>

    <div class="tc-portrait">
      <img class="tc-avatar" src="${escapeAttr(profile.avatar_url)}" alt="" crossorigin="anonymous" />
      <div class="tc-tag">${isRepo ? `"${escapeHtml(repo!.description ?? 'A repository fingerprint.')}" Last push <strong>${relativeDate(repo!.pushed_at ?? repo!.updated_at)}</strong>.` : `"Public-builder. Maintains <strong>${profile.public_repos}</strong> repos. Last push <strong>${relativeDate(data.repos[0]?.pushed_at ?? data.repos[0]?.updated_at ?? new Date().toISOString())}</strong>."`}</div>
    </div>

    <div class="tc-stats">
      <div class="tc-stat"><b>${shortStars(isRepo ? (repo!.open_issues_count || 0) : profile.public_repos)}</b><span>${isRepo ? 'open issues' : 'repos'}</span></div>
      <div class="tc-stat"><b>${shortStars(totalStars)}</b><span>stars</span></div>
      <div class="tc-stat"><b>${shortStars(isRepo ? repo!.forks_count : profile.followers)}</b><span>${isRepo ? 'forks' : 'followers'}</span></div>
    </div>

    <div class="tc-bat">
      <div class="tc-bat-ttl">▶ BATTLE STATS</div>
      <div class="tc-bgrid">
        <div class="tc-bs"><span>Build</span><b>${battle.build.value}</b></div>
        <div class="tc-bs"><span>Impact</span><b>${battle.impact.value}</b></div>
        <div class="tc-bs"><span>Versatility</span><b>${battle.versatility.value}</b></div>
        <div class="tc-bs"><span>Momentum</span><b>${battle.momentum.value}</b></div>
        <div class="tc-bs"><span>Community</span><b>${battle.community.value}</b></div>
        <div class="tc-bs"><span>Originality</span><b>${battle.originality.value}</b></div>
      </div>
    </div>

    ${tops.length ? `<div class="tc-tower">
      <h3>▶ TOP DROPS</h3>
      <div class="tc-iso">${blocks}</div>
    </div>` : ''}

    <div class="tc-cta">
      <div class="tc-cta-l">▶ SHARE THIS CARD AS YOUR LIVING CV</div>
      <a class="tc-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`My Devprint card: ${archetype} (${battle.tier}). See yours: devprint.dev/${target}`)}" target="_blank" rel="noreferrer">↗ TWEET</a>
      <a class="tc-btn cyan" href="#" data-action="copy-link">📋 COPY</a>
      <a class="tc-btn pink" href="#" data-action="save-png">📥 PDF</a>
    </div>

    <div class="tc-foot">
      <span>devprint.dev/${escapeHtml(target)}</span>
      <span class="ts">SYNCED · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</span>
    </div>
  </article>
</div>
`,
      mount(root) {
        // Hook the action buttons up to the existing SPA functions.
        root.querySelector('[data-action="copy-link"]')?.addEventListener('click', (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href);
          (e.currentTarget as HTMLElement).textContent = '📋 COPIED';
          setTimeout(() => ((e.currentTarget as HTMLElement).textContent = '📋 COPY'), 1200);
        });
      },
    };
  },
};

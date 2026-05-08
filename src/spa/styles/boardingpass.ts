// v7 Dev Pass — boarding-pass aesthetic. White/teal pass, perforated stub
// on the right, ticket-stub barcode, JetBrains-mono labels.

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

export const boardingpass: StyleRenderer = {
  id: 'boardingpass',
  name: 'Dev Pass',
  blurb: 'Boarding pass · share-as-ticket',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, repos, langs } = data;
    const tops = topRepos(repos, 3);
    const yrs = yearsActive(repos);
    const topLang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mixed';
    const code = (profile.login || target).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'DEV';
    const flightNo = (profile.public_repos || 1) % 9999;
    const tweetText = `My Devprint Dev Pass · ${archetype} · ${battle.tier}. devprint.dev/${target}`;
    const bars = Array.from({ length: 56 }, () => '<i></i>').join('');

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@400;700&family=Bebas+Neue&display=swap');
body.style-boardingpass{background:#0c1018;color:#fff;font-family:Inter,ui-sans-serif,system-ui;padding:32px 16px;display:flex;flex-direction:column;align-items:center;min-height:100vh}
body.style-boardingpass::before{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at top,rgba(60,80,160,.22),transparent 50%);z-index:-1;pointer-events:none}
.bp-pass{width:100%;max-width:880px;display:flex;background:#fff;color:#111;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.1);position:relative}
.bp-body{flex:1;min-width:0}
.bp-head{padding:18px 24px 14px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;gap:14px}
.bp-brand{display:flex;align-items:center;gap:10px;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.06em;color:#0a4a6e;font-weight:400}
.bp-brand::before{content:"";display:block;width:22px;height:22px;background:#0a4a6e;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.bp-type{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#666;text-align:right;line-height:1.4}
.bp-type strong{color:#111;display:block;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.04em;line-height:1.2}
.bp-type .stamp{display:inline-block;background:#a02828;color:#fff;padding:3px 8px;border-radius:3px;font-weight:700;letter-spacing:.12em;margin-top:4px;font-size:9px}
.bp-row{padding:18px 24px;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;border-bottom:1px solid #ddd}
.bp-avatar{width:64px;height:64px;border-radius:8px;border:2px solid #0a4a6e;object-fit:cover;background:#eee}
.bp-name .lbl{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:#666}
.bp-name h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(28px,5vw,42px);letter-spacing:.03em;line-height:.95;color:#111;margin-top:2px;font-weight:400}
.bp-name .meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;margin-top:6px}
.bp-arche{text-align:right}
.bp-arche .lbl{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:#666}
.bp-arche .val{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.02em;color:#0a4a6e;line-height:.95;font-weight:400}
.bp-arche .tier{display:inline-block;background:linear-gradient(135deg,#ffb000,#ff7e3a);color:#1a0a00;padding:3px 8px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.12em;margin-top:6px}
.bp-itin{padding:18px 24px;display:grid;grid-template-columns:repeat(6,1fr);gap:18px;border-bottom:1px solid #ddd}
.bp-itin .item .lbl{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#666;margin-bottom:4px}
.bp-itin .item .val{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.04em;line-height:1;color:#111;font-weight:400}
.bp-itin .item .sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:#666;margin-top:2px}
.bp-tops{padding:14px 24px}
.bp-tops .lbl{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#666;margin-bottom:6px}
.bp-tops a{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dotted #ccc;text-decoration:none;color:#111;font-family:'JetBrains Mono',monospace;font-size:11px}
.bp-tops a:last-child{border-bottom:0}
.bp-tops a:hover{color:#0a4a6e}
.bp-tops a:focus-visible{outline:2px solid #0a4a6e;outline-offset:2px}
.bp-tops a span:last-child{color:#666}
.bp-stub{width:230px;background:#0a4a6e;color:#fff;flex-shrink:0;position:relative;padding:18px 18px 18px 26px;display:flex;flex-direction:column;justify-content:space-between}
.bp-stub::before{content:"";position:absolute;left:0;top:0;bottom:0;width:0;border-left:2px dashed rgba(255,255,255,.5);background-image:radial-gradient(circle at left center,#0c1018 0,#0c1018 5px,transparent 6px);background-size:14px 14px;background-repeat:repeat-y}
.bp-stub .row{margin-bottom:12px}
.bp-stub .row .lbl{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px}
.bp-stub .row .val{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.04em;line-height:1;font-weight:400}
.bp-stub .row .sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(255,255,255,.55);margin-top:2px;letter-spacing:.05em}
.bp-bar{display:flex;align-items:flex-end;height:40px;gap:1px;margin-top:8px;background:#fff;padding:6px 8px;border-radius:3px}
.bp-bar i{display:block;background:#0a4a6e;width:2px;height:100%}
.bp-bar i:nth-child(2n){width:1px;height:80%}
.bp-bar i:nth-child(3n){height:60%}
.bp-bar i:nth-child(7n){width:3px}
.bp-cta{margin-top:24px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.bp-btn{padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:#0c1018;background:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:700}
.bp-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.bp-btn.teal{background:#0a4a6e;color:#fff}
.bp-btn.gold{background:#ffb000;color:#1a0a00}
.bp-btn.line{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}
@media(max-width:740px){.bp-pass{flex-direction:column}.bp-stub{width:100%;flex-direction:row;flex-wrap:wrap}.bp-stub::before{left:0;right:0;top:0;width:100%;height:0;border-left:0;border-top:2px dashed rgba(255,255,255,.5);background-image:radial-gradient(circle at center top,#0c1018 0,#0c1018 5px,transparent 6px);background-size:14px 14px;background-repeat:repeat-x}.bp-itin{grid-template-columns:repeat(3,1fr)}}
</style>

<article class="bp-pass">
  <div class="bp-body">
    <div class="bp-head">
      <div class="bp-brand">DEVPRINT AIR</div>
      <div class="bp-type">${isRepo ? 'REPOSITORY PASS' : 'PORTFOLIO PASS'}<strong>BOARDING NOW</strong><span class="stamp">${escapeHtml(battle.tier.toUpperCase())}</span></div>
    </div>
    <div class="bp-row">
      <img class="bp-avatar" src="${escapeAttr(profile.avatar_url)}" alt="${escapeAttr(profile.login)} avatar" referrerpolicy="no-referrer" />
      <div class="bp-name">
        <span class="lbl">Passenger / Dev</span>
        <h2>${escapeHtml(profile.name || profile.login)}</h2>
        <div class="meta">@${escapeHtml(profile.login)} · ${profile.followers.toLocaleString()} followers · ${yrs ? `${yrs} yr active` : 'active'}</div>
      </div>
      <div class="bp-arche">
        <span class="lbl">Archetype</span>
        <div class="val">${escapeHtml(archetype.toUpperCase())}</div>
        <span class="tier">${escapeHtml(battle.tier.toUpperCase())} TIER</span>
      </div>
    </div>
    <div class="bp-itin">
      <div class="item"><div class="lbl">From</div><div class="val">${code}</div><div class="sub">${escapeHtml(topLang)}</div></div>
      <div class="item"><div class="lbl">Repos</div><div class="val">${profile.public_repos.toLocaleString()}</div><div class="sub">public</div></div>
      <div class="item"><div class="lbl">Stars</div><div class="val">${shortStars(totalStars)}</div><div class="sub">portfolio</div></div>
      <div class="item"><div class="lbl">Build</div><div class="val">${battle.build.value}</div><div class="sub">power</div></div>
      <div class="item"><div class="lbl">Impact</div><div class="val">${battle.impact.value}</div><div class="sub">score</div></div>
      <div class="item"><div class="lbl">Flight</div><div class="val">DP-${flightNo.toString().padStart(4, '0')}</div><div class="sub">today</div></div>
    </div>
    ${tops.length ? `<div class="bp-tops">
      <div class="lbl">★ TOP DESTINATIONS</div>
      ${tops.map((r) => `<a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(r.name)}</span><span>★ ${shortStars(r.stargazers_count)}</span></a>`).join('')}
    </div>` : ''}
  </div>
  <aside class="bp-stub">
    <div>
      <div class="row"><div class="lbl">Gate</div><div class="val">${code}-${flightNo.toString().padStart(2, '0').slice(0, 2)}</div></div>
      <div class="row"><div class="lbl">Seat</div><div class="val">${escapeHtml(battle.tier.slice(0, 1).toUpperCase())}1</div><div class="sub">${escapeHtml(battle.tier)} class</div></div>
      <div class="row"><div class="lbl">Boarding</div><div class="val">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</div><div class="sub">${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div></div>
    </div>
    <div>
      <div class="bp-bar">${bars}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.1em;color:rgba(255,255,255,.55);margin-top:6px;text-align:center">DEVPRINT.DEV/${escapeHtml(target.toUpperCase())}</div>
    </div>
  </aside>
</article>

<div class="bp-cta">
  <a class="bp-btn gold" href="${escapeAttr(tweetUrl(tweetText))}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="bp-btn teal" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">↗ LINKEDIN</a>
  <button class="bp-btn" type="button" data-action="save-png">📥 SAVE PNG</button>
  <button class="bp-btn line" type="button" data-action="copy-link">📋 COPY</button>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const pass = root.querySelector<HTMLElement>('.bp-pass');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !pass) return;
          flashLabel(saveBtn, '⏳ RENDERING…', 6000);
          const ok = await saveAsPng(pass, `devprint-pass-${target.replace(/\W+/g, '-')}.png`, '#fff');
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

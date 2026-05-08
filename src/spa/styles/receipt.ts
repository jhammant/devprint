// v10 Receipt — thermal-paper receipt aesthetic. Monospace everything,
// dotted dividers, total-due footer. Naturally portrait → great for IG/X.

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

export const receipt: StyleRenderer = {
  id: 'receipt',
  name: 'Receipt',
  blurb: 'Thermal-paper receipt · share-as-stub',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, repos, langs, themes } = data;
    const tops = topRepos(repos, 5);
    const yrs = yearsActive(repos);
    const langList = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tweetText = `My Devprint receipt · ${archetype} · ${battle.tier}. devprint.dev/${target}`;
    const orderId = (Math.abs((profile.public_repos || 1) * 31 + (profile.followers || 0)) % 999999).toString().padStart(6, '0');

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=VT323&family=JetBrains+Mono:wght@400;700&display=swap');
body.style-receipt{background:#1a1a1a;color:#fff;font-family:Inter,ui-sans-serif,system-ui;padding:32px 16px;display:flex;flex-direction:column;align-items:center;min-height:100vh}
body.style-receipt::before{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at center,rgba(255,255,255,.04),transparent 60%);z-index:-1;pointer-events:none}
.rc-paper{width:100%;max-width:380px;background:#f8f5ec;background-image:repeating-linear-gradient(0deg,transparent 0px,transparent 27px,rgba(0,0,0,.025) 27px,rgba(0,0,0,.025) 28px);color:#111;font-family:'JetBrains Mono',ui-monospace,monospace;padding:22px 22px 6px;box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.08);position:relative;clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),96% 100%,92% calc(100% - 8px),88% 100%,84% calc(100% - 8px),80% 100%,76% calc(100% - 8px),72% 100%,68% calc(100% - 8px),64% 100%,60% calc(100% - 8px),56% 100%,52% calc(100% - 8px),48% 100%,44% calc(100% - 8px),40% 100%,36% calc(100% - 8px),32% 100%,28% calc(100% - 8px),24% 100%,20% calc(100% - 8px),16% 100%,12% calc(100% - 8px),8% 100%,4% calc(100% - 8px),0 100%)}
.rc-paper::before{content:"";position:absolute;inset:0;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='30' cy='30' r='.5' fill='%23000' opacity='.12'/><circle cx='70' cy='60' r='.4' fill='%23000' opacity='.1'/></svg>") repeat;pointer-events:none}
.rc-h1{font-family:'VT323',ui-monospace,monospace;font-size:38px;text-align:center;letter-spacing:.04em;line-height:.95;margin-bottom:2px}
.rc-tagline{text-align:center;font-size:10px;color:#444;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px dashed #999;padding-bottom:10px;margin-bottom:10px}
.rc-meta{font-size:10px;color:#444;display:flex;justify-content:space-between;margin-bottom:12px;letter-spacing:.04em}
.rc-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;line-height:1.5;padding:2px 0}
.rc-row b{font-weight:700;color:#111}
.rc-row .dots{flex:1;border-bottom:1px dotted #aaa;margin:0 6px;align-self:flex-end;height:.7em}
.rc-section{margin:14px 0;border-top:1px dashed #999;padding-top:10px}
.rc-section .ttl{font-weight:700;font-size:11px;letter-spacing:.16em;text-transform:uppercase;text-align:center;margin-bottom:8px;color:#111}
.rc-tops a{display:flex;justify-content:space-between;text-decoration:none;color:#111;font-size:11px;padding:3px 0;border-bottom:1px dotted #ccc}
.rc-tops a:last-child{border-bottom:0}
.rc-tops a:hover{color:#a02828}
.rc-tops a:focus-visible{outline:2px solid #a02828;outline-offset:1px}
.rc-tops a span:first-child{max-width:64%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-total{display:flex;justify-content:space-between;align-items:baseline;font-family:'VT323',ui-monospace,monospace;font-size:24px;border-top:2px solid #111;border-bottom:2px solid #111;padding:10px 0;margin:14px 0 10px}
.rc-total b{font-size:30px;letter-spacing:.05em}
.rc-stamp{text-align:center;margin:8px 0;color:#a02828;font-family:'VT323',ui-monospace,monospace;font-size:32px;letter-spacing:.06em;border:3px double #a02828;padding:8px 12px;display:inline-block;width:100%;line-height:1}
.rc-stamp small{display:block;font-size:11px;letter-spacing:.18em;font-family:'JetBrains Mono',monospace;margin-top:2px;text-transform:uppercase}
.rc-bc{margin:12px 0 6px;text-align:center;font-family:'Libre Barcode 39',ui-monospace,monospace;font-size:42px;letter-spacing:.04em;color:#111}
.rc-foot{text-align:center;font-size:9px;color:#444;letter-spacing:.06em;border-top:1px dashed #999;padding-top:8px;margin-top:8px;line-height:1.5;text-transform:uppercase}
.rc-cta{margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.rc-btn{padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:#1a1a1a;background:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:700}
.rc-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.rc-btn.line{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}
@media(prefers-reduced-motion:reduce){.rc-paper{animation:none}}
</style>

<div class="rc-paper">
  <div class="rc-h1">DEVPRINT</div>
  <div class="rc-tagline">store #001 · open-source bureau</div>
  <div class="rc-meta">
    <span>${escapeHtml(new Date().toLocaleDateString('en-GB'))}</span>
    <span>#${orderId}</span>
    <span>${escapeHtml(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</span>
  </div>

  <div class="rc-row"><b>CUSTOMER</b><span class="dots"></span><b>${escapeHtml(profile.login.toUpperCase())}</b></div>
  <div class="rc-row"><span>name</span><span class="dots"></span><span>${escapeHtml((profile.name || profile.login).slice(0, 22))}</span></div>
  <div class="rc-row"><span>archetype</span><span class="dots"></span><span>${escapeHtml(archetype)}</span></div>

  <div class="rc-section">
    <div class="ttl">▸ Order summary</div>
    <div class="rc-row"><span>Public repos</span><span class="dots"></span><span>${profile.public_repos.toLocaleString()} × £1</span></div>
    <div class="rc-row"><span>Stars</span><span class="dots"></span><span>${totalStars.toLocaleString()} ★</span></div>
    <div class="rc-row"><span>Followers</span><span class="dots"></span><span>${profile.followers.toLocaleString()}</span></div>
    ${yrs ? `<div class="rc-row"><span>Years active</span><span class="dots"></span><span>${yrs} yr</span></div>` : ''}
  </div>

  <div class="rc-section">
    <div class="ttl">▸ Battle stats</div>
    <div class="rc-row"><span>Build</span><span class="dots"></span><b>${battle.build.value}</b></div>
    <div class="rc-row"><span>Impact</span><span class="dots"></span><b>${battle.impact.value}</b></div>
    <div class="rc-row"><span>Versatility</span><span class="dots"></span><b>${battle.versatility.value}</b></div>
    <div class="rc-row"><span>Momentum</span><span class="dots"></span><b>${battle.momentum.value}</b></div>
    <div class="rc-row"><span>Community</span><span class="dots"></span><b>${battle.community.value}</b></div>
    <div class="rc-row"><span>Originality</span><span class="dots"></span><b>${battle.originality.value}</b></div>
  </div>

  ${langList.length ? `<div class="rc-section">
    <div class="ttl">▸ Stack mix</div>
    ${langList.map(([l, c]) => `<div class="rc-row"><span>${escapeHtml(l)}</span><span class="dots"></span><span>${c} repo${c === 1 ? '' : 's'}</span></div>`).join('')}
  </div>` : ''}

  ${tops.length ? `<div class="rc-section rc-tops">
    <div class="ttl">▸ Top items</div>
    ${tops.map((r) => `<a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(r.name)}</span><span>★ ${shortStars(r.stargazers_count)}</span></a>`).join('')}
  </div>` : ''}

  <div class="rc-total"><span>TIER</span><b>${escapeHtml(battle.tier.toUpperCase())}</b></div>

  <div class="rc-foot">
    Thank you for shipping<br>
    devprint.dev/${escapeHtml(target)}<br>
    paid via public commits · no refunds
  </div>
</div>

<div class="rc-cta">
  <a class="rc-btn" href="${escapeAttr(tweetUrl(tweetText))}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="rc-btn" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer" style="background:#0a66c2;color:#fff">↗ LINKEDIN</a>
  <button class="rc-btn" type="button" data-action="save-png">📥 SAVE PNG</button>
  <button class="rc-btn line" type="button" data-action="copy-link">📋 COPY</button>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const paper = root.querySelector<HTMLElement>('.rc-paper');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !paper) return;
          flashLabel(saveBtn, '⏳ RENDERING…', 6000);
          const ok = await saveAsPng(paper, `devprint-receipt-${target.replace(/\W+/g, '-')}.png`, '#f8f5ec');
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

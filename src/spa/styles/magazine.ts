// v5 Magazine — editorial cover. Big avatar, screaming masthead, cover lines.

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

export const magazine: StyleRenderer = {
  id: 'magazine',
  name: 'Magazine',
  blurb: 'Editorial cover · share-as-front-page',
  takeover: true,
  render(data) {
    const { profile, isRepo, repo, totalStars, battle, archetype, target, repos, themes } = data;
    const tops = topRepos(repos, 4);
    const yrs = yearsActive(repos);
    const tweetText = `On the cover of Devprint Monthly · ${archetype} · ${battle.tier}. devprint.dev/${target}`;
    const issue = ((profile.public_repos || 1) % 999).toString().padStart(3, '0');
    const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return {
      html: `
<style>
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Bodoni+Moda:wght@400;700;900&family=Inter:wght@400;700;900&display=swap');
body.style-magazine{background:#0a0a08;color:#fff;font-family:Inter,ui-sans-serif,system-ui;padding:32px 16px;display:flex;flex-direction:column;align-items:center;min-height:100vh}
body.style-magazine::before{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at top,rgba(255,90,40,.15),transparent 50%);z-index:-1;pointer-events:none}
.mg-cover{width:100%;max-width:560px;aspect-ratio:3/4;background:linear-gradient(135deg,#ff5a28,#ff7e3a 30%,#ffb000 70%,#fff8d8);position:relative;overflow:hidden;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.7)}
.mg-cover::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 70%,rgba(0,0,0,.2),transparent 60%);pointer-events:none}
.mg-mast{position:absolute;top:18px;left:0;right:0;text-align:center;font-family:'Anton',sans-serif;font-size:clamp(48px,11vw,84px);letter-spacing:-.01em;line-height:.9;color:#fff8d8;text-shadow:0 4px 0 #1a1a1a;z-index:5}
.mg-mast small{display:block;font-family:Inter,sans-serif;font-size:11px;letter-spacing:.32em;font-weight:700;color:#fff;text-shadow:none;margin-top:6px;text-transform:uppercase}
.mg-portrait{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:80%;height:74%;background:no-repeat center/cover;mask-image:linear-gradient(180deg,#000 70%,transparent 100%);-webkit-mask-image:linear-gradient(180deg,#000 70%,transparent 100%);z-index:2}
.mg-strap{position:absolute;left:14px;top:120px;font-family:'Anton',sans-serif;font-size:38px;letter-spacing:-.01em;line-height:.95;color:#1a1a1a;max-width:48%;z-index:6}
.mg-strap em{font-style:italic;color:#a02828}
.mg-strap small{display:block;font-family:Inter,sans-serif;font-style:normal;font-weight:700;font-size:14px;letter-spacing:.04em;color:#1a1a1a;margin-top:6px;text-transform:none;line-height:1.3}
.mg-coverlines{position:absolute;left:14px;top:340px;display:flex;flex-direction:column;gap:6px;z-index:6;max-width:42%}
.mg-coverlines .cl{background:#1a1a1a;color:#fff8d8;padding:5px 9px;font-family:Inter,sans-serif;font-weight:900;font-size:13px;letter-spacing:-.01em;text-transform:uppercase;line-height:1.2}
.mg-coverlines .cl em{font-style:italic;color:#ffb000}
.mg-rb{position:absolute;right:14px;top:130px;background:#a02828;color:#fff8d8;padding:8px 14px;font-family:'Anton',sans-serif;font-size:36px;letter-spacing:.02em;line-height:.9;transform:rotate(8deg);box-shadow:0 4px 0 #1a1a1a;z-index:7;text-align:center}
.mg-rb small{display:block;font-family:Inter,sans-serif;font-size:9px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;margin-top:2px}
.mg-issue{position:absolute;bottom:14px;left:14px;font-family:Inter,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#1a1a1a;font-weight:700;z-index:6}
.mg-bar{position:absolute;bottom:14px;right:14px;font-family:'Libre Barcode 39',monospace;font-size:36px;color:#1a1a1a;z-index:6;letter-spacing:.05em}
.mg-spread{margin-top:24px;width:100%;max-width:560px;background:#1a1a1a;color:#fff8d8;padding:24px;border-radius:6px;font-family:'Bodoni Moda',serif}
.mg-spread h2{font-family:'Anton',sans-serif;font-size:32px;letter-spacing:-.01em;line-height:1;margin-bottom:14px;color:#ffb000}
.mg-spread .sub{font-family:Inter,sans-serif;font-style:italic;font-size:13px;color:rgba(255,248,216,.7);margin-bottom:16px;max-width:46ch}
.mg-spread ol{list-style:none;padding:0;margin:0}
.mg-spread li{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,248,216,.16);align-items:baseline}
.mg-spread li:last-child{border-bottom:0}
.mg-spread a{color:#fff8d8;text-decoration:none;font-family:'Bodoni Moda',serif;font-size:18px;font-weight:700;font-style:italic}
.mg-spread a:hover{color:#ffb000}
.mg-spread a:focus-visible{outline:2px solid #ffb000;outline-offset:2px}
.mg-spread .meta{font-family:Inter,sans-serif;font-size:11px;color:rgba(255,248,216,.55);font-style:normal;letter-spacing:.04em}
.mg-cta{margin-top:24px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.mg-btn{padding:10px 14px;font-family:Inter,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;color:#1a1a1a;background:#ffb000;border:0;border-radius:4px;cursor:pointer;font-weight:900}
.mg-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.mg-btn.red{background:#a02828;color:#fff8d8}
.mg-btn.line{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}
@media(max-width:540px){.mg-strap{font-size:28px;top:96px}.mg-coverlines{top:260px}.mg-rb{font-size:24px;top:100px}}
</style>

<div class="mg-cover" id="mgCover">
  <div class="mg-mast">DEVPRINT<small>· monthly · open-source bureau ·</small></div>
  <div class="mg-portrait" style="background-image:url('${escapeAttr(profile.avatar_url)}')"></div>
  <div class="mg-strap">${escapeHtml((profile.name || profile.login).split(' ')[0] ?? profile.login)}<br><em>${escapeHtml((profile.name || profile.login).split(' ').slice(1).join(' ') || profile.login)}</em><small>${escapeHtml(archetype)}, ${yrs ? `${yrs} years in` : 'building publicly'}.</small></div>
  <div class="mg-coverlines">
    <div class="cl">★ ${profile.public_repos.toLocaleString()} repos · ${shortStars(totalStars)} stars · <em>${escapeHtml(battle.tier.toUpperCase())}</em></div>
    <div class="cl">▶ Build power <em>${battle.build.value}</em> · impact <em>${battle.impact.value}</em></div>
    ${themes.length ? `<div class="cl">${escapeHtml(themes.slice(0, 2).map(([t]) => t).join(' · ').toUpperCase())}</div>` : ''}
  </div>
  <div class="mg-rb">${battle.build.value}<small>BUILD</small></div>
  <div class="mg-issue">ISSUE No. ${issue} · ${escapeHtml(month.toUpperCase())} · £4.95</div>
  <div class="mg-bar">*DP${escapeHtml(target.replace(/\W+/g, '').toUpperCase().slice(0, 6))}*</div>
</div>

${tops.length ? `<div class="mg-spread">
  <h2>Inside this issue</h2>
  <p class="sub">A four-part feature on the work that's been keeping ${escapeHtml(profile.login)} up at night.</p>
  <ol>
    ${tops.map((r, i) => `<li><a href="${escapeAttr(r.html_url)}" target="_blank" rel="noreferrer">${(i + 1).toString().padStart(2, '0')} · ${escapeHtml(r.name)}</a><span class="meta">★ ${shortStars(r.stargazers_count)}</span></li>`).join('')}
  </ol>
</div>` : ''}

<div class="mg-cta">
  <a class="mg-btn" href="${escapeAttr(tweetUrl(tweetText))}" target="_blank" rel="noreferrer">↗ TWEET</a>
  <a class="mg-btn red" href="${escapeAttr(linkedinShareUrl())}" target="_blank" rel="noreferrer">↗ LINKEDIN</a>
  <button class="mg-btn" type="button" data-action="save-png" style="background:#fff;color:#1a1a1a">📥 SAVE PNG</button>
  <button class="mg-btn line" type="button" data-action="copy-link">📋 COPY</button>
</div>
`,
      mount(root) {
        const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-link"]');
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-action="save-png"]');
        const cover = root.querySelector<HTMLElement>('#mgCover');
        const onCopy = (e: Event) => {
          e.preventDefault();
          navigator.clipboard.writeText(location.href).catch(() => {});
          if (copyBtn) flashLabel(copyBtn, '📋 COPIED');
        };
        const onSave = async (e: Event) => {
          e.preventDefault();
          if (!saveBtn || !cover) return;
          flashLabel(saveBtn, '⏳ RENDERING…', 6000);
          const ok = await saveAsPng(cover, `devprint-cover-${target.replace(/\W+/g, '-')}.png`, '#ff5a28');
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

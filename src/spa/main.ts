import './styles.css';
import {
  BATTLE_FORMULAS,
  archetype,
  battleStats,
  cleanTarget,
  createGitHubClient,
  getThemes,
  rankDetected,
  scoreRepo,
  summariseThemes,
  type CommitActivityWeek,
  type DetectedTech,
  type GhRepo,
  type GhUser,
  type Insights,
  type RelatedProfile,
  type StackInference,
} from '../analysis/index.ts';
import { STYLE_LIST, getStyle } from './styles/index.ts';
import type { ProfileData } from './styles/index.ts';

// SPA-side GitHub client: unauthenticated, browser-native fetch. The visual
// card data is fetched directly from GitHub (~2 calls/render). The agent pack
// is NOT built client-side — that would double the GitHub calls and quickly
// burn the 60/hr per-IP unauth limit. Instead we fetch the pre-built pack
// from our agent endpoint, which uses a server-side token.
const client = createGitHubClient({ userAgent: 'Devprint-SPA/0.1' });

const AGENT_ORIGIN =
  // In prod, agents.devprint.dev is a different host. Locally / on the dev
  // CloudFront, fall back to "/agents-pack/<target>.md" via Lambda Function
  // URL — but for now we only run prod with the dual-host setup, so just use
  // the canonical agent host.
  location.hostname === 'devprint.dev' || location.hostname === 'www.devprint.dev'
    ? 'https://agents.devprint.dev'
    : '';

/**
 * Fire-and-forget hit to our cookieless analytics beacon. Same backend the
 * other hammant.io sites use; namespace by site (`devprint.dev`) and use the
 * path to record what's being viewed (e.g. `/build/sindresorhus?style=letterhead`).
 * No PII, no cookies. Errors are swallowed — analytics must never break a render.
 */
function track(path: string): void {
  try {
    const url =
      'https://echo.ai.hammant.io/analytics/t.gif' +
      `?s=${encodeURIComponent(location.hostname)}` +
      `&p=${encodeURIComponent(path)}` +
      `&r=${encodeURIComponent(document.referrer || 'direct')}` +
      `&_=${Date.now()}`;
    new Image().src = url;
  } catch {
    /* analytics failures are silent on purpose */
  }
}

async function fetchAgentPack(target: string): Promise<string> {
  const path = `/${target}.md`;
  const url = AGENT_ORIGIN ? `${AGENT_ORIGIN}${path}` : path;
  const r = await fetch(url, { headers: { Accept: 'text/markdown' } });
  if (!r.ok) throw new Error(`Agent pack fetch failed: ${r.status}`);
  return r.text();
}

async function fetchInsights(target: string): Promise<Insights | undefined> {
  // The JSON sidecar carries the structured data the human-mode panels
  // need (stack chips, commit heatmap, commit-style line). Built once on the
  // Lambda and CloudFront-cached so we don't burn the SPA's unauthenticated
  // 60/hr GitHub budget rebuilding it client-side.
  const path = `/${target}.json`;
  const url = AGENT_ORIGIN ? `${AGENT_ORIGIN}${path}` : path;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return undefined;
    return (await r.json()) as Insights;
  } catch {
    return undefined;
  }
}

type Mode = 'human' | 'agent';

const app = document.querySelector<HTMLDivElement>('#app')!;
let currentMode: Mode = location.hostname.startsWith('agents.') || location.pathname.startsWith('/agents/') ? 'agent' : 'human';
let lastPack = '';

// In-place style switch state. After a successful build() we cache the
// resolved ProfileData so the picker can re-render under a different
// renderer without a full page reload (or another GitHub round-trip).
let lastProfileData: ProfileData | null = null;
let lastStyleUnmount: (() => void) | null = null;
let lastTarget = '';
// Tracks which target's dashboard markup is currently in the DOM under
// #result. Lets applyStyle('default') skip a re-render when the dashboard
// is already there (just unmount the takeover and it reappears instantly).
let dashboardRenderedFor: string | null = null;

// First-paint protection: if the URL already names a target, throw the
// loader up *before* we set #app's innerHTML. Without this, the browser
// paints the hero/intro chrome for one frame between innerHTML being set
// and build() reaching showLoader() — that's the "I briefly see the main
// intro bit" flash. showLoader is a function declaration so it's hoisted
// and safe to call here. Idempotent: build() will call it again later.
const _bootTarget = (location.pathname || '').replace(/^\/agents\/?/, '').replace(/^\/+|\/+$/g, '');
if (_bootTarget && _bootTarget !== 'customise.html' && !_bootTarget.startsWith('prototypes')) {
  showLoader(_bootTarget);
}

app.innerHTML = `
<div class="wrap">
  <nav class="nav"><div class="brand"><div class="mark"></div><span id="brandText">Devprint</span></div><div class="navlinks"><button class="modebtn" id="humanMode" type="button">Show-off card</button><button class="modebtn" id="agentMode" type="button">Agent pack</button><div class="pill">GitHub user or repo → useful artefact</div></div></nav>
  <section class="hero">
    <div><div class="eyebrow" id="eyebrow"></div><h1 class="h1" id="heroTitle"></h1><p class="lead" id="heroLead"></p><form class="search" id="form"><input id="target" placeholder="github.com/jhammant or jhammant/factcheck" autocomplete="off" /><button id="go">Generate</button></form><div class="examples"><span class="chip" data-target="jhammant">jhammant</span><span class="chip" data-target="jhammant/factcheck">jhammant/factcheck</span><span class="chip" data-target="sindresorhus">sindresorhus</span><span class="chip" data-target="facebook/react">facebook/react</span></div><div class="loading" id="loading">Fetching public GitHub data and building the artefact…</div><div class="error" id="error"></div></div>
    <div class="preview"><div class="mini"><div class="orbit"><div class="node" style="width:82px;height:82px;left:45%;top:43%"></div><div class="node" style="width:42px;height:42px;left:20%;top:56%;background:linear-gradient(135deg,var(--green),var(--cyan))"></div><div class="node" style="width:56px;height:56px;left:76%;top:35%;background:linear-gradient(135deg,var(--pink),var(--amber))"></div><div class="node" style="width:32px;height:32px;left:68%;top:75%"></div></div></div></div>
  </section>
  <section class="result" id="result"><div class="grid"><aside class="card"><div class="profile"><img class="avatar" id="avatar" alt="" crossorigin="anonymous"><div><div class="name" id="displayName"></div><div class="muted" id="handle"></div></div></div><div class="stats"><div class="stat"><b id="repoCount">–</b><span class="muted" id="stat1Label">repos</span></div><div class="stat"><b id="stars">–</b><span class="muted">stars</span></div><div class="stat"><b id="followers">–</b><span class="muted" id="stat3Label">followers</span></div></div><hr style="border:0;border-top:1px solid rgba(255,255,255,.09);margin:18px 0"><div class="muted" id="archetypeLabel">Builder archetype</div><div class="archetype" id="archetype">–</div><p class="insight" id="summary"></p><div class="trump"><div class="trump-head"><div class="trump-title" id="battleTitle">Builder Battle Card</div><div class="trump-badge" id="trumpTier">Rare</div></div><div class="trump-grid"><div class="trump-stat" id="tcBuildBox" data-stat="build"><span>Build Power</span><b id="tcBuild">–</b></div><div class="trump-stat" id="tcImpactBox" data-stat="impact"><span>Impact</span><b id="tcImpact">–</b></div><div class="trump-stat" id="tcVersBox" data-stat="versatility"><span>Versatility</span><b id="tcVersatility">–</b></div><div class="trump-stat" id="tcMomentumBox" data-stat="momentum"><span>Momentum</span><b id="tcMomentum">–</b></div><div class="trump-stat" id="tcCommunityBox" data-stat="community"><span>Community</span><b id="tcCommunity">–</b></div><div class="trump-stat" id="tcOriginalityBox" data-stat="originality"><span>Originality</span><b id="tcOriginality">–</b></div></div><div class="trump-special" id="tcSpecial"></div></div></aside><div class="card"><div class="section-title"><h2 id="mainPanelTitle">Builder graph</h2><div class="copyrow"><button class="share" id="copyAgent">Copy pack</button><button class="share" id="share">Copy link</button><button class="share" id="savePng" title="Download battle card as PNG">Save PNG</button><button class="share" id="tweet" title="Share on X">Tweet</button><button class="share share-primary" id="nativeShare" title="Open share sheet">Share</button></div></div><div class="canvas" id="graph"></div><pre class="agentpack hidden" id="agentPack"></pre></div></div><div class="card" id="insightsCard" style="margin-top:18px"><div class="section-title"><h2>Insights</h2><div class="muted" id="insightsTagline" style="font-size:13px"></div></div><div class="insights" id="insights"></div></div><div class="card hidden" id="stackCard" style="margin-top:18px"><div class="section-title"><h2 id="stackTitle">Detected stack</h2><span class="muted" id="stackSubtitle" style="font-size:12px"></span></div><div id="stackBody"></div></div><div class="card hidden" id="commitCard" style="margin-top:18px"><div class="section-title"><h2>Commit style</h2><span class="muted" id="commitMeta" style="font-size:12px"></span></div><div id="commitBody"></div></div><div class="card hidden" id="heatmapCard" style="margin-top:18px"><div class="section-title"><h2 id="heatmapTitle">Commit heatmap, last 52 weeks</h2><span class="muted" id="heatmapMeta" style="font-size:12px"></span></div><div class="diag" id="heatmapDiag"></div></div><div class="card hidden" id="relatedCard" style="margin-top:18px"><div class="section-title"><h2 id="relatedTitle">Often building with</h2><span class="muted" id="relatedMeta" style="font-size:12px"></span></div><div id="relatedBody"></div></div><div class="grid2" id="userActivityRow" style="margin-top:18px"><div class="card"><div class="section-title"><h2>Activity, last 24 months</h2><span class="muted" id="activityCaption" style="font-size:12px"></span></div><div class="diag" id="activityDiag"></div></div><div class="card"><div class="section-title"><h2>Repo health</h2><span class="muted" style="font-size:12px">stars × recency × forks</span></div><div class="diag" id="healthDiag"></div></div></div><div class="grid2"><div class="card"><div class="section-title"><h2>Strengths with evidence</h2></div><div class="bars" id="strengths"></div></div><div class="card"><div class="section-title"><h2>Theme clusters</h2></div><div class="tags" id="themes"></div></div></div><div class="card" style="margin-top:18px"><div class="section-title"><h2 id="projectsTitle">Most interesting public projects</h2></div><div class="repos" id="repos"></div></div></section>
  <div class="footer">Static-first MVP. Deployed on AWS via SST. Agent endpoint at <code>agents.devprint.dev</code>.</div>
</div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const langColors: Record<string, string> = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3776ab', Go: '#00add8',
  Rust: '#dea584', Swift: '#f05138', Kotlin: '#a97bff', Java: '#f89820',
  Ruby: '#cc342d', PHP: '#777bb4', HTML: '#e34c26', CSS: '#663399',
  Shell: '#89e051', C: '#555', 'C++': '#f34b7d',
};

function pathTarget() {
  return location.pathname.replace(/^\/agents\/?/, '').replace(/^\/+|\/+$/g, '');
}

function setMode(m: Mode) {
  currentMode = m;
  $('humanMode').classList.toggle('active', m === 'human');
  $('agentMode').classList.toggle('active', m === 'agent');
  $('brandText').textContent = m === 'agent' ? 'Agents.Devprint' : 'Devprint';
  $('eyebrow').textContent = m === 'agent' ? 'github in → agent context pack out' : 'profile in → fingerprint out';
  $('heroTitle').textContent = m === 'agent' ? 'Give coding agents instant repo context.' : 'See the shape of any developer’s work.';
  $('heroLead').textContent = m === 'agent'
    ? 'Paste a GitHub user or repo and generate an AGENTS.md-style brief: overview, stack clues, likely commands, repo map, risks, and starter prompts.'
    : 'Paste a GitHub user or repo and Devprint turns public GitHub data into a visual profile, Top Trumps-style builder card, and shareable fingerprint.';
  $('go').textContent = m === 'agent' ? 'Generate pack' : 'Generate';
}

async function build(raw: string, scroll = true) {
  $('loading').style.display = 'none';
  $('error').style.display = 'none';
  $('result').classList.remove('show');
  ($('go') as HTMLButtonElement).disabled = true;
  showLoader(cleanTarget(raw) || raw);
  setLoaderStatus('Fetching profile…', 8);

  try {
    const target = cleanTarget(raw);
    if (!target) throw new Error('Enter a GitHub username, profile URL, or owner/repo');
    ($('target') as HTMLInputElement).value = target;

    const bits = target.split('/').filter(Boolean);
    const isRepo = bits.length >= 2;
    const owner = bits[0];
    const repoName = bits[1];

    const profile = await client.getUser(owner);
    setLoaderStatus(`Found @${profile.login} · ${profile.public_repos} public repos`, 22);
    let reposRaw: GhRepo[];
    let repo: GhRepo | undefined;
    if (isRepo) {
      setLoaderStatus(`Reading ${owner}/${repoName}…`, 32);
      repo = await client.getRepo(owner, repoName);
      reposRaw = [repo];
    } else {
      setLoaderStatus(`Listing up to 100 of ${profile.public_repos} repos…`, 32);
      reposRaw = await client.listUserRepos(owner, { max: 100 });
    }
    setLoaderStatus(`Scoring ${reposRaw.length} repos · detecting stacks…`, 52);

    const repos = reposRaw.filter((r) => !r.fork || isRepo).sort((a, b) => scoreRepo(b) - scoreRepo(a));
    const langs: Record<string, number> = {};
    repos.forEach((r) => {
      if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
    });
    const totalStars = repos.reduce((n, r) => n + r.stargazers_count, 0);
    const topLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const themes = getThemes(repos);
    const arch = isRepo ? `${repo?.language ?? 'Mixed'} Repo` : archetype(langs, repos);
    const battle = battleStats(profile, repos, langs, totalStars, themes, repo);

    // Style takeover: when ?style=<id> is set, fetch the pack + insights, then
    // hand off to the chosen renderer instead of running the default flow.
    // The "letterhead" view is the new default — visiting `/<user>` lands
    // there. Pass `?style=default` (or `?style=dashboard`) to opt back into
    // the original full-dashboard layout.
    const rawStyleId = new URLSearchParams(location.search).get('style');
    const styleId = rawStyleId ?? 'letterhead';
    const renderer = currentMode === 'agent' ? null : getStyle(styleId);
    const styleQuery = rawStyleId ? `?style=${rawStyleId}` : '';
    history.replaceState(null, '', `${currentMode === 'agent' ? `/agents/${target}` : `/${target}`}${styleQuery}`);
    // Per-render hit so the analytics dashboard sees which profiles + styles
    // are getting traffic, not just landing-page visits. Path keeps the
    // shape `/build/<target>?style=<id>` so it groups cleanly.
    track(`/build/${target}${styleQuery}`);

    setLoaderStatus(`Pulling agent pack + insights from Lambda…`, 70);
    const [packResult, insights] = await Promise.all([
      fetchAgentPack(target).catch(() => undefined),
      fetchInsights(target),
    ]);
    lastPack = packResult ?? `# Devprint Agent Pack: ${target}\n\nThe agent pack endpoint is currently unreachable. Try again in a moment.\n`;
    setLoaderStatus('Drawing the card…', 92);

    const data: ProfileData = {
      profile, repo, isRepo, repos, topLangs, langs, themes, archetype: arch,
      totalStars, battle,
      ...(insights ? { insights } : {}),
      ...(insights?.profileExtra ? { profileExtra: insights.profileExtra } : {}),
      pack: lastPack, target,
    };
    lastProfileData = data;
    lastTarget = target;

    if (renderer) {
      mountStyle(renderer, data);
      hideLoader();
      ($('go') as HTMLButtonElement).disabled = false;
      return;
    }

    renderDashboard(target, data, scroll);
  } catch (e) {
    $('error').textContent = e instanceof Error ? e.message : String(e);
    $('error').style.display = 'block';
    hideLoader();
  } finally {
    $('loading').style.display = 'none';
    ($('go') as HTMLButtonElement).disabled = false;
    hideLoader();
  }
}

// ---- full-screen loader (initial render + style takeover) -----------------

function showLoader(target: string): void {
  let el = document.getElementById('dpLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dpLoader';
    el.innerHTML = `
      <div class="dpL-bg"></div>
      <div class="dpL-mark"></div>
      <div class="dpL-target" id="dpLTarget"></div>
      <div class="dpL-status" id="dpLStatus">Initialising…</div>
      <div class="dpL-bar"><div class="dpL-fill" id="dpLFill"></div></div>
      <div class="dpL-tip" id="dpLTip">tip · use <kbd>?style=letterhead</kbd> to switch view</div>
    `;
    document.body.appendChild(el);
    if (!document.getElementById('dpLoaderStyle')) {
      const s = document.createElement('style');
      s.id = 'dpLoaderStyle';
      s.textContent = `
#dpLoader{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,ui-sans-serif,system-ui;color:#fff;opacity:0;animation:dpL-in .25s ease-out forwards}
.dpL-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(124,92,255,.32),transparent 40%),radial-gradient(ellipse at 75% 80%,rgba(49,217,255,.24),transparent 45%),linear-gradient(180deg,#070913 0%,#0a0d18 60%,#070913 100%);z-index:-1}
.dpL-bg::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
.dpL-mark{width:88px;height:88px;border-radius:24px;background:conic-gradient(from 210deg,#31d9ff,#7c5cff,#ff5cc8,#ffd166,#62f0a7,#31d9ff);box-shadow:0 0 60px rgba(124,92,255,.5),inset 0 0 0 4px rgba(0,0,0,.3);animation:dpL-spin 2.4s linear infinite,dpL-pulse 2s ease-in-out infinite alternate;margin-bottom:30px;position:relative}
.dpL-mark::before{content:"";position:absolute;inset:14px;background:#070913;border-radius:14px}
.dpL-mark::after{content:"D";position:absolute;inset:14px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:34px;letter-spacing:-.05em;background:linear-gradient(135deg,#fff,#aaa);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
@keyframes dpL-spin{to{transform:rotate(360deg)}}
@keyframes dpL-pulse{from{box-shadow:0 0 50px rgba(124,92,255,.4),inset 0 0 0 4px rgba(0,0,0,.3)}to{box-shadow:0 0 90px rgba(255,92,200,.55),inset 0 0 0 4px rgba(0,0,0,.3)}}
.dpL-target{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#62f0a7;margin-bottom:10px;text-shadow:0 0 12px rgba(98,240,167,.5)}
.dpL-status{font-weight:700;font-size:18px;letter-spacing:-.01em;margin-bottom:24px;text-align:center;max-width:80vw;min-height:1.4em;transition:opacity .2s}
.dpL-bar{width:280px;max-width:80vw;height:6px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;position:relative}
.dpL-bar::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);animation:dpL-shimmer 1.5s linear infinite;background-size:200% 100%}
@keyframes dpL-shimmer{from{background-position:-100% 0}to{background-position:100% 0}}
.dpL-fill{height:100%;background:linear-gradient(90deg,#31d9ff,#7c5cff,#ff5cc8);border-radius:99px;width:0%;transition:width .4s cubic-bezier(.2,.8,.2,1);box-shadow:0 0 18px rgba(124,92,255,.5)}
.dpL-tip{margin-top:30px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#888;letter-spacing:.04em}
.dpL-tip kbd{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);padding:2px 6px;border-radius:4px;color:#fff;font-family:inherit;font-size:10px}
@keyframes dpL-in{from{opacity:0}to{opacity:1}}
@keyframes dpL-out{from{opacity:1}to{opacity:0}}
#dpLoader.dpL-leaving{animation:dpL-out .35s ease-out forwards}
@media(prefers-reduced-motion:reduce){.dpL-mark{animation:dpL-pulse 3s ease-in-out infinite alternate}.dpL-bar::before{animation:none}}
`;
      document.head.appendChild(s);
    }
  }
  el.classList.remove('dpL-leaving');
  el.style.display = 'flex';
  const targetEl = document.getElementById('dpLTarget');
  if (targetEl) targetEl.textContent = `▸ ${target}`;
  // Rotating tips while we wait.
  const tips = [
    'tip · top-right picker switches between 10 different styles',
    'tip · <kbd>?style=letterhead</kbd> is a printable CV',
    'tip · <kbd>?style=holofoil</kbd> tilts to your mouse',
    'tip · <kbd>?style=receipt</kbd> screenshots well for IG stories',
    'tip · <kbd>?style=vinyl</kbd> turns your portfolio into an LP',
    'tip · <kbd>/&lt;user&gt;.md</kbd> is the agent context pack',
  ];
  const tipEl = document.getElementById('dpLTip');
  if (tipEl) {
    tipEl.innerHTML = tips[0];
    let i = 1;
    const id = setInterval(() => {
      if (!document.getElementById('dpLoader') || document.getElementById('dpLoader')!.style.display === 'none') {
        clearInterval(id);
        return;
      }
      tipEl.style.opacity = '0';
      setTimeout(() => { tipEl.innerHTML = tips[i % tips.length]; tipEl.style.opacity = '.7'; i++; }, 200);
    }, 3200);
  }
}

function setLoaderStatus(text: string, pct: number): void {
  const status = document.getElementById('dpLStatus');
  const fill = document.getElementById('dpLFill');
  if (status) status.textContent = text;
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function hideLoader(): void {
  const el = document.getElementById('dpLoader');
  if (!el) return;
  setLoaderStatus('Done', 100);
  el.classList.add('dpL-leaving');
  setTimeout(() => { el.style.display = 'none'; }, 380);
}

function renderProfile(
  profile: GhUser, repo: GhRepo | undefined, isRepo: boolean,
  totalStars: number, arch: string, themes: ReturnType<typeof getThemes>,
  repos: GhRepo[], topLangs: [string, number][],
) {
  $('avatar').setAttribute('src', profile.avatar_url);
  // Display name is now a clickable link to the canonical GitHub URL —
  // either the user's profile or the repo. innerHTML (not textContent) so the
  // anchor renders as a real link.
  if (isRepo) {
    $('displayName').innerHTML = `<a href="https://github.com/${escapeAttr(repo!.full_name)}" target="_blank" rel="noreferrer">${escapeHtml(repo!.full_name)}</a>`;
  } else {
    $('displayName').innerHTML = `<a href="https://github.com/${escapeAttr(profile.login)}" target="_blank" rel="noreferrer">${escapeHtml(profile.name || profile.login)}</a>`;
  }
  $('handle').textContent = isRepo ? (repo!.description || 'Repository fingerprint') : '@' + profile.login;
  $('repoCount').textContent = isRepo ? String(repo!.open_issues_count || 0) : String(profile.public_repos);
  $('stat1Label').textContent = isRepo ? 'open issues' : 'repos';
  $('stars').textContent = String(totalStars);
  $('followers').textContent = isRepo ? String(repo!.forks_count) : String(profile.followers);
  $('stat3Label').textContent = isRepo ? 'forks' : 'followers';
  $('archetypeLabel').textContent = isRepo ? 'Repo archetype' : 'Builder archetype';
  $('archetype').textContent = arch;
  const top = topLangs.slice(0, 3).map((x) => x[0]).join(', ') || 'multiple stacks';
  // Honest disclosure when the analysis hits the 100-repo cap.
  const truncationNote = !isRepo && repos.length >= 100 && profile.public_repos > 100
    ? ` (top ${repos.length} of ${profile.public_repos} by recency)`
    : '';
  $('summary').textContent = isRepo
    ? `${repo!.full_name} looks like a ${arch.toLowerCase()} with ${repo!.stargazers_count} stars, ${repo!.forks_count} forks, and recent activity last seen ${new Date(repo!.pushed_at ?? repo!.updated_at).toLocaleDateString()}.`
    : `${profile.name || profile.login} looks like a ${arch.toLowerCase()} working mostly across ${top}. The public footprint points to ${themes[0]?.[0]?.toLowerCase() || 'practical'} work, with ${repos.length} non-fork repos analysed${truncationNote}.`;
}

function renderBattleCard(b: ReturnType<typeof battleStats>, isRepo: boolean) {
  $('tcBuild').textContent = String(b.build.value);
  $('tcImpact').textContent = String(b.impact.value);
  $('tcVersatility').textContent = String(b.versatility.value);
  $('tcMomentum').textContent = String(b.momentum.value);
  $('tcCommunity').textContent = String(b.community.value);
  $('tcOriginality').textContent = String(b.originality.value);
  $('trumpTier').textContent = b.tier;
  $('battleTitle').textContent = isRepo ? 'Repo Battle Card' : 'Builder Battle Card';
  $('tcSpecial').textContent = `Special move: ${isRepo ? 'gives agents a clean starting brief' : 'keeps building until it works'}.`;
  // Surface the formula as a tooltip on each stat. Without this the 0-99
  // numbers read like LinkedIn buzzword bingo — opening the formula makes
  // the scale legible (and lets viewers spot the structural bias against
  // private-repo work).
  $('tcBuildBox').setAttribute('title', BATTLE_FORMULAS.build);
  $('tcImpactBox').setAttribute('title', BATTLE_FORMULAS.impact);
  $('tcVersBox').setAttribute('title', BATTLE_FORMULAS.versatility);
  $('tcMomentumBox').setAttribute('title', BATTLE_FORMULAS.momentum);
  $('tcCommunityBox').setAttribute('title', BATTLE_FORMULAS.community);
  $('tcOriginalityBox').setAttribute('title', BATTLE_FORMULAS.originality);
  // Drive tier-based glow + badge colour via a data attribute the CSS targets.
  const trump = document.querySelector('.trump');
  if (trump) trump.setAttribute('data-tier', b.tier.toLowerCase());
}

function renderStrengths(topLangs: [string, number][]) {
  $('strengths').innerHTML = topLangs.length
    ? topLangs.map(([l, c]) =>
        `<div class="barline"><span>${l}</span><div class="bar"><div class="fill" style="width:${Math.max(12, Math.round(c / topLangs[0][1] * 100))}%;background:linear-gradient(90deg,${langColors[l] || '#31d9ff'},#7c5cff)"></div></div><b>${c}</b></div>`,
      ).join('')
    : '<p class="muted">No language data found.</p>';
}

function renderThemes(themes: ReturnType<typeof getThemes>) {
  // Cap at top-3 (or collapse to "Generalist" when 5+ themes match) so the
  // tags stay informative instead of becoming "every category, no signal".
  const summarised = themes.length ? summariseThemes(themes, 3) : ([['Open source', 1], ['Builder', 1]] as const);
  $('themes').innerHTML = summarised.map(([t, n]) => `<span class="tag">${t} · ${n}</span>`).join('');
}

function renderRepos(repos: GhRepo[], isRepo: boolean) {
  $('projectsTitle').textContent = isRepo ? 'Repository facts' : 'Most interesting public projects';
  $('repos').innerHTML = repos.slice(0, 6).map((r) => {
    const accent = langColors[r.language ?? ''] ?? '#31d9ff';
    return `<a class="repo" href="${r.html_url}" target="_blank" rel="noreferrer" style="--accent:${accent}"><b>${r.name}</b><p>${r.description || 'No description yet.'}</p><small>${r.language || 'Mixed'} · ★ ${r.stargazers_count} · updated ${new Date(r.updated_at).toLocaleDateString()}</small></a>`;
  }).join('');
}

// ── derived insight panels ─────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function renderInsights(profile: GhUser, repos: GhRepo[], totalStars: number) {
  // Build a name → full_name lookup once so the markBold below can swap a
  // bolded repo name (e.g. **awesome**) for a real link.
  const repoByName = new Map(repos.map((r) => [r.name, r.full_name] as const));
  const linkBold = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, (_m, name: string) => {
      const full = repoByName.get(name);
      return full
        ? `<a href="https://github.com/${escapeAttr(full)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(name)}</strong></a>`
        : `<strong>${escapeHtml(name)}</strong>`;
    });
  const now = Date.now();
  const dayMs = 86_400_000;

  // Most recent push.
  const newest = repos
    .map((r) => new Date(r.updated_at).getTime())
    .sort((a, b) => b - a)[0];
  const daysSince = newest ? Math.round((now - newest) / dayMs) : Number.POSITIVE_INFINITY;
  const recencyText = daysSince < 1 ? 'today' : daysSince === 1 ? 'yesterday' : daysSince < 30 ? `${daysSince} days ago` : daysSince < 365 ? `${Math.round(daysSince / 30)} months ago` : `${Math.round(daysSince / 365)} years ago`;

  // Star concentration: how much of total stars sits in the top repo.
  const sortedByStars = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
  const topStarRepo = sortedByStars[0];
  const topRepoShare = topStarRepo && totalStars > 0 ? topStarRepo.stargazers_count / totalStars : 0;
  const concentrationText =
    totalStars === 0
      ? 'Stars: none yet — this profile flies under the radar.'
      : topRepoShare > 0.7
        ? `Specialist signal: ${Math.round(topRepoShare * 100)}% of all ${totalStars} stars sit in **${topStarRepo!.name}** alone.`
        : topRepoShare > 0.4
          ? `Concentrated: ${Math.round(topRepoShare * 100)}% of stars are in **${topStarRepo!.name}**, with the rest spread across the portfolio.`
          : `Generalist signal: stars are spread across the portfolio (top repo holds ${Math.round(topRepoShare * 100)}%).`;

  // Maintenance: % of repos updated in the last year.
  const yearAgo = now - 365 * dayMs;
  const maintainedCount = repos.filter((r) => new Date(r.updated_at).getTime() > yearAgo).length;
  const maintainedPct = repos.length > 0 ? Math.round((maintainedCount / repos.length) * 100) : 0;
  const maintenanceText =
    maintainedPct >= 70
      ? `Active maintainer: ${maintainedPct}% of public repos updated in the last 12 months.`
      : maintainedPct >= 30
        ? `Mixed maintenance: ${maintainedPct}% of public repos saw an update in the last year — older repos are likely experiments.`
        : `Mostly archive: only ${maintainedPct}% of public repos updated in the last 12 months. Treat older repos as historical.`;

  // Peak month — most repos updated in a single calendar month over the last 24.
  const buckets = new Array(24).fill(0);
  const dNow = new Date();
  for (const r of repos) {
    const d = new Date(r.updated_at);
    const monthsAgo = (dNow.getFullYear() - d.getFullYear()) * 12 + (dNow.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < 24) buckets[23 - monthsAgo]++;
  }
  const peakIdx = buckets.indexOf(Math.max(...buckets));
  const peakDate = new Date(dNow.getFullYear(), dNow.getMonth() - (23 - peakIdx), 1);
  const peakLabel = `${MONTH_NAMES[peakDate.getMonth()]} ${peakDate.getFullYear()}`;
  const peakCount = buckets[peakIdx];
  const peakText = peakCount > 0 ? `Peak month: **${peakLabel}** (${peakCount} repo${peakCount === 1 ? '' : 's'} updated).` : '';

  // Diversity: number of distinct primary languages, weighted by repo count.
  const langCount = new Set(repos.map((r) => r.language).filter(Boolean)).size;
  const breadthText = langCount >= 6
    ? `Breadth: works comfortably across **${langCount} languages**.`
    : langCount >= 3
      ? `Cross-stack: regular use of **${langCount} languages**.`
      : `Focused: primarily ships in ${langCount} language${langCount === 1 ? '' : 's'}.`;

  // Forks they pull (signs of being part of larger ecosystems).
  const forkCount = repos.filter((r) => r.fork).length;
  const forkText = forkCount > 0 ? `Forks ${forkCount} project${forkCount === 1 ? '' : 's'} — engages with others' code.` : null;

  const tagline = `Last push ${recencyText} · ${profile.public_repos} public repos · ${totalStars.toLocaleString()} stars`;
  $('insightsTagline').textContent = tagline;

  const insights = [concentrationText, maintenanceText, peakText, breadthText, forkText].filter(Boolean) as string[];
  $('insights').innerHTML = insights
    .map((t) => `<div class="insight-line">${linkBold(t)}</div>`)
    .join('');
}

function renderActivity(insights: Insights | undefined) {
  // Old version bucketed repos by `updated_at` and produced a single huge bar
  // for prolific maintainers (every result clustered in the most recent
  // month). This version uses real /stats/commit_activity from the JSON
  // sidecar — for users it's the sum across the top 3 repos, for repos it's
  // the single repo. If the sidecar didn't return data (e.g. cold cache or
  // private repo) we hide the card rather than fall back to the old chart.
  const card = document.querySelector<HTMLElement>('#userActivityRow > div:first-child');
  const ca = insights?.commitActivity;
  if (!ca || ca.length === 0) {
    if (card) card.classList.add('hidden');
    return;
  }
  if (card) card.classList.remove('hidden');

  // Bucket the 52 weeks into 12 months so the chart stays readable.
  const dNow = new Date();
  const buckets: { count: number; label: string; monthKey: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(dNow.getFullYear(), dNow.getMonth() - (11 - i), 1);
    buckets.push({
      count: 0,
      label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      monthKey: `${d.getFullYear()}-${d.getMonth()}`,
    });
  }
  for (const w of ca) {
    const d = new Date(w.week * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const bucket = buckets.find((b) => b.monthKey === key);
    if (bucket) bucket.count += w.total;
  }

  const W = 600;
  const H = 140;
  const months = buckets.length;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const peakIdx = buckets.findIndex((b) => b.count === max);
  const padding = 28;
  const innerW = W - padding * 2;
  const bw = innerW / months;
  const baseline = H - 28;

  const cleanBars = buckets
    .map((b, i) => {
      const h = b.count === 0 ? 3 : Math.max(4, (b.count / max) * (baseline - 18));
      const x = padding + i * bw + 1;
      const y = baseline - h;
      const fill = b.count === 0 ? 'rgba(255,255,255,0.07)' : i === peakIdx ? '#ffd166' : 'url(#dpActGrad)';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}"><title>${b.label}: ${b.count} commits</title></rect>`;
    })
    .join('');

  const labelOf = (i: number, x: number) =>
    `<text x="${x.toFixed(1)}" y="${(baseline + 16).toFixed(1)}" fill="rgba(255,255,255,0.55)" font-size="10" text-anchor="middle">${buckets[i].label}</text>`;
  const axisLabels = [
    labelOf(0, padding + bw / 2),
    labelOf(months - 1, padding + (months - 1) * bw + bw / 2),
    peakIdx !== 0 && peakIdx !== months - 1 ? labelOf(peakIdx, padding + peakIdx * bw + bw / 2) : '',
  ].join('');

  const peakX = padding + peakIdx * bw + bw / 2;
  const peakY = baseline - Math.max(4, (baseline - 18)) - 6;
  const peakAnnotation = max > 0 ? `<text x="${peakX.toFixed(1)}" y="${peakY.toFixed(1)}" fill="#ffd166" font-size="10" font-weight="800" text-anchor="middle">${max}</text>` : '';

  $('activityDiag').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="diag-svg" role="img" aria-label="Commits per month over the last 12 months">
      <defs>
        <linearGradient id="dpActGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#31d9ff"/>
          <stop offset="100%" stop-color="#7c5cff"/>
        </linearGradient>
      </defs>
      <line x1="${padding}" x2="${W - padding}" y1="${baseline}" y2="${baseline}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      ${cleanBars}
      ${peakAnnotation}
      ${axisLabels}
    </svg>`;

  $('activityCaption').textContent =
    `peak ${buckets[peakIdx].label}, ${max} commits${insights?.commitActivitySource ? ` · source: ${insights.commitActivitySource}` : ''}`;
  // The activity card title needs to reflect that this is real commit data
  // not "repos updated", and the timespan changed from 24 months to 12.
  const titleEl = card?.querySelector('h2');
  if (titleEl) titleEl.textContent = 'Commits per month, last 12 months';
}

function renderHealth(repos: GhRepo[]) {
  // The previous version used `updated_at` for the y-axis (recency). For
  // prolific maintainers every bubble clamped to the top of the chart. Two
  // fixes:
  //  1. Prefer `pushed_at` (last commit) over `updated_at` (any metadata).
  //  2. If even with pushed_at ≥80% of bubbles still cluster within 30 days,
  //     swap the y-axis to scoreRepo() (which incorporates engagement).
  // Also: hide the card entirely when subset < 3 — a near-empty chart shipped
  // for repo pages and looked broken.
  const card = document.querySelector<HTMLElement>('#userActivityRow > div:nth-child(2)');

  const subset = [...repos]
    .filter((r) => !r.fork)
    .sort((a, b) => scoreRepo(b) - scoreRepo(a))
    .slice(0, 30);

  if (subset.length < 3) {
    if (card) card.classList.add('hidden');
    return;
  }
  if (card) card.classList.remove('hidden');

  const W = 600;
  const H = 240;
  const padL = 40;
  const padR = 20;
  const padT = 14;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const dNow = Date.now();
  const dayMs = 86_400_000;

  const tsOf = (r: GhRepo) => new Date(r.pushed_at ?? r.updated_at).getTime();
  const recencyDays = (r: GhRepo) => Math.min(730, (dNow - tsOf(r)) / dayMs);
  const clusteredAtTop = subset.filter((r) => recencyDays(r) < 30).length / subset.length;

  // When recency clusters too tightly, swap the y-axis to scoreRepo() so the
  // chart still has spread. We label it "score" and explain in the caption.
  const useScoreAxis = clusteredAtTop >= 0.8;
  const scoreMax = useScoreAxis ? Math.max(1, ...subset.map((r) => scoreRepo(r))) : 0;

  const xVal = (r: GhRepo) => Math.log2(r.stargazers_count + 1);
  const xMax = Math.max(4, ...subset.map(xVal));
  const yVal = (r: GhRepo) =>
    useScoreAxis
      ? 1 - scoreRepo(r) / scoreMax  // 0 = highest score (top), 1 = lowest (bottom)
      : recencyDays(r) / 730;

  const points = subset
    .map((r) => {
      const x = padL + (xVal(r) / xMax) * innerW;
      const y = padT + yVal(r) * innerH;
      const radius = Math.max(4, Math.min(18, 4 + Math.log2(r.forks_count + 1) * 2.5));
      const color = langColors[r.language ?? ''] ?? '#7c5cff';
      const safeName = escapeXml(r.name);
      const safeFull = escapeAttr(r.full_name);
      const lastDate = (r.pushed_at ?? r.updated_at).slice(0, 10);
      return `<a href="https://github.com/${safeFull}" target="_blank" rel="noreferrer"><g class="health-pt"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="1.5"/><title>${safeName} · ★ ${r.stargazers_count} · ${r.forks_count} forks · last push ${lastDate}</title></g></a>`;
    })
    .join('');

  const xAxisLabels = [0, 1, 2, 3, 4]
    .map((p) => {
      const x = padL + (p / 4) * innerW;
      const stars = Math.round(Math.pow(2, (p / 4) * xMax) - 1);
      return `<text x="${x.toFixed(1)}" y="${(H - 14).toFixed(1)}" fill="rgba(255,255,255,0.55)" font-size="10" text-anchor="middle">${stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}★</text>`;
    })
    .join('');

  const yLabels = useScoreAxis
    ? ['top', 'mid', 'low']
        .map((lbl, i) => {
          const y = padT + (i / 2) * innerH;
          return `<text x="${(padL - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" fill="rgba(255,255,255,0.55)" font-size="10" text-anchor="end">${lbl}</text>`;
        })
        .join('')
    : [0, 90, 365, 730]
        .map((days) => {
          const y = padT + (days / 730) * innerH;
          const lbl = days === 0 ? 'now' : days < 365 ? `${days}d` : `${Math.round(days / 365)}y`;
          return `<text x="${(padL - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" fill="rgba(255,255,255,0.55)" font-size="10" text-anchor="end">${lbl}</text>`;
        })
        .join('');

  const cornerLabels = useScoreAxis
    ? `<text x="${padL + 4}" y="${padT + 14}" fill="rgba(98,240,167,0.7)" font-size="10" font-weight="700">popular &amp; engaged</text>
       <text x="${(W - padR - 4).toFixed(1)}" y="${padT + innerH - 4}" text-anchor="end" fill="rgba(255,107,107,0.6)" font-size="10" font-weight="700">long tail</text>`
    : `<text x="${padL + 4}" y="${padT + 14}" fill="rgba(98,240,167,0.7)" font-size="10" font-weight="700">popular &amp; active</text>
       <text x="${(W - padR - 4).toFixed(1)}" y="${padT + innerH - 4}" text-anchor="end" fill="rgba(255,107,107,0.6)" font-size="10" font-weight="700">popular but stale</text>`;

  $('healthDiag').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="diag-svg" role="img" aria-label="Repo health scatter chart">
      <line x1="${padL}" x2="${W - padR}" y1="${padT}" y2="${padT}" stroke="rgba(255,255,255,0.06)"/>
      <line x1="${padL}" x2="${W - padR}" y1="${(padT + innerH / 2).toFixed(1)}" y2="${(padT + innerH / 2).toFixed(1)}" stroke="rgba(255,255,255,0.06)"/>
      <line x1="${padL}" x2="${padL}" y1="${padT}" y2="${padT + innerH}" stroke="rgba(255,255,255,0.12)"/>
      <line x1="${padL}" x2="${W - padR}" y1="${padT + innerH}" y2="${padT + innerH}" stroke="rgba(255,255,255,0.12)"/>
      ${cornerLabels}
      ${points}
      ${xAxisLabels}
      ${yLabels}
    </svg>`;

  // Also update the caption next to the title to reflect the y-axis choice.
  const captionEl = card?.querySelector<HTMLElement>('.section-title .muted');
  if (captionEl) {
    captionEl.textContent = useScoreAxis
      ? 'stars × overall score — every repo is recently maintained'
      : 'stars × recency × forks';
  }
}

function renderGraph(topLangs: [string, number][], themes: ReturnType<typeof getThemes>, arch: string) {
  const graph = $('graph');
  const W = 600;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2;

  const langs = topLangs.slice(0, 8);
  const ts = themes.slice(0, 6);
  const langN = Math.max(1, langs.length);
  const themeN = Math.max(1, ts.length);
  const maxLang = Math.max(...langs.map(([, c]) => c), 1);
  const maxTheme = Math.max(...ts.map(([, c]) => c), 1);

  // Languages on the inner orbit, themes on the outer one. Theme angles are
  // offset so the two layers visually interleave instead of stacking.
  const langPositions = langs.map(([name, count], i) => {
    const angle = (i / langN) * Math.PI * 2 - Math.PI / 2;
    const r = 110;
    const size = 22 + (count / maxLang) * 18;
    return {
      name,
      count,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      size,
      color: langColors[name] || '#31d9ff',
    };
  });
  const themePositions = ts.map(([name, count], i) => {
    const angle = (i / themeN) * Math.PI * 2 - Math.PI / 2 + Math.PI / themeN;
    const r = 162;
    const size = 18 + (count / maxTheme) * 8;
    return {
      name,
      count,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      size,
    };
  });

  const archParts = arch.split(' ');
  const archLine1 = archParts.length > 1 ? archParts[0] : arch;
  const archLine2 = archParts.length > 1 ? archParts.slice(1).join(' ') : '';

  const themeLines = themePositions
    .map((t) => `<line x1="${cx}" y1="${cy}" x2="${t.x.toFixed(1)}" y2="${t.y.toFixed(1)}" stroke="rgba(98,240,167,0.22)" stroke-width="1" stroke-dasharray="2 5"/>`)
    .join('');

  const langLines = langPositions
    .map((l) => `<line x1="${cx}" y1="${cy}" x2="${l.x.toFixed(1)}" y2="${l.y.toFixed(1)}" stroke="${l.color}" stroke-opacity="0.4" stroke-width="1.5"/>`)
    .join('');

  const themeNodes = themePositions
    .map((t) => `
      <g class="bg-theme" transform="translate(${t.x.toFixed(1)},${t.y.toFixed(1)})">
        <circle r="${t.size}" fill="rgba(7,9,19,0.88)" stroke="rgba(98,240,167,0.55)" stroke-width="1.4"/>
        <text text-anchor="middle" dy="4" fill="rgba(220,255,235,0.95)" font-size="11" font-weight="700">${escapeXml(t.name)}</text>
      </g>`)
    .join('');

  const langNodes = langPositions
    .map((l) => `
      <g class="bg-lang" transform="translate(${l.x.toFixed(1)},${l.y.toFixed(1)})">
        <circle r="${l.size + 4}" fill="${l.color}" fill-opacity="0.10"/>
        <circle r="${l.size}" fill="rgba(7,9,19,0.92)" stroke="${l.color}" stroke-width="2"/>
        <text text-anchor="middle" dy="4" fill="white" font-size="11" font-weight="800">${escapeXml(l.name)}</text>
      </g>`)
    .join('');

  graph.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="builder-graph" role="img" aria-label="Builder graph for ${escapeXml(arch)}">
      <defs>
        <radialGradient id="dpBgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(124,92,255,0.32)"/>
          <stop offset="55%" stop-color="rgba(124,92,255,0.06)"/>
          <stop offset="100%" stop-color="rgba(124,92,255,0)"/>
        </radialGradient>
        <radialGradient id="dpHubFill" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.20)"/>
          <stop offset="55%" stop-color="rgba(124,92,255,0.42)"/>
          <stop offset="100%" stop-color="rgba(49,217,255,0.30)"/>
        </radialGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="170" fill="url(#dpBgGlow)"/>
      <circle cx="${cx}" cy="${cy}" r="110" fill="none" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2 5"/>
      <circle cx="${cx}" cy="${cy}" r="162" fill="none" stroke="rgba(255,255,255,0.04)" stroke-dasharray="2 5"/>
      ${themeLines}
      ${langLines}
      ${themeNodes}
      ${langNodes}
      <g class="bg-hub">
        <circle cx="${cx}" cy="${cy}" r="58" fill="url(#dpHubFill)" stroke="rgba(255,255,255,0.32)" stroke-width="1.5"/>
        <circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
        <text x="${cx}" y="${archLine2 ? cy - 4 : cy + 4}" text-anchor="middle" fill="white" font-size="13" font-weight="900" letter-spacing="-0.4">${escapeXml(archLine1)}</text>
        ${archLine2 ? `<text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="white" font-size="13" font-weight="900" letter-spacing="-0.4">${escapeXml(archLine2)}</text>` : ''}
      </g>
    </svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// ---- style picker (floats top-right, swaps view via ?style=) ---------------

function renderStylePicker(currentId: string, _target: string, _mode: Mode): string {
  // Visible chip row at the top — every style is one click away. Doubles
  // as the keyboard cheat-sheet (← → to step, 0–9 to jump direct).
  // Renders the dashboard chip first, then each visual style.
  const chips = STYLE_LIST.map((s, i) => {
    const active = s.id === currentId || (currentId === 'default' && s.id === 'default');
    const label = s.id === 'default' ? 'Dashboard' : s.name;
    // Keyboard shortcut hints: only 0-9 are reachable via single keys; the
    // 11th chip (subway) gets ←/→ as its hint instead of a misleading "10".
    const shortcut = i < 10 ? `press ${i}` : 'press ← or →';
    const numLabel = i < 10 ? String(i) : '·';
    return `<button class="dp-chip${active ? ' is-active' : ''}" data-style="${s.id}" type="button" title="${escapeXml(s.blurb)} (${shortcut})"><span class="dp-num">${numLabel}</span>${escapeXml(label)}</button>`;
  }).join('');
  return `<style>
.dp-rail{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;gap:6px;align-items:center;background:rgba(8,10,16,.88);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.14);padding:6px 8px;border-radius:999px;font-family:Inter,ui-sans-serif,system-ui;font-size:11px;color:#fff;box-shadow:0 10px 28px rgba(0,0,0,.5);max-width:calc(100vw - 32px);overflow-x:auto;scrollbar-width:none}
.dp-rail::-webkit-scrollbar{display:none}
.dp-chip{font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.02em;color:rgba(255,255,255,.72);background:transparent;border:0;padding:7px 12px 7px 8px;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;flex-shrink:0;line-height:1;transition:background .15s,color .15s}
.dp-chip .dp-num{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;color:rgba(255,255,255,.4);background:rgba(255,255,255,.06);padding:2px 5px;border-radius:99px;letter-spacing:.02em;font-weight:600}
.dp-chip:hover{background:rgba(255,255,255,.06);color:#fff}
.dp-chip:focus-visible{outline:2px solid #62f0a7;outline-offset:1px}
.dp-chip.is-active{background:linear-gradient(135deg,#31d9ff,#7c5cff);color:#fff;box-shadow:0 4px 14px rgba(124,92,255,.5)}
.dp-chip.is-active .dp-num{background:rgba(0,0,0,.25);color:#fff}
.dp-rail .dp-sep{width:1px;align-self:stretch;background:rgba(255,255,255,.12);margin:0 2px;flex-shrink:0}
.dp-rail .dp-gallery{font-family:inherit;font-size:11px;color:#62f0a7;text-decoration:none;padding:7px 12px;letter-spacing:.04em;flex-shrink:0;font-weight:600}
.dp-rail .dp-gallery:hover{color:#9aff9a}
@media(max-width:540px){.dp-rail{left:8px;right:8px;transform:none;max-width:none}.dp-chip{padding:7px 10px 7px 6px}}
@media print{.dp-rail{display:none}}
</style>
<div class="dp-rail" id="dpStylePicker" role="tablist" aria-label="Card style">${chips}<span class="dp-sep"></span><a class="dp-gallery" href="/prototypes/" title="See the full gallery">gallery →</a></div>`;
}

function wireStylePicker(root: ParentNode, target: string, mode: Mode): void {
  const rail = root.querySelector<HTMLElement>('#dpStylePicker') ?? document.getElementById('dpStylePicker');
  if (!rail) return;
  // Click a chip → switch.
  rail.querySelectorAll<HTMLButtonElement>('.dp-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.style;
      if (v) applyStyle(v, target, mode);
    });
  });
  // Keyboard: ← → step through; 0-9 jump direct. Bound on document so it
  // works even when focus is somewhere else (no input currently focused).
  if (!document.body.dataset.dpKeyboardWired) {
    document.body.dataset.dpKeyboardWired = '1';
    document.addEventListener('keydown', (e) => {
      // Don't hijack typing in the search box / any text field.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!lastTarget) return;
      const total = STYLE_LIST.length;
      const currentIdx = STYLE_LIST.findIndex((s) => {
        const url = new URLSearchParams(location.search).get('style');
        const cur = url ?? 'letterhead';
        return s.id === cur;
      });
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        applyStyle(STYLE_LIST[(currentIdx + 1) % total]?.id ?? 'default', lastTarget, currentMode);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        applyStyle(STYLE_LIST[(currentIdx - 1 + total) % total]?.id ?? 'default', lastTarget, currentMode);
      } else if (/^[0-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (n < total) {
          e.preventDefault();
          applyStyle(STYLE_LIST[n].id, lastTarget, currentMode);
        }
      }
    });
  }
}

/**
 * Tear down any active style takeover: run the renderer's unmount, drop the
 * style host's content, and clear the body class flags. Called before any
 * new style takes over (or before the default view re-mounts).
 */
function unmountAnyStyle(): void {
  if (lastStyleUnmount) {
    try { lastStyleUnmount(); } catch { /* ignore */ }
    lastStyleUnmount = null;
  }
  // Drop every style-* and the takeover marker — without this, switching
  // default → A → default → B leaves stale `body.style-A` rules on the page
  // (background colours / fonts / etc. all bleed through).
  const cls = Array.from(document.body.classList);
  for (const c of cls) {
    if (c.startsWith('style-') || c === 'style-takeover') document.body.classList.remove(c);
  }
  const host = document.getElementById('styleHost');
  if (host) {
    host.innerHTML = '';
    host.style.opacity = '';
    host.style.transition = '';
  }
  // The wrap is hidden purely via CSS (`body.style-takeover .wrap`) when a
  // takeover is active; once we've cleared that class the wrap reappears
  // automatically. Wipe any stale inline display:none from older builds so
  // a fresh deploy hitting an old SPA doesn't leave a hidden chrome.
  const wrap = document.querySelector<HTMLElement>('.wrap');
  if (wrap && wrap.style.display === 'none') wrap.style.display = '';
}

/**
 * Mount a renderer in place. Idempotent — call repeatedly when the user
 * picks a different style and we'll tear down the previous one first. Also
 * applies a brief opacity fade so the swap doesn't flash.
 */
function mountStyle(renderer: import('./styles/index.ts').StyleRenderer, data: ProfileData): void {
  // Tear down the *previous* renderer's listeners before swapping markup.
  if (lastStyleUnmount) { try { lastStyleUnmount(); } catch { /* ignore */ } lastStyleUnmount = null; }

  // Atomic swap, no opacity dance: each style's CSS rules are inline with its
  // HTML, so as long as the body class and innerHTML are replaced in the same
  // tick the user never sees an in-between "naked" frame. The previous fade
  // briefly showed the empty body background between styles — that was the
  // "flash on style switch" the user kept reporting.
  const styleClasses = Array.from(document.body.classList).filter((c) => c.startsWith('style-') && c !== 'style-takeover');
  for (const c of styleClasses) document.body.classList.remove(c);
  document.body.classList.add('style-takeover', `style-${renderer.id}`);

  let host = document.getElementById('styleHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'styleHost';
    document.body.appendChild(host);
  }
  // Wipe any stale inline opacity / transition leftovers from the older
  // version of this code so a freshly-deployed bundle hitting a cached host
  // doesn't keep the host invisible.
  host.style.opacity = '';
  host.style.transition = '';
  const out = renderer.render(data);
  host.innerHTML = out.html + renderStylePicker(renderer.id, lastTarget || data.target, currentMode);
  const ret = out.mount?.(host);
  lastStyleUnmount = typeof ret === 'function' ? ret : null;
  wireStylePicker(host, lastTarget || data.target, currentMode);
}

/**
 * Pick a different style (or 'default') in place — no full page reload, no
 * GitHub round-trip. Triggered from the picker dropdown.
 */
function applyStyle(id: string, target: string, mode: Mode): void {
  // Update the URL silently so a refresh / share preserves the chosen style.
  const path = mode === 'agent' ? `/agents/${target}` : `/${target}`;
  const newUrl = id === 'default' || !id ? path : `${path}?style=${id}`;
  history.replaceState(null, '', newUrl);

  if (!lastProfileData) {
    // Cold start (no cached data yet) — fall back to a normal fetching build.
    build(target, false);
    return;
  }

  const renderer = getStyle(id);
  if (renderer) {
    mountStyle(renderer, lastProfileData);
    return;
  }

  // Switch back to the default dashboard view. If we've already rendered the
  // dashboard once for this target it's still in the DOM under #result —
  // just unmount the takeover and the dashboard reappears instantly. If
  // it's never been rendered for this target, run the dashboard pipeline
  // straight from cached data (no loader, no fetch).
  unmountAnyStyle();
  if (dashboardRenderedFor === target) return;
  renderDashboard(target, lastProfileData, false);
}

/**
 * Render the full default-view dashboard from a ProfileData object. Called
 * once during the first build() for a given target, and re-callable directly
 * by applyStyle when the user flips back to "default" without us having to
 * re-fetch from GitHub.
 */
function renderDashboard(target: string, data: ProfileData, scroll: boolean): void {
  const { profile, repo, isRepo, totalStars, archetype: arch, themes, repos, topLangs, langs, battle, insights, pack } = data;
  const owner = target.split('/')[0];

  // Body/wrap chrome restored, card panels filled in.
  unmountAnyStyle();
  const wrap = document.querySelector<HTMLElement>('.wrap');
  if (wrap) wrap.style.display = '';

  renderProfile(profile, repo, isRepo, totalStars, arch, themes, repos, topLangs);
  renderBattleCard(battle, isRepo);
  renderStrengths(topLangs);
  renderThemes(themes);
  renderRepos(repos, isRepo);
  $('insightsCard').classList.toggle('hidden', isRepo);
  if (!isRepo) renderInsights(profile, repos, totalStars);

  $('agentPack').textContent = pack;

  renderStack(insights, isRepo, owner);
  renderCommitStyle(insights, isRepo);
  renderHeatmap(insights);
  renderRelated(insights, isRepo);
  if (isRepo) {
    $('userActivityRow').classList.add('hidden');
  } else {
    $('userActivityRow').classList.remove('hidden');
    renderActivity(insights);
    renderHealth(repos);
  }

  const agent = currentMode === 'agent';
  $('graph').classList.toggle('hidden', agent);
  $('agentPack').classList.toggle('hidden', !agent);
  $('copyAgent').classList.toggle('hidden', !agent);
  $('mainPanelTitle').textContent = agent ? 'Agent context pack' : 'Builder graph';
  if (!agent) renderGraph(topLangs, themes, arch);
  $('result').classList.add('show');
  document.body.classList.add('has-result');

  // Floating style-picker chip rail.
  const existingPicker = document.getElementById('dpStylePicker');
  if (existingPicker) existingPicker.remove();
  const pickerHost = document.createElement('div');
  pickerHost.id = 'dpStylePickerHost';
  pickerHost.innerHTML = renderStylePicker('default', target, currentMode);
  while (pickerHost.firstChild) document.body.appendChild(pickerHost.firstChild);
  wireStylePicker(document, target, currentMode);
  if (scroll) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });

  dashboardRenderedFor = target;
}

// ── stack / commit-style / heatmap renderers (data from /target.json sidecar) ──

const CATEGORY_ORDER: DetectedTech['category'][] = [
  'framework', 'ai', 'ui', 'db', 'auth', 'payments', 'cloud', 'testing', 'tooling', 'lang', 'other',
];
const CATEGORY_LABEL: Record<DetectedTech['category'], string> = {
  framework: 'Frameworks',
  ai: 'AI / ML',
  ui: 'UI / styling',
  db: 'Database / ORM',
  auth: 'Auth',
  payments: 'Payments',
  cloud: 'Cloud / infra',
  testing: 'Testing',
  tooling: 'Tooling',
  lang: 'Languages',
  other: 'Other',
};
const CATEGORY_ACCENT: Record<DetectedTech['category'], string> = {
  framework: '#7c5cff',
  ai: '#62f0a7',
  ui: '#31d9ff',
  db: '#ffd166',
  auth: '#ff5cc8',
  payments: '#62f0a7',
  cloud: '#31d9ff',
  testing: '#a97bff',
  tooling: '#9aa7c7',
  lang: '#3178c6',
  other: '#9aa7c7',
};

function renderStack(insights: Insights | undefined, isRepo: boolean, owner?: string) {
  const card = $('stackCard');
  const body = $('stackBody');
  const subtitle = $('stackSubtitle');

  if (!insights || insights.stack.detected.length === 0) {
    card.classList.add('hidden');
    body.innerHTML = '';
    subtitle.textContent = '';
    return;
  }
  card.classList.remove('hidden');
  $('stackTitle').textContent = isRepo ? 'Detected stack' : 'Detected stack (top 3 active repos)';
  subtitle.textContent = `${insights.stack.detected.length} libraries detected · ${insights.stack.ecosystems.join(', ')}`;

  // Render category chip groups, then per-repo breakdown for users.
  const grouped = groupDetected(insights.stack.detected);
  const groups = CATEGORY_ORDER
    .filter((c) => grouped.has(c))
    .map((c) => {
      const items = grouped.get(c)!;
      const accent = CATEGORY_ACCENT[c];
      const chips = items
        .slice(0, 12)
        .map((t) => `<span class="stack-chip" style="--chip-accent:${accent}" title="${escapeAttr(t.evidence)}">${escapeHtml(t.name)}</span>`)
        .join('');
      return `<div class="stack-group"><div class="stack-group-label">${CATEGORY_LABEL[c]}</div><div class="stack-chips">${chips}</div></div>`;
    })
    .join('');

  let perRepoHtml = '';
  if (!isRepo && insights.perRepoStack && insights.perRepoStack.length > 0) {
    const rows = insights.perRepoStack
      .filter((r) => r.stack.detected.length > 0)
      .map((r) => {
        const top = rankDetectedClient(r.stack.detected).slice(0, 6).map((t) => t.name).join(' · ');
        const repoLink = owner
          ? `<a href="https://github.com/${escapeAttr(owner)}/${escapeAttr(r.repo)}" target="_blank" rel="noreferrer"><b>${escapeHtml(r.repo)}</b></a>`
          : `<b>${escapeHtml(r.repo)}</b>`;
        return `<div class="stack-repo-row">${repoLink}<span class="muted">${escapeHtml(top)}</span></div>`;
      })
      .join('');
    if (rows) perRepoHtml = `<div class="stack-perrepo">${rows}</div>`;
  }
  body.innerHTML = groups + perRepoHtml;
}

function rankDetectedClient(items: readonly DetectedTech[]): DetectedTech[] {
  // Local copy to avoid an extra import path; mirrors analysis/stack.ts.
  return rankDetected(items);
}

function groupDetected(items: readonly DetectedTech[]): Map<DetectedTech['category'], DetectedTech[]> {
  const out = new Map<DetectedTech['category'], DetectedTech[]>();
  for (const t of rankDetectedClient(items)) {
    const list = out.get(t.category) ?? [];
    list.push(t);
    out.set(t.category, list);
  }
  return out;
}

function renderCommitStyle(insights: Insights | undefined, isRepo: boolean) {
  const card = $('commitCard');
  const body = $('commitBody');
  const meta = $('commitMeta');

  // Commit-style only meaningful for repo pages today (per-repo commits).
  if (!isRepo || !insights?.commitStyle || insights.commitStyle.signals.sample === 0) {
    card.classList.add('hidden');
    body.innerHTML = '';
    meta.textContent = '';
    return;
  }

  const cs = insights.commitStyle;
  card.classList.remove('hidden');
  meta.textContent = `${cs.signals.sample} recent commits · ${cs.primary}`;

  const bullets = cs.bullets
    .map((b) => `<div class="commit-bullet">${markBoldHtml(b)}</div>`)
    .join('');
  const samples = cs.samples.length
    ? `<div class="commit-samples"><span class="muted">Sample subjects</span>${cs.samples
        .map((s) => `<code>${escapeHtml(s)}</code>`)
        .join('')}</div>`
    : '';
  body.innerHTML = bullets + samples;
}

function markBoldHtml(s: string): string {
  // Match the **bold** pattern coming from the inferCommitStyle bullets +
  // backtick-wrapped inline code, which `inferCommitStyle` uses.
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderHeatmap(insights: Insights | undefined) {
  const card = $('heatmapCard');
  const diag = $('heatmapDiag');
  const meta = $('heatmapMeta');
  const ca = insights?.commitActivity;
  if (!ca || ca.length === 0) {
    card.classList.add('hidden');
    diag.innerHTML = '';
    meta.textContent = '';
    return;
  }

  card.classList.remove('hidden');
  $('heatmapTitle').textContent = 'Commit heatmap, last 52 weeks';
  meta.textContent = insights!.commitActivitySource
    ? `source: ${insights!.commitActivitySource}`
    : '';

  // GitHub-style yearly grid: 53 cols × 7 rows. Our input is weekly totals
  // (no day breakdown), so we paint each column uniformly by intensity.
  const weeks = ca.slice(-52);
  const max = Math.max(...weeks.map((w) => w.total), 1);
  const cell = 11;
  const gap = 3;
  const cols = weeks.length;
  const W = cols * (cell + gap) + 28;
  const H = 7 * (cell + gap) + 30;

  const colorFor = (n: number) => {
    if (n === 0) return 'rgba(255,255,255,0.04)';
    const t = Math.min(1, Math.log2(n + 1) / Math.log2(max + 1));
    // Linear-ish gradient through the brand palette.
    if (t < 0.25) return 'rgba(124,92,255,0.28)';
    if (t < 0.5) return 'rgba(124,92,255,0.55)';
    if (t < 0.75) return 'rgba(49,217,255,0.75)';
    return 'rgba(255,209,102,0.95)';
  };

  const cells: string[] = [];
  for (let i = 0; i < cols; i++) {
    const w = weeks[i];
    const x = 14 + i * (cell + gap);
    const date = new Date(w.week * 1000);
    const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}: ${w.total} commit${w.total === 1 ? '' : 's'}`;
    for (let row = 0; row < 7; row++) {
      const y = 14 + row * (cell + gap);
      cells.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${colorFor(w.total)}"><title>${label}</title></rect>`,
      );
    }
  }

  // Month labels every ~4 weeks.
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabels: string[] = [];
  let lastLabel = -1;
  for (let i = 0; i < cols; i++) {
    const date = new Date(weeks[i].week * 1000);
    const m = date.getUTCMonth();
    if (m !== lastLabel) {
      monthLabels.push(
        `<text x="${14 + i * (cell + gap)}" y="${H - 6}" font-size="9" fill="rgba(255,255,255,0.45)">${monthNames[m]}</text>`,
      );
      lastLabel = m;
    }
  }

  // Total commits + peak week summary.
  const total = ca.reduce((n, w) => n + w.total, 0);
  const peakIdx = ca.indexOf(ca.reduce((b, w) => (w.total > b.total ? w : b)));
  const peakDate = new Date(ca[peakIdx].week * 1000);
  const peakLabel = `${monthNames[peakDate.getUTCMonth()]} ${peakDate.getUTCFullYear()}`;

  diag.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet" class="diag-svg" role="img" aria-label="Commit heatmap">
      ${cells.join('')}
      ${monthLabels.join('')}
    </svg>
    <div class="muted heatmap-summary">${total.toLocaleString()} commits · peak ${peakLabel} (${ca[peakIdx].total})</div>`;
}

function renderRelated(insights: Insights | undefined, isRepo: boolean) {
  // "Often building with" (user) or "Top contributors" (repo). Each chip
  // links to the contributor's GitHub *and* their devprint card so the page
  // becomes a launchpad to related people, not a dead-end.
  const card = $('relatedCard');
  const body = $('relatedBody');
  const meta = $('relatedMeta');
  const list = insights?.relatedProfiles ?? [];
  if (list.length === 0) {
    card.classList.add('hidden');
    body.innerHTML = '';
    meta.textContent = '';
    return;
  }
  card.classList.remove('hidden');
  $('relatedTitle').textContent = isRepo ? 'Top contributors' : 'Often building with';
  meta.textContent = `${list.length} ${isRepo ? 'contributors' : 'collaborators across top repos'}`;

  body.innerHTML = list
    .map((p: RelatedProfile) => {
      const safe = escapeAttr(p.login);
      const safeAvatar = escapeAttr(p.avatar_url);
      const via = p.viaRepo ? `<span class="related-via">via ${escapeHtml(p.viaRepo)}</span>` : '';
      return `<div class="related-chip">
        <a class="related-chip-main" href="https://github.com/${safe}" target="_blank" rel="noreferrer" title="${safe} · ${p.contributions} commits">
          <img src="${safeAvatar}" alt="" loading="lazy" referrerpolicy="no-referrer"/>
          <span class="related-login">${escapeHtml(p.login)}</span>
        </a>
        <a class="related-chip-devprint" href="/${safe}" title="See ${safe}'s devprint">card →</a>
        ${via}
      </div>`;
    })
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  build(($('target') as HTMLInputElement).value);
});
document.querySelectorAll<HTMLElement>('.chip').forEach((c) => {
  c.onclick = () => build(c.dataset.target || '');
});
function flash(btn: HTMLElement, text: string, after: string) {
  const original = after;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = original), 1200);
}

$('share').onclick = async () => {
  await navigator.clipboard.writeText(location.href);
  flash($('share'), 'Copied', 'Copy link');
};
$('copyAgent').onclick = async () => {
  if (!lastPack) return;
  await navigator.clipboard.writeText(lastPack);
  flash($('copyAgent'), 'Copied', 'Copy pack');
};

async function captureCard(): Promise<Blob | null> {
  const node = document.querySelector<HTMLElement>('aside.card');
  if (!node) return null;
  const { toPng } = await import('html-to-image');
  // Render at 2x for crisp image; transparent bg lets the gradient show on dark surfaces.
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: '#0a0d18',
    cacheBust: true,
    style: { transform: 'none' },
  });
  const r = await fetch(dataUrl);
  return await r.blob();
}

$('savePng').onclick = async () => {
  const btn = $('savePng');
  flash(btn, 'Rendering…', 'Save PNG');
  try {
    const blob = await captureCard();
    if (!blob) return;
    const target = location.pathname.replace(/\/+/g, '-').replace(/^-+|-+$/g, '') || 'devprint';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devprint-${target}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash(btn, 'Saved', 'Save PNG');
  } catch {
    flash(btn, 'Failed', 'Save PNG');
  }
};

$('tweet').onclick = () => {
  const target = location.pathname.replace(/^\/+/, '') || '';
  const archetype = $('archetype').textContent ?? 'Builder';
  const tier = $('trumpTier').textContent ?? '';
  const text = `My Devprint card: ${archetype} (${tier}). See yours: devprint.dev/${target}`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
  window.open(url, '_blank', 'noopener');
};

$('nativeShare').onclick = async () => {
  const target = location.pathname.replace(/^\/+/, '') || '';
  const archetype = $('archetype').textContent ?? 'Builder';
  const tier = $('trumpTier').textContent ?? '';
  const shareData: ShareData = {
    title: `Devprint — ${target || 'a developer'}`,
    text: `${archetype} · ${tier} — see the shape of any developer's work.`,
    url: location.href,
  };

  // If the platform supports sharing files, attach the rendered PNG so social
  // apps can post the card image directly.
  if ('canShare' in navigator) {
    try {
      const blob = await captureCard();
      if (blob) {
        const file = new File([blob], 'devprint-card.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          (shareData as ShareData & { files: File[] }).files = [file];
        }
      }
    } catch {
      // ignore; fall back to URL-only share
    }
  }

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // User cancelled or failed — fall through to clipboard.
    }
  }
  await navigator.clipboard.writeText(location.href);
  flash($('nativeShare'), 'Link copied', 'Share');
};
$('humanMode').onclick = () => setMode('human');
$('agentMode').onclick = () => setMode('agent');
setMode(currentMode);

const initial = pathTarget() || cleanTarget(location.hash.slice(1));
if (initial) build(initial, false);

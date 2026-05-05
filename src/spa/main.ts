import './styles.css';
import { toPng } from 'html-to-image';
import {
  archetype,
  battleStats,
  cleanTarget,
  createGitHubClient,
  getThemes,
  scoreRepo,
  type GhRepo,
  type GhUser,
} from '../analysis/index.ts';

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

async function fetchAgentPack(target: string): Promise<string> {
  const path = `/${target}.md`;
  const url = AGENT_ORIGIN ? `${AGENT_ORIGIN}${path}` : path;
  const r = await fetch(url, { headers: { Accept: 'text/markdown' } });
  if (!r.ok) throw new Error(`Agent pack fetch failed: ${r.status}`);
  return r.text();
}

type Mode = 'human' | 'agent';

const app = document.querySelector<HTMLDivElement>('#app')!;
let currentMode: Mode = location.hostname.startsWith('agents.') || location.pathname.startsWith('/agents/') ? 'agent' : 'human';
let lastPack = '';

app.innerHTML = `
<div class="wrap">
  <nav class="nav"><div class="brand"><div class="mark"></div><span id="brandText">Devprint</span></div><div class="navlinks"><button class="modebtn" id="humanMode" type="button">Show-off card</button><button class="modebtn" id="agentMode" type="button">Agent pack</button><div class="pill">GitHub user or repo → useful artefact</div></div></nav>
  <section class="hero">
    <div><div class="eyebrow" id="eyebrow"></div><h1 class="h1" id="heroTitle"></h1><p class="lead" id="heroLead"></p><form class="search" id="form"><input id="target" placeholder="github.com/jhammant or jhammant/factcheck" autocomplete="off" /><button id="go">Generate</button></form><div class="examples"><span class="chip" data-target="jhammant">jhammant</span><span class="chip" data-target="jhammant/factcheck">jhammant/factcheck</span><span class="chip" data-target="sindresorhus">sindresorhus</span><span class="chip" data-target="facebook/react">facebook/react</span></div><div class="loading" id="loading">Fetching public GitHub data and building the artefact…</div><div class="error" id="error"></div></div>
    <div class="preview"><div class="mini"><div class="orbit"><div class="node" style="width:82px;height:82px;left:45%;top:43%"></div><div class="node" style="width:42px;height:42px;left:20%;top:56%;background:linear-gradient(135deg,var(--green),var(--cyan))"></div><div class="node" style="width:56px;height:56px;left:76%;top:35%;background:linear-gradient(135deg,var(--pink),var(--amber))"></div><div class="node" style="width:32px;height:32px;left:68%;top:75%"></div></div></div></div>
  </section>
  <section class="result" id="result"><div class="grid"><aside class="card"><div class="profile"><img class="avatar" id="avatar" alt="" crossorigin="anonymous"><div><div class="name" id="displayName"></div><div class="muted" id="handle"></div></div></div><div class="stats"><div class="stat"><b id="repoCount">–</b><span class="muted" id="stat1Label">repos</span></div><div class="stat"><b id="stars">–</b><span class="muted">stars</span></div><div class="stat"><b id="followers">–</b><span class="muted" id="stat3Label">followers</span></div></div><hr style="border:0;border-top:1px solid rgba(255,255,255,.09);margin:18px 0"><div class="muted" id="archetypeLabel">Builder archetype</div><div class="archetype" id="archetype">–</div><p class="insight" id="summary"></p><div class="trump"><div class="trump-head"><div class="trump-title" id="battleTitle">Builder Battle Card</div><div class="trump-badge" id="trumpTier">Rare</div></div><div class="trump-grid"><div class="trump-stat"><span>Build Power</span><b id="tcBuild">–</b></div><div class="trump-stat"><span>Impact</span><b id="tcImpact">–</b></div><div class="trump-stat"><span>Versatility</span><b id="tcVersatility">–</b></div><div class="trump-stat"><span>Momentum</span><b id="tcMomentum">–</b></div><div class="trump-stat"><span>Community</span><b id="tcCommunity">–</b></div><div class="trump-stat"><span>Originality</span><b id="tcOriginality">–</b></div></div><div class="trump-special" id="tcSpecial"></div></div></aside><div class="card"><div class="section-title"><h2 id="mainPanelTitle">Builder graph</h2><div class="copyrow"><button class="share" id="copyAgent">Copy pack</button><button class="share" id="share">Copy link</button><button class="share" id="savePng" title="Download battle card as PNG">Save PNG</button><button class="share" id="tweet" title="Share on X">Tweet</button><button class="share share-primary" id="nativeShare" title="Open share sheet">Share</button></div></div><div class="canvas" id="graph"></div><pre class="agentpack hidden" id="agentPack"></pre></div></div><div class="grid2"><div class="card"><div class="section-title"><h2>Strengths with evidence</h2></div><div class="bars" id="strengths"></div></div><div class="card"><div class="section-title"><h2>Theme clusters</h2></div><div class="tags" id="themes"></div></div></div><div class="card" style="margin-top:18px"><div class="section-title"><h2 id="projectsTitle">Most interesting public projects</h2></div><div class="repos" id="repos"></div></div></section>
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
  $('loading').style.display = 'block';
  $('error').style.display = 'none';
  $('result').classList.remove('show');
  ($('go') as HTMLButtonElement).disabled = true;

  try {
    const target = cleanTarget(raw);
    if (!target) throw new Error('Enter a GitHub username, profile URL, or owner/repo');
    ($('target') as HTMLInputElement).value = target;

    const bits = target.split('/').filter(Boolean);
    const isRepo = bits.length >= 2;
    const owner = bits[0];
    const repoName = bits[1];

    const profile = await client.getUser(owner);
    let reposRaw: GhRepo[];
    let repo: GhRepo | undefined;
    if (isRepo) {
      repo = await client.getRepo(owner, repoName);
      reposRaw = [repo];
    } else {
      reposRaw = await client.listUserRepos(owner, { max: 100 });
    }

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

    history.replaceState(null, '', currentMode === 'agent' ? `/agents/${target}` : `/${target}`);

    renderProfile(profile, repo, isRepo, totalStars, arch, themes, repos, topLangs);
    renderBattleCard(battle, isRepo);
    renderStrengths(topLangs);
    renderThemes(themes);
    renderRepos(repos, isRepo);

    // Fetch the agent pack from the Lambda (it has a server-side GitHub token,
    // and CloudFront caches the response). Doing this client-side via
    // buildUserPack/buildRepoPack would double our GitHub-API calls per page
    // render against the unauth 60/hr-per-IP ceiling.
    try {
      lastPack = await fetchAgentPack(target);
    } catch {
      lastPack = `# Devprint Agent Pack: ${target}\n\nThe agent pack endpoint is currently unreachable. Try again in a moment.\n`;
    }
    $('agentPack').textContent = lastPack;

    const agent = currentMode === 'agent';
    $('graph').classList.toggle('hidden', agent);
    $('agentPack').classList.toggle('hidden', !agent);
    $('copyAgent').classList.toggle('hidden', !agent);
    $('mainPanelTitle').textContent = agent ? 'Agent context pack' : 'Builder graph';
    if (!agent) renderGraph(topLangs, themes, arch);
    $('result').classList.add('show');
    if (scroll) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    $('error').textContent = e instanceof Error ? e.message : String(e);
    $('error').style.display = 'block';
  } finally {
    $('loading').style.display = 'none';
    ($('go') as HTMLButtonElement).disabled = false;
  }
}

function renderProfile(
  profile: GhUser, repo: GhRepo | undefined, isRepo: boolean,
  totalStars: number, arch: string, themes: ReturnType<typeof getThemes>,
  repos: GhRepo[], topLangs: [string, number][],
) {
  $('avatar').setAttribute('src', profile.avatar_url);
  $('displayName').textContent = isRepo ? repo!.full_name : (profile.name || profile.login);
  $('handle').textContent = isRepo ? (repo!.description || 'Repository fingerprint') : '@' + profile.login;
  $('repoCount').textContent = isRepo ? String(repo!.open_issues_count || 0) : String(profile.public_repos);
  $('stat1Label').textContent = isRepo ? 'open issues' : 'repos';
  $('stars').textContent = String(totalStars);
  $('followers').textContent = isRepo ? String(repo!.forks_count) : String(profile.followers);
  $('stat3Label').textContent = isRepo ? 'forks' : 'followers';
  $('archetypeLabel').textContent = isRepo ? 'Repo archetype' : 'Builder archetype';
  $('archetype').textContent = arch;
  const top = topLangs.slice(0, 3).map((x) => x[0]).join(', ') || 'multiple stacks';
  $('summary').textContent = isRepo
    ? `${repo!.full_name} looks like a ${arch.toLowerCase()} with ${repo!.stargazers_count} stars, ${repo!.forks_count} forks, and recent activity last seen ${new Date(repo!.updated_at).toLocaleDateString()}.`
    : `${profile.name || profile.login} looks like a ${arch.toLowerCase()} working mostly across ${top}. The public footprint points to ${themes[0]?.[0]?.toLowerCase() || 'practical'} work, with ${repos.length} non-fork repos analysed.`;
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
  const list = themes.length ? themes : ([['Open source', 1], ['Builder', 1]] as const);
  $('themes').innerHTML = list.map(([t, n]) => `<span class="tag">${t} · ${n}</span>`).join('');
}

function renderRepos(repos: GhRepo[], isRepo: boolean) {
  $('projectsTitle').textContent = isRepo ? 'Repository facts' : 'Most interesting public projects';
  $('repos').innerHTML = repos.slice(0, 6).map((r) => {
    const accent = langColors[r.language ?? ''] ?? '#31d9ff';
    return `<a class="repo" href="${r.html_url}" target="_blank" rel="noreferrer" style="--accent:${accent}"><b>${r.name}</b><p>${r.description || 'No description yet.'}</p><small>${r.language || 'Mixed'} · ★ ${r.stargazers_count} · updated ${new Date(r.updated_at).toLocaleDateString()}</small></a>`;
  }).join('');
}

function renderGraph(topLangs: [string, number][], themes: ReturnType<typeof getThemes>, arch: string) {
  const graph = $('graph');
  graph.innerHTML = '';
  const nodes = [
    ...topLangs.map(([n, c]) => ({ n, c, type: 'lang' as const })),
    ...themes.slice(0, 4).map(([n, c]) => ({ n, c: c * 2, type: 'theme' as const })),
  ];
  nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? 34 : 27;
    const size = 44 + Math.min(54, node.c * 8);
    const div = document.createElement('div');
    div.className = 'bubble';
    div.style.left = (50 + Math.cos(angle) * rad) + '%';
    div.style.top = (50 + Math.sin(angle) * rad) + '%';
    div.style.width = div.style.height = size + 'px';
    div.style.borderColor = node.type === 'lang' ? (langColors[node.n] || '#31d9ff') : 'rgba(98,240,167,.45)';
    div.textContent = node.n;
    graph.appendChild(div);
  });
  const core = document.createElement('div');
  core.className = 'bubble';
  core.style.left = '50%';
  core.style.top = '50%';
  core.style.width = core.style.height = '94px';
  core.style.background = 'linear-gradient(135deg,rgba(49,217,255,.45),rgba(255,92,200,.32))';
  core.textContent = arch;
  graph.appendChild(core);
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

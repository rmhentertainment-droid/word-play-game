// <tots-games> — the Games section for Kids mode on totsmots.com.
// A store-style grid of game covers, a details page for each game, and a "Keep playing" card.
// Games come from games.json next to this file, so new games and covers need no code changes.
//
// Attributes:
//   data-url    where games.json lives (defaults to the folder this script was loaded from)
//   in-app      Play buttons fire "games-play" {slug, case, screen} instead of opening playUrl
//   exit-label  shows a back button on the grid with this label; it fires "games-exit"
(() => {
const SCRIPT_URL = (typeof document !== 'undefined' && (document.currentScript?.src ||
  [...document.querySelectorAll('script[src]')].map((s) => s.src).find((u) => /tots-games\.js(\?|$)/.test(u)))) || '';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const svg = (body, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 28),
  question: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01"/>', 40),
  check: svg('<path d="M5 12l4 4 10-10"/>', 18),
  screen: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
};

const CSS = `
:host { display:block; --cyan:#00C7DF; --teal:#003E4A; --ground:#F2FBFD; --card:#FFFFFF; --line:#CDEFF5; --muted:#3D6670; --yellow:#FFC23D;
  font-family: Lato, system-ui, sans-serif; color:var(--teal); }
* { box-sizing:border-box; }
button, a { font:inherit; color:inherit; -webkit-tap-highlight-color:transparent; text-decoration:none; }
button { cursor:pointer; }
:focus-visible { outline:3px solid var(--teal); outline-offset:2px; }
.app { container-type:inline-size; background:var(--ground); min-height:100%; }
.wrap { max-width:1200px; margin:0 auto; padding:16px; display:flex; flex-direction:column; gap:16px; }
.top { display:flex; align-items:center; gap:12px; }
.round { width:48px; height:48px; border-radius:50%; border:2px solid var(--line); background:var(--card); display:grid; place-items:center; flex:none; }
h1 { font-weight:900; font-size:30px; margin:0; }
h2 { font-weight:900; font-size:21px; margin:0 0 8px; }
.search { display:flex; align-items:center; gap:8px; background:var(--card); border:2px solid var(--line); border-radius:999px; padding:0 16px; min-height:50px; }
.search input { flex:1; border:0; outline:0; font:inherit; font-size:17px; color:var(--teal); background:transparent; min-height:46px; }
.search:focus-within { border-color:var(--cyan); }
.chips { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
.chip { flex:none; min-height:44px; padding:0 18px; border-radius:999px; border:2px solid var(--line); background:var(--card); font-weight:900; font-size:15px; }
.chip[aria-pressed="true"] { background:var(--cyan); border-color:var(--cyan); color:var(--teal); }
.keep { display:flex; align-items:center; gap:14px; background:var(--card); border:2px solid var(--cyan); border-radius:20px; padding:12px; text-align:left; width:100%; cursor:pointer; }
.keep img { width:66px; aspect-ratio:3/4; object-fit:cover; border-radius:10px; flex:none; }
.keep .k { font-size:14px; font-weight:700; color:var(--muted); }
.keep .t { font-size:19px; font-weight:900; }
.keep .go { margin-left:auto; flex:none; width:48px; height:48px; border-radius:50%; background:var(--cyan); display:grid; place-items:center; }
.grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:16px; }
@container (min-width:420px) { .grid { grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); } }
.tile { display:flex; flex-direction:column; gap:6px; text-align:left; background:none; border:0; padding:0; }
.cover { position:relative; aspect-ratio:3/4; border-radius:18px; overflow:hidden; background:var(--teal); box-shadow:0 6px 16px #003e4a26; transition:transform .15s; }
button.tile:hover .cover, button.tile:focus-visible .cover { transform:translateY(-3px); }
.cover img { width:100%; height:100%; object-fit:cover; display:block; }
.badge { position:absolute; top:10px; left:10px; background:var(--yellow); color:var(--teal); font-weight:900; font-size:12px; letter-spacing:.5px; padding:4px 10px; border-radius:999px; }
.badge.soon { background:#fff; }
.placeholder { width:100%; height:100%; display:grid; place-items:center; text-align:center; padding:14px; font-weight:900; font-size:22px; color:#fff;
  background:linear-gradient(160deg, #0a7d8c, var(--teal)); }
.placeholder.mystery { background:repeating-linear-gradient(45deg, #e3f6fa 0 14px, #d4f1f6 14px 28px); color:var(--muted); }
.soon-tile .cover { filter:saturate(.6); }
.tile .name { font-weight:900; font-size:17px; }
.tile .desc { font-size:14px; color:var(--muted); line-height:1.3; }
.empty { text-align:center; padding:40px 16px; font-size:18px; font-weight:700; }
/* details */
.banner { position:relative; height:180px; background:var(--teal) center/cover no-repeat; }
.banner::after { content:''; position:absolute; inset:0; background:linear-gradient(#003e4a66, #003e4ad9); }
.banner .back { position:absolute; top:12px; left:12px; z-index:1; width:48px; height:48px; border-radius:50%; border:0; background:#ffffffe6; display:grid; place-items:center; }
.head { display:flex; gap:16px; align-items:flex-end; margin-top:-90px; position:relative; z-index:1; padding:0 16px; max-width:1200px; margin-left:auto; margin-right:auto; }
.head .cover { width:130px; flex:none; border:4px solid #fff; }
@container (min-width:640px) { .banner { height:260px; } .head { margin-top:-120px; } .head .cover { width:180px; } }
.titles { padding-bottom:6px; min-width:0; }
.titles h1 { overflow-wrap:anywhere; }
.tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.tag { background:#E0F7FB; border-radius:999px; padding:3px 12px; font-size:13px; font-weight:900; }
.btns { display:flex; flex-wrap:wrap; gap:10px; }
.btn { min-height:52px; padding:0 24px; border-radius:999px; border:2px solid var(--cyan); background:var(--card); font-weight:900; font-size:17px; display:inline-flex; align-items:center; gap:8px; }
.btn.primary { background:var(--cyan); }
.stats { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
.stat { background:var(--card); border:2px solid var(--line); border-radius:16px; padding:12px 8px; text-align:center; }
.stat b { display:block; font-size:24px; font-weight:900; }
.stat small { font-size:13px; font-weight:700; color:var(--muted); }
.shots { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom:6px; }
.shots img { height:300px; border-radius:16px; scroll-snap-align:start; flex:none; border:2px solid var(--line); background:#0A0E1A; }
.card { background:var(--card); border:2px solid var(--line); border-radius:20px; padding:16px; }
.card p { margin:0; line-height:1.5; font-size:16px; }
ol.steps { margin:0; padding:0; list-style:none; display:grid; gap:10px; counter-reset:s; }
ol.steps li { display:flex; gap:12px; align-items:flex-start; line-height:1.4; counter-increment:s; }
ol.steps li::before { content:counter(s); flex:none; width:32px; height:32px; border-radius:50%; background:var(--cyan); display:grid; place-items:center; font-weight:900; }
ul.know { margin:0; padding:0; list-style:none; display:grid; gap:8px; }
ul.know li { display:flex; gap:8px; align-items:flex-start; line-height:1.4; }
ul.know li span { color:#00839A; flex:none; margin-top:2px; }
`;

class TotsGames extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.query = '';
    this.category = 'All';
    this.view = null;
    // ?preview in the page address shows games that are waiting for review ("status": "review") as playable
    try { this.preview = new URLSearchParams(location.search).has('preview'); } catch { this.preview = false; }
  }

  isLive(g) { return g.status === 'live' || (g.status === 'review' && this.preview); }

  // Clean Up Crew style progress (progressType "stars"): best stars, the badge, the class streak
  starStats(g) {
    try {
      const d = JSON.parse(localStorage.getItem(g.saveKey)) || {};
      const s = d.save || {};
      return { best: s.best || 0, badge: !!s.captain, streak: (s.streak && s.streak.count) || 0 };
    } catch { return { best: 0, badge: false, streak: 0 }; }
  }

  connectedCallback() {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    this.shadow.innerHTML = `<style>${CSS}</style><div class="app"><div class="empty">Loading games…</div></div>`;
    this.app = this.shadow.querySelector('.app');
    this.app.addEventListener('click', (e) => this.onClick(e));
    this.app.addEventListener('input', (e) => {
      if (e.target.name === 'q') { this.query = e.target.value; this.renderGrid(); }
    });
    this.base = new URL(this.getAttribute('data-url') || './', SCRIPT_URL || location.href);
    fetch(new URL('games.json', this.base))
      .then((r) => r.json())
      .then((data) => { this.data = data; this.render(); })
      .catch(() => { this.app.innerHTML = '<div class="empty">The games could not load. Try again in a moment.</div>'; });
  }

  url(path) { return path ? new URL(path, this.base).href : ''; }

  progressFor(game) {
    if (!game.progressKey) return null;
    try {
      const p = JSON.parse(localStorage.getItem(game.progressKey));
      if (!p || !p.cases || !Object.keys(p.cases).length) return null;
      const entries = Object.values(p.cases);
      const solved = entries.filter((c) => c.magnifiers >= 1).length;
      let next = null;
      for (let n = 1; n <= game.totalLevels; n++) {
        const open = n === 1 || (p.cases[n - 1]?.magnifiers ?? 0) >= 1;
        if (open && !(p.cases[n]?.magnifiers >= 1)) { next = n; break; }
      }
      return {
        solved, next: next || p.last || 1,
        best: Math.max(0, ...entries.map((c) => c.best || 0)),
        magnifiers: entries.reduce((s, c) => s + (c.magnifiers || 0), 0),
      };
    } catch { return null; }
  }

  playHref(game, params) {
    const u = new URL(game.playUrl, location.href);
    for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
    return u.href;
  }

  render() {
    if (this.view) return this.renderDetails(this.data.games.find((g) => g.slug === this.view));
    const keep = this.data.games.map((g) => ({ g, p: this.isLive(g) && this.progressFor(g) })).find((x) => x.p);
    this.app.innerHTML = `
      <div class="wrap">
        <div class="top">${this.getAttribute('exit-label') ? `<button class="round" data-exit aria-label="${esc(this.getAttribute('exit-label'))}">${ICON.back}</button>` : ''}<h1>Games</h1></div>
        <label class="search">${ICON.search}<input name="q" type="search" placeholder="Find a game" aria-label="Find a game" value="${esc(this.query)}" autocomplete="off"></label>
        <div class="chips" role="group" aria-label="Game types">
          ${['All', ...this.data.categories].map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === this.category}">${esc(c)}</button>`).join('')}
        </div>
        ${keep ? `<a class="keep" href="${esc(this.playHref(keep.g, { case: keep.p.next }))}" data-play="${esc(keep.g.slug)}" data-case="${keep.p.next}">
          <img src="${esc(this.url(keep.g.cover))}" alt="">
          <div><div class="k">Keep playing</div><div class="t">${esc(keep.g.title)} · ${esc(keep.g.levelName)} ${keep.p.next}</div></div>
          <span class="go">${ICON.play}</span></a>` : ''}
        <div class="grid-slot"></div>
      </div>`;
    this.renderGrid();
  }

  renderGrid() {
    const slot = this.app.querySelector('.grid-slot');
    if (!slot) return;
    const q = this.query.trim().toLowerCase();
    const games = this.data.games.filter((g) =>
      (this.category === 'All' || (g.categories || []).includes(this.category)) &&
      (!q || [g.title, ...(g.categories || [])].some((t) => t.toLowerCase().includes(q))));
    if (!games.length) {
      slot.innerHTML = `<div class="empty">No games match "${esc(this.query || this.category)}" yet.<br>Try another word, or tap All.</div>`;
      return;
    }
    const filtered = q || this.category !== 'All';
    const mystery = filtered ? 0 : this.data.mysteryTiles || 0;
    slot.innerHTML = `<div class="grid">
      ${games.map((g) => {
        const live = this.isLive(g);
        // a game waiting for review keeps its plain tile (no new cover) until it goes live
        const cover = g.cover && (live || g.status !== 'review') ? `<img src="${esc(this.url(g.cover))}" alt="" loading="lazy">` : `<div class="placeholder">${esc(g.title)}</div>`;
        const label = live && g.status === 'review' ? 'PREVIEW' : g.badge;
        const badge = label ? `<span class="badge ${live ? '' : 'soon'}">${esc(label)}</span>` : '';
        const inner = `<div class="cover">${cover}${badge}</div><span class="name">${esc(g.title)}</span><span class="desc">${esc(g.description)}</span>`;
        return live
          ? `<button class="tile" data-game="${esc(g.slug)}" aria-label="${esc(`${g.title}. ${g.description}`)}">${inner}</button>`
          : `<div class="tile soon-tile" aria-label="${esc(`${g.title}, coming soon`)}">${inner}</div>`;
      }).join('')}
      ${Array.from({ length: mystery }, () => `<div class="tile" aria-hidden="true"><div class="cover"><div class="placeholder mystery">${ICON.question}</div></div><span class="name">Mystery game</span><span class="desc">Something new is on the way.</span></div>`).join('')}
    </div>`;
  }

  renderDetails(g) {
    if (!g) { this.view = null; return this.render(); }
    const p = this.progressFor(g);
    const stars = g.progressType === 'stars' ? this.starStats(g) : null;
    const second = g.secondary
      ? `<a class="btn" href="${esc(this.playHref(g, { screen: g.secondary.screen }))}" data-play="${esc(g.slug)}" data-screen="${esc(g.secondary.screen)}">${ICON[g.secondary.icon] || ICON.play} ${esc(g.secondary.label)}</a>`
      : g.levelName ? `<a class="btn" href="${esc(this.playHref(g, { screen: 'cases' }))}" data-play="${esc(g.slug)}" data-screen="cases">${ICON.folder} Pick a ${esc(g.levelName.toLowerCase())}</a>` : '';
    const stats = stars
      ? `<div class="stat"><b>${stars.best}/3</b><small>Best stars</small></div>
            <div class="stat"><b>${stars.badge ? 'Yes' : 'Not yet'}</b><small>Captain badge</small></div>
            <div class="stat"><b>${stars.streak}</b><small>Class streak (days)</small></div>`
      : `<div class="stat"><b>${p ? p.solved : 0}/${g.totalLevels}</b><small>${esc(g.levelName)}s solved</small></div>
            <div class="stat"><b>${p ? p.best : 0}</b><small>Best score</small></div>
            <div class="stat"><b>${p ? p.magnifiers : 0}</b><small>Magnifiers</small></div>`;
    this.app.innerHTML = `
      <div class="banner" style="background-image:url('${esc(this.url(g.banner || g.cover))}')">
        <button class="back" data-back aria-label="Back to games">${ICON.back}</button>
      </div>
      <div class="head">
        <div class="cover"><img src="${esc(this.url(g.cover))}" alt="${esc(g.title)} cover"></div>
        <div class="titles">
          <h1>${esc(g.title)}</h1>
        </div>
      </div>
      <div class="wrap">
        <div>
          <div class="pub">${esc(g.publisher)}</div>
          <div class="tags">${(g.categories || []).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>
        </div>
        <div class="btns">
          <a class="btn primary" href="${esc(this.playHref(g, p ? { case: p.next } : {}))}" data-play="${esc(g.slug)}" data-case="${p ? p.next : ''}">${ICON.play} ${p ? `Keep playing · ${esc(g.levelName)} ${p.next}` : 'Play'}</a>
          ${second}
        </div>
        <section>
          <h2>Your progress</h2>
          <div class="stats">
            ${stats}
          </div>
        </section>
        ${(g.screenshots || []).length ? `<section><h2>Screenshots</h2><div class="shots">${g.screenshots.map((s, i) => `<img src="${esc(this.url(s))}" alt="${esc(g.title)} screenshot ${i + 1}" loading="lazy">`).join('')}</div></section>` : ''}
        <section class="card"><h2>About this game</h2><p>${esc(g.about)}</p></section>
        <section class="card"><h2>How to play</h2><ol class="steps">${(g.howToPlay || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
        <section class="card"><h2>Good to know</h2><ul class="know">${(g.goodToKnow || []).map((s) => `<li><span>${ICON.check}</span>${esc(s)}</li>`).join('')}</ul></section>
      </div>`;
    this.app.querySelector('[data-back]').focus({ preventScroll: true });
  }

  onClick(e) {
    const play = e.target.closest('[data-play]');
    if (play && this.hasAttribute('in-app')) {
      e.preventDefault();
      const g = this.data.games.find((x) => x.slug === play.dataset.play) || {};
      // embed: the game's own script and tag, so the host page can draw it in place
      const detail = { slug: g.slug, case: Number(play.dataset.case) || null, screen: play.dataset.screen || null,
        script: g.embed ? this.url(g.embed.script) : null, tag: g.embed ? g.embed.tag : null, title: g.title };
      this.dispatchEvent(new CustomEvent('games-play', { detail, bubbles: true, composed: true }));
      return;
    }
    if (e.target.closest('[data-exit]')) {
      this.dispatchEvent(new CustomEvent('games-exit', { bubbles: true, composed: true }));
      return;
    }
    const chip = e.target.closest('[data-cat]');
    if (chip) {
      this.category = chip.dataset.cat;
      this.app.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', b === chip));
      return this.renderGrid();
    }
    const tile = e.target.closest('[data-game]');
    if (tile) { this.view = tile.dataset.game; this.render(); this.scrollIntoView({ block: 'start' }); return; }
    if (e.target.closest('[data-back]')) { this.view = null; this.render(); }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('tots-games')) customElements.define('tots-games', TotsGames);
})();

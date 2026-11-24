// <word-play-game> — The Word Play, a falling-letter word game for totsmots.com.
// One self-contained custom element. All words, levels and tuning numbers live in ./data.
//
// Attributes (set from Velo):
//   member-id     the logged-in member's ID (empty for guests)
//   logged-in     "true" when a member is logged in
//   progress      JSON of the member's saved progress (from the WordPlayProgress collection)
//   data-url      where the data folder lives (defaults to ./data next to this file)
//   song-seconds  testing only: end every case after this many seconds
// Events (listen from Velo):
//   progress-change  detail: { memberId, progress, result }  -> save to the member's account
//   game-audio       detail: { playing: true|false }        -> hide/pause the site music player

(() => {
// Where this script was loaded from, so the data folder can be found next to it.
const SCRIPT_URL = (typeof document !== 'undefined' && (document.currentScript?.src ||
  [...document.querySelectorAll('script[src]')].map((s) => s.src).find((u) => /word-play-game\.js(\?|$)/.test(u)))) || '';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Patrick+Hand&family=Permanent+Marker&display=swap';
const STORAGE_KEY = 'wordplay-progress-v1';
const VOWELS = ['A', 'E', 'I', 'O', 'U'];

// ---------- small helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (s) => {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
};
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function weightedPick(weights, exclude = []) {
  const entries = Object.entries(weights).filter(([k]) => !exclude.includes(k));
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries[entries.length - 1][0];
}
function pickIndex(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) <= 0) return i;
  return 0;
}
function parseWordFile(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, ''))
    .join(' ')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => /^[a-z]+$/.test(w));
}

// ---------- icons (line icons only) ----------
const svg = (body, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  pause: svg('<path d="M9 5v14M15 5v14"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>', 28),
  right: svg('<path d="M9 5l7 7-7 7"/>', 28),
  turn: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>', 28),
  drop: svg('<path d="M12 4v13M6 11l6 6 6-6M5 21h14"/>', 28),
  clue: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 20),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  restart: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>'),
  crown: svg('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>', 18),
};
const magnifier = (filled, size = 26) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10" cy="10" r="6.5" ${filled ? 'fill="currentColor" fill-opacity=".35"' : ''}/><path d="M15 15l6 6"/></svg>`;
const magnifiers = (n, size) =>
  `<span class="mags ${n ? '' : 'none'}" role="img" aria-label="${n} of 3 magnifiers">${[0, 1, 2]
    .map((i) => `<span class="mag ${i < n ? 'on' : ''}">${magnifier(i < n, size)}</span>`)
    .join('')}</span>`;

// ---------- pure game logic (no DOM) ----------
function pointsFor(len, cfg) {
  if (len <= 5) return cfg.points[String(len)] ?? 0;
  return cfg.points['5'] + (len - 5) * cfg.points.extraPerLetterAfter5;
}

// Finds words in every row, left to right only. In each run of touching tiles the longest
// word wins; leftover letters on either side are checked again.
function findWords(grid, dict, minLen) {
  const found = [];
  const scan = (letters, start, r) => {
    for (let len = letters.length; len >= minLen; len--) {
      for (let s = 0; s + len <= letters.length; s++) {
        const word = letters.slice(s, s + len).join('');
        if (dict.has(word)) {
          found.push({ row: r, start: start + s, len, word });
          scan(letters.slice(0, s), start, r);
          scan(letters.slice(s + len), start + s + len, r);
          return;
        }
      }
    }
  };
  grid.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) { c++; continue; }
      const start = c;
      const letters = [];
      while (c < row.length && row[c]) letters.push(row[c++].ch.toLowerCase());
      if (letters.length >= minLen) scan(letters, start, r);
    }
  });
  return found;
}

// Blocks fall straight down into any gaps in their column.
function settle(grid) {
  const rows = grid.length, cols = grid[0].length;
  let moved = false;
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[r][c]) {
        if (r !== write) { grid[write][c] = grid[r][c]; grid[r][c] = null; moved = true; }
        write--;
      }
    }
  }
  return moved;
}
const columnTop = (grid, c) => {
  for (let r = 0; r < grid.length; r++) if (grid[r][c]) return r;
  return grid.length;
};

// ---------- styles ----------
const CSS = `
:host { display:block; --night:#0A0E1A; --panel:#121B33; --cell:#18223D; --line:#2A3756; --gold:#F5C02A; --pink:#FF4FB3;
  --red:#E8262B; --red2:#D11F24; --paper:#F3E9D2; --muted:#B9C3DD; --ink:#0A0E1A;
  font-family: Lato, system-ui, sans-serif; color:var(--paper); }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
button:focus-visible, [tabindex]:focus-visible { outline:3px solid var(--pink); outline-offset:2px; }
[hidden] { display:none !important; }
.app { container-type:inline-size; position:relative; background:var(--night); min-height:100dvh; width:100%;
  background-image: radial-gradient(ellipse at 50% -10%, #1c2850 0%, transparent 60%); user-select:none; -webkit-user-select:none; }
.screen { max-width:980px; margin:0 auto; padding:12px 14px 18px; display:flex; flex-direction:column; gap:12px; min-height:100dvh; }
.marker { font-family:'Permanent Marker', 'Lato', cursive; letter-spacing:.5px; }
.hand { font-family:'Patrick Hand', 'Lato', cursive; }
.btn { min-height:48px; min-width:48px; border-radius:999px; border:2px solid var(--line); background:var(--panel); padding:10px 22px;
  font-family:'Permanent Marker', Lato, cursive; font-size:18px; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.btn.primary { background:var(--gold); color:var(--ink); border-color:var(--gold); }
.btn.pink { background:var(--pink); color:var(--ink); border-color:var(--pink); }
.btn:active { transform:translateY(1px); }
.icon-btn { width:48px; height:48px; border-radius:14px; border:2px solid var(--line); background:var(--panel); display:grid; place-items:center; flex:none; }
.muted { color:var(--muted); }
.center { text-align:center; }

/* title */
.title { justify-content:center; align-items:center; text-align:center; gap:22px; }
.logo .presents { font-family:'Patrick Hand', cursive; font-size:22px; color:var(--muted); }
.logo .name { font-family:'Permanent Marker', cursive; font-size:clamp(44px, 13cqw, 88px); line-height:1; margin-top:4px; transform:rotate(-3deg); }
.logo .name b { color:var(--red); font-weight:400; display:block; font-size:1.25em; text-shadow:3px 3px 0 #000; }
.card { background:var(--panel); border:2px solid var(--line); border-radius:18px; padding:16px; width:100%; max-width:420px; }
.seg { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; background:var(--cell); padding:5px; border-radius:999px; }
.seg button { min-height:48px; border:0; border-radius:999px; background:transparent; font-weight:900; font-size:16px; color:var(--muted); }
.seg button[aria-checked="true"] { background:var(--gold); color:var(--ink); }
.label { font-family:'Patrick Hand', cursive; font-size:20px; margin:0 0 8px; text-align:left; }
.row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.switch { width:64px; height:36px; border-radius:999px; border:2px solid var(--line); background:var(--cell); position:relative; flex:none; min-height:44px; }
.switch::after { content:''; position:absolute; top:5px; left:6px; width:26px; height:26px; border-radius:50%; background:var(--muted); transition:left .15s; }
.switch[aria-checked="true"] { background:var(--gold); border-color:var(--gold); }
.switch[aria-checked="true"]::after { left:30px; background:var(--ink); }

/* case files */
.topbar { display:flex; align-items:center; gap:12px; }
.topbar h1 { font-family:'Permanent Marker', cursive; font-weight:400; font-size:28px; margin:0; flex:1; }
.progress { height:12px; border-radius:999px; background:var(--cell); border:1px solid var(--line); overflow:hidden; }
.progress > i { display:block; height:100%; background:var(--gold); }
.cases { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
@container (min-width:640px) { .cases { grid-template-columns:repeat(6,1fr); } }
.case { min-height:82px; border-radius:14px; border:2px solid var(--line); background:var(--panel); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:6px; }
.case .num { font-weight:900; font-size:22px; }
.case.solved { background:var(--paper); color:var(--ink); border-color:var(--paper); transform:rotate(-1.5deg); }
.case.solved:nth-child(even) { transform:rotate(1.5deg); }
.case.next { background:var(--pink); color:var(--ink); border-color:var(--pink); }
.case.locked { color:var(--muted); background:var(--cell); }
.case[aria-pressed="true"] { outline:3px solid var(--gold); outline-offset:2px; }
.mags { display:inline-flex; gap:2px; }
.mag { color:var(--line); } .case .mag { color:#8a7f66; } .case .mag.on, .mag.on { color:var(--gold); }
.case.solved .mag.on { color:#8a5a00; }
.pick { position:sticky; bottom:10px; margin-top:auto; display:flex; gap:14px; align-items:center; background:var(--paper); color:var(--ink); border-radius:16px; padding:14px; box-shadow:0 8px 24px #0008; }
.pick .info { flex:1; min-width:0; }
.pick .k { font-family:'Patrick Hand', cursive; font-size:18px; }
.pick .t { font-weight:900; font-size:19px; overflow-wrap:anywhere; }
.pick .btn { flex:none; }

/* gameplay */
.game { gap:8px; padding-top:8px; }
.hud { display:flex; align-items:center; gap:10px; }
.hud .meta { flex:1; min-width:0; }
.hud .case-no { font-family:'Patrick Hand', cursive; font-size:17px; color:var(--muted); line-height:1; }
.hud .track { font-family:'Permanent Marker', cursive; font-size:20px; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hud .score { text-align:right; }
.hud .score small { display:block; font-size:12px; color:var(--muted); font-weight:700; letter-spacing:1px; text-transform:uppercase; }
.hud .score b { font-size:26px; font-weight:900; color:var(--gold); font-variant-numeric:tabular-nums; }
.songbar { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:700; }
.songbar .progress { flex:1; height:10px; }
.songbar .progress > i { background:var(--pink); }
.chip { border-radius:999px; padding:3px 10px; border:2px solid var(--gold); color:var(--gold); font-weight:900; font-size:13px; text-transform:uppercase; letter-spacing:.5px; }
.playfield { display:flex; gap:10px; justify-content:center; align-items:flex-start; }
.board-wrap { position:relative; flex:none; --bh: max(300px, min(calc(100dvh - 290px), calc((100cqw - 136px) * 12 / 7), 860px)); }
.board { height:var(--bh); aspect-ratio: 7 / 12; display:grid; grid-template-columns:repeat(7,1fr); grid-template-rows:repeat(12,1fr);
  gap:3px; padding:4px; background:var(--panel); border:2px solid var(--line); border-radius:12px; font-size:calc(var(--bh) / 12 * .55); }
.cell { border-radius:6px; background:var(--cell); display:grid; place-items:center; font-weight:900; line-height:1; color:var(--ink); position:relative; }
.cell.danger { background:#1f1a36; }
.cell.t-c { background:var(--paper); border-radius:5px; box-shadow:inset 0 -3px 0 #0003; }
.cell.t-v { background:var(--pink); border-radius:50%; box-shadow:inset 0 -3px 0 #0003; }
.cell.fall { background:var(--gold); }
.cell.sel { box-shadow:0 0 0 3px #fff, 0 0 12px #fff8; z-index:1; }
.cell.hint { outline:2px dashed var(--gold); outline-offset:-3px; }
.cell.ghost { background:#2a3150; }
.cell.clear { animation:glow .45s ease-out forwards; z-index:2; }
@keyframes glow { 0% { box-shadow:0 0 0 0 var(--pink); } 60% { box-shadow:0 0 18px 6px var(--pink); transform:scale(1.12); } 100% { box-shadow:0 0 22px 8px #fff; transform:scale(.2); opacity:0; } }
.tape { position:absolute; left:-8px; right:-8px; top:calc(4px + (var(--bh) - 8px) * var(--line-rows, 3) / 12 - 9px); height:18px; pointer-events:none;
  background:var(--gold); color:var(--ink); font-weight:900; font-size:11px; letter-spacing:1px; white-space:nowrap; overflow:hidden;
  display:flex; align-items:center; box-shadow:0 2px 6px #0009; transform:rotate(-1deg); z-index:3; opacity:.96; }
.tape span { padding-left:8px; }
.pops { position:absolute; inset:0; pointer-events:none; z-index:4; }
.pop { position:absolute; left:50%; transform:translate(-50%,-50%); background:var(--pink); color:var(--ink); font-family:'Permanent Marker', cursive;
  font-size:22px; padding:4px 14px; border-radius:8px; white-space:nowrap; box-shadow:0 4px 12px #000a; animation:pop 1.2s ease-out forwards; }
.pop small { font-family:Lato, sans-serif; font-weight:900; font-size:13px; margin-left:4px; }
@keyframes pop { 0% { transform:translate(-50%,-50%) scale(.4) rotate(-6deg); opacity:0; } 15% { transform:translate(-50%,-50%) scale(1.1) rotate(-3deg); opacity:1; } 75% { opacity:1; } 100% { transform:translate(-50%,-140%) scale(1) rotate(-3deg); opacity:0; } }
.side { width:96px; display:flex; flex-direction:column; gap:10px; flex:none; }
.panel { background:var(--panel); border:2px solid var(--line); border-radius:12px; padding:8px; }
.ptitle { font-family:'Patrick Hand', cursive; font-size:18px; text-align:center; margin-bottom:6px; line-height:1; }
.opts { display:grid; grid-template-columns:1fr; gap:6px; }
.opts.five { grid-template-columns:1fr 1fr; }
.opts button { min-height:46px; border-radius:10px; border:2px solid var(--line); background:var(--paper); color:var(--ink); font-weight:900; font-size:22px; }
.opts.v button { background:var(--pink); border-radius:999px; }
.opts button[aria-pressed="true"] { border-color:#fff; box-shadow:0 0 0 2px #fff; background:var(--gold); }
.opts .empty { font-size:14px; color:var(--muted); text-align:center; padding:6px 0; font-family:'Patrick Hand', cursive; }
.next-tiles { display:flex; justify-content:center; gap:3px; min-height:30px; }
.next-tiles .cell { width:28px; height:28px; font-size:16px; }
.clue-btn { min-height:48px; border-radius:12px; border:2px solid var(--gold); background:transparent; color:var(--gold); font-family:'Permanent Marker', cursive; font-size:17px; display:flex; align-items:center; justify-content:center; gap:6px; }
.clue-btn:disabled { opacity:.45; cursor:default; }
.note { background:var(--paper); color:var(--ink); font-family:'Patrick Hand', cursive; font-size:20px; line-height:1.2; padding:8px 14px; border-radius:4px; transform:rotate(-.6deg); box-shadow:0 4px 10px #0008; position:relative; }
.note::before { content:''; position:absolute; top:-8px; left:50%; width:70px; height:16px; margin-left:-35px; background:#f5c02a99; transform:rotate(2deg); }
.controls { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.controls button { min-height:60px; border-radius:14px; border:2px solid var(--line); background:var(--panel); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-weight:900; font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
.controls button.drop { background:var(--gold); color:var(--ink); border-color:var(--gold); }
.controls button:disabled { opacity:.45; }
.evidence { display:flex; gap:6px; align-items:center; overflow-x:auto; min-height:34px; scrollbar-width:none; }
.evidence .lbl { font-family:'Patrick Hand', cursive; font-size:17px; color:var(--muted); flex:none; }
.ev { flex:none; background:var(--paper); color:var(--ink); font-weight:900; font-size:14px; padding:4px 10px; border-radius:4px; letter-spacing:1px; }
.ev:nth-child(odd) { transform:rotate(-2deg); } .ev:nth-child(even) { transform:rotate(1.5deg); }
.overlay { position:absolute; inset:0; background:#0A0E1Ae6; display:grid; place-items:center; z-index:10; padding:20px; }
.overlay .card { display:flex; flex-direction:column; gap:12px; text-align:center; }
.overlay h2 { font-family:'Permanent Marker', cursive; font-weight:400; font-size:34px; margin:0 0 4px; }
.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

/* results */
.result { align-items:center; text-align:center; justify-content:center; gap:16px; }
.stamp { font-family:'Permanent Marker', cursive; font-size:clamp(40px, 12cqw, 72px); color:var(--red); border:6px solid var(--red2); border-radius:10px; padding:4px 18px; transform:rotate(-8deg); text-shadow:2px 2px 0 #000; }
.result h2 { font-family:'Permanent Marker', cursive; font-weight:400; font-size:clamp(30px, 8cqw, 48px); margin:0; }
.result .mags .mag svg { width:52px; height:52px; }
.stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; width:100%; max-width:460px; }
.stat { background:var(--panel); border:2px solid var(--line); border-radius:14px; padding:10px 6px; }
.stat b { display:block; font-size:24px; font-weight:900; color:var(--gold); overflow-wrap:anywhere; }
.stat small { color:var(--muted); font-weight:700; font-size:13px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-width:460px; }
.actions { display:flex; flex-direction:column; gap:10px; width:100%; max-width:360px; }
.loading { display:grid; place-items:center; min-height:60dvh; font-family:'Patrick Hand', cursive; font-size:24px; }
`;

// ---------- the element ----------
class WordPlayGame extends HTMLElement {
  static get observedAttributes() { return ['progress']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.mode = 'easy';
    this.clues = true;
    this.selectedCase = null;
    this.g = null;
    this.audio = null;
  }

  connectedCallback() {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    this.shadow.innerHTML = `<style>${CSS}</style><div class="app"><div class="loading">Opening the case files…</div></div>`;
    this.app = this.shadow.querySelector('.app');
    this.app.addEventListener('click', (e) => this.onClick(e));
    this.app.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this._key = (e) => this.onKey(e);
    this._vis = () => { if (document.hidden) this.pause(); };
    window.addEventListener('keydown', this._key);
    document.addEventListener('visibilitychange', this._vis);
    window.addEventListener('pagehide', this._vis);
    this.load().catch((err) => {
      console.error(err);
      this.app.innerHTML = `<div class="loading center">The case files would not open.<br><small class="muted">${esc(err.message)}</small></div>`;
    });
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._key);
    document.removeEventListener('visibilitychange', this._vis);
    window.removeEventListener('pagehide', this._vis);
    this.stopGame();
  }

  attributeChangedCallback(name) {
    if (name === 'progress' && this.data) {
      this.progress = this.loadProgress();
      if (this.screen === 'cases') this.showCases();
    }
  }

  async load() {
    const base = new URL(this.getAttribute('data-url') || './data/', SCRIPT_URL || location.href);
    const get = (f) => fetch(new URL(f, base)).then((r) => {
      if (!r.ok) throw new Error(`${f}: ${r.status}`);
      return f.endsWith('.json') ? r.json() : r.text();
    });
    const [config, levels, words, block] = await Promise.all([
      get('config.json'), get('levels.json'), get('words.txt'), get('blocklist.txt'),
    ]);
    const blocked = new Set(parseWordFile(block));
    this.data = { config, levels, dict: new Set(parseWordFile(words).filter((w) => !blocked.has(w))) };
    this.progress = this.loadProgress();
    // Links from the Games page: ?case=N opens the case files with that case picked,
    // ?screen=cases opens the case files. Songs still start only on the player's tap.
    const params = new URLSearchParams(location.search);
    const n = Number(params.get('case'));
    if (n >= 1 && n <= levels.cases.length && this.isUnlocked(n)) { this.selectedCase = n; this.showCases(); }
    else if (params.get('screen') === 'cases' || n) this.showCases();
    else this.showTitle();
  }

  // ---------- progress ----------
  get memberId() { return this.getAttribute('logged-in') === 'true' ? this.getAttribute('member-id') || '' : ''; }

  loadProgress() {
    const empty = { cases: {}, last: 1, mode: 'easy', clues: true };
    let p = null;
    if (this.memberId && this.getAttribute('progress')) {
      try { p = JSON.parse(this.getAttribute('progress')); } catch { /* fall back to device */ }
    }
    if (!p) { try { p = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* private mode */ } }
    p = { ...empty, ...(p || {}) };
    this.mode = this.data.config.modes[p.mode] ? p.mode : 'easy';
    this.clues = p.clues !== false;
    return p;
  }

  saveProgress(result) {
    this.progress.mode = this.mode;
    this.progress.clues = this.clues;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress)); } catch { /* storage full or blocked */ }
    this.dispatchEvent(new CustomEvent('progress-change', {
      detail: { memberId: this.memberId, progress: this.progress, result }, bubbles: true, composed: true,
    }));
  }

  isUnlocked(n) { return n === 1 || (this.progress.cases[n - 1]?.magnifiers ?? 0) >= 1; }
  nextUp() {
    const total = this.data.levels.cases.length;
    for (let n = 1; n <= total; n++) if (!this.progress.cases[n]?.magnifiers && this.isUnlocked(n)) return n;
    return null;
  }

  // ---------- screens ----------
  show(name, html) {
    this.screen = name;
    this.app.innerHTML = html;
    const focus = this.app.querySelector('[data-autofocus]');
    if (focus) focus.focus({ preventScroll: true });
  }

  showTitle() {
    const modes = this.data.config.modes;
    this.show('title', `
      <section class="screen title">
        <div class="logo" role="img" aria-label="Tots Mots presents The Word Play">
          <div class="presents">Tots Mots presents</div>
          <div class="name">The Word <b>PLAY</b></div>
        </div>
        <div class="card">
          <p class="label" id="mode-lbl">How tricky?</p>
          <div class="seg" role="radiogroup" aria-labelledby="mode-lbl">
            ${Object.entries(modes).map(([k, m]) => `<button role="radio" aria-checked="${k === this.mode}" data-action="mode" data-mode="${k}">${esc(m.label)}</button>`).join('')}
          </div>
          <div class="row" style="margin-top:14px">
            <span class="label" id="clue-lbl" style="margin:0">Clues</span>
            <button class="switch" role="switch" aria-checked="${this.clues}" aria-labelledby="clue-lbl" data-action="clues"></button>
          </div>
        </div>
        <button class="btn primary" data-action="cases" data-autofocus>${ICON.folder} Open the case files</button>
      </section>`);
  }

  showCases() {
    this.stopGame();
    const cases = this.data.levels.cases;
    const solved = cases.filter((c) => (this.progress.cases[c.case]?.magnifiers ?? 0) >= 1).length;
    const next = this.nextUp();
    if (!this.selectedCase || !this.isUnlocked(this.selectedCase)) this.selectedCase = next ?? this.progress.last ?? 1;
    const sel = cases[this.selectedCase - 1];
    const selP = this.progress.cases[sel.case];
    this.show('cases', `
      <section class="screen">
        <div class="topbar">
          <button class="icon-btn" data-action="title" aria-label="Back to title">${ICON.back}</button>
          <h1>Case Files</h1>
          <span class="chip">${esc(this.data.config.modes[this.mode].label)}</span>
        </div>
        <div>
          <div class="row hand" style="font-size:18px;margin-bottom:6px"><span>Cases solved</span><span>${solved} of ${cases.length}</span></div>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${cases.length}" aria-valuenow="${solved}" aria-label="Cases solved"><i style="width:${(solved / cases.length) * 100}%"></i></div>
        </div>
        <div class="cases">
          ${cases.map((c) => {
            const p = this.progress.cases[c.case];
            const open = this.isUnlocked(c.case);
            const state = p?.magnifiers ? 'solved' : c.case === next ? 'next' : open ? 'open' : 'locked';
            const label = `Case ${c.case}, ${c.trackTitle}${state === 'locked' ? ', locked' : state === 'solved' ? `, solved, ${p.magnifiers} magnifiers` : state === 'next' ? ', up next' : ''}`;
            return `<button class="case ${state}" data-action="select" data-case="${c.case}" aria-pressed="${c.case === this.selectedCase}" aria-label="${esc(label)}" ${open ? '' : 'aria-disabled="true"'}>
              <span class="num">${pad2(c.case)}</span>
              ${state === 'solved' ? magnifiers(p.magnifiers, 16) : state === 'locked' ? ICON.lock : ''}
            </button>`;
          }).join('')}
        </div>
        <div class="pick">
          <div class="info">
            <div class="k">Case ${pad2(sel.case)}${selP?.best ? ` · best ${selP.best}` : ''}</div>
            <div class="t">${esc(sel.trackTitle)}</div>
          </div>
          <button class="btn primary" data-action="play" data-autofocus>${ICON.play} Play</button>
        </div>
      </section>`);
  }

  // ---------- gameplay ----------
  startCase(n) {
    this.stopGame();
    const { config, levels } = this.data;
    const lvl = levels.cases[n - 1];
    const m = config.modes[this.mode];
    const { columns: cols, rows } = config.board;
    // The case line sits lower (less room) on harder modes; see caseLineRows in config.json.
    const line = m.caseLineRows ?? config.board.caseLineRows;
    const override = Number(this.getAttribute('song-seconds')) || 0;
    this.selectedCase = n;
    this.progress.last = n;
    this.g = {
      n, lvl, m, cols, rows, line, override,
      grid: Array.from({ length: rows }, () => Array(cols).fill(null)),
      piece: null, next: null, score: 0, words: [], elapsed: 0, dropTimer: 0,
      duration: override || lvl.duration || 120, resolving: false, paused: false, over: false, clue: null, nextId: 1,
    };
    this.g.next = this.makePiece();
    this.renderGameShell();
    this.spawn();

    if (lvl.audio && !override) {
      const a = new Audio(lvl.audio);
      a.preload = 'auto';
      a.addEventListener('loadedmetadata', () => { if (isFinite(a.duration) && a.duration > 1 && this.g) this.g.duration = a.duration; });
      a.addEventListener('error', () => { if (this.audio === a) this.audioFailed = true; });
      this.audio = a;
      this.audioFailed = false;
      a.play().catch(() => { if (this.audio === a) this.audioFailed = true; });
      this.emitAudio(true);
    } else {
      this.audioFailed = true;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  stopGame() {
    cancelAnimationFrame(this.raf);
    if (this.audio) { this.audio.pause(); this.audio.src = ''; this.audio = null; this.emitAudio(false); }
    if (this.g) this.g.over = true;
    this.g = null;
  }

  emitAudio(playing) {
    this.dispatchEvent(new CustomEvent('game-audio', { detail: { playing }, bubbles: true, composed: true }));
    if (playing) { this.hushPage(); this.lastHush = performance.now(); }
  }

  // Never let two songs play at once: pause any other audio or video on the page,
  // including players inside other custom elements (like the site's floating music player).
  hushPage() {
    const media = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el instanceof HTMLMediaElement) media.push(el);
        if (el.shadowRoot && el !== this) walk(el.shadowRoot);
      }
    };
    walk(document);
    for (const m of media) if (m !== this.audio && !m.paused) m.pause();
  }

  clock() {
    const g = this.g;
    if (this.audio && !this.audioFailed && !g.override) return this.audio.currentTime;
    return g.elapsed;
  }

  tick(t) {
    const g = this.g;
    if (!g || g.over) return;
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (!g.paused) {
      g.elapsed += dt;
      if (this.audio && t - (this.lastHush || 0) > 1500) { this.lastHush = t; this.hushPage(); }
      if (!g.resolving && (this.clock() >= g.duration || this.audio?.ended)) return this.win();
      if (!g.resolving && g.piece) {
        g.dropTimer += dt;
        if (g.dropTimer >= g.m.secondsPerRow) { g.dropTimer = 0; this.stepDown(); }
      }
      this.updateSongBar();
    }
    this.raf = requestAnimationFrame((tt) => this.tick(tt));
  }

  makePiece() {
    const { config } = this.data;
    const g = this.g;
    // Keep words possible: lean toward vowels when the board is short of them.
    let v = 0, c = 0;
    if (g) for (const row of g.grid) for (const cell of row) if (cell) cell.vowel ? v++ : c++;
    const chance = Math.min(0.75, Math.max(0.25, g.m.vowelChance + Math.max(-0.15, Math.min(0.25, (c - 2 * v) * 0.04))));
    if (Math.random() < chance) {
      return { cells: [{ vowel: true, options: VOWELS, ch: weightedPick(config.vowelWeights) }] };
    }
    const size = pickIndex(g.m.groupSizeWeights) + 1;
    const cells = [];
    for (let i = 0; i < size; i++) {
      const options = [];
      while (options.length < config.consonantOptions) options.push(weightedPick(config.consonantWeights, options));
      cells.push({ vowel: false, options, ch: options[0] });
    }
    return { cells };
  }

  spawn() {
    const g = this.g;
    const p = g.next;
    g.next = this.makePiece();
    p.orient = 'h';
    p.x = Math.floor((g.cols - p.cells.length) / 2);
    p.y = 0;
    p.sel = 0;
    g.piece = p;
    g.dropTimer = 0;
    g.clue = null;
    if (!this.fits(p, 0, 0)) return this.lose();
    this.renderAll();
  }

  pieceCells(p, x = p.x, y = p.y, orient = p.orient) {
    return p.cells.map((cell, i) => (orient === 'h' ? { r: y, c: x + i, cell, i } : { r: y + i, c: x, cell, i }));
  }

  fits(p, dx, dy, orient = p.orient) {
    const g = this.g;
    return this.pieceCells(p, p.x + dx, p.y + dy, orient).every(
      ({ r, c }) => c >= 0 && c < g.cols && r >= 0 && r < g.rows && !g.grid[r][c],
    );
  }

  move(dx) {
    const p = this.g.piece;
    if (p && this.fits(p, dx, 0)) { p.x += dx; this.renderBoard(); }
  }

  turn() {
    const g = this.g, p = g.piece;
    if (!p || p.cells.length < 2) return;
    const orient = p.orient === 'h' ? 'v' : 'h';
    // Try in place, then nudge away from walls or other blocks. Letters stay upright and in order.
    const tries = orient === 'h'
      ? [[0, 0], [-1, 0], [-2, 0], [1, 0], [0, -1], [-1, -1]]
      : [[0, 0], [0, -1], [0, -2], [1, 0], [-1, 0], [1, -1]];
    for (const [dx, dy] of tries) {
      if (this.fits(p, dx, dy, orient)) {
        p.x += dx; p.y += dy; p.orient = orient;
        this.renderBoard();
        return;
      }
    }
  }

  stepDown() {
    const p = this.g.piece;
    if (!p) return;
    if (this.fits(p, 0, 1)) { p.y++; this.renderBoard(); } else this.lock();
  }

  hardDrop() {
    const p = this.g.piece;
    if (!p) return;
    while (this.fits(p, 0, 1)) p.y++;
    this.lock();
  }

  selectBlock(i) {
    const p = this.g.piece;
    if (!p || i < 0 || i >= p.cells.length) return;
    p.sel = i;
    this.renderBoard();
    this.renderSide();
  }

  setLetter(ch) {
    const p = this.g.piece;
    if (!p) return;
    const cell = p.cells[p.sel];
    if (!cell.options.includes(ch)) return;
    cell.ch = ch;
    this.renderBoard();
    this.renderSide();
  }

  lock() {
    const g = this.g;
    const p = g.piece;
    g.piece = null;
    g.clue = null;
    for (const { r, c, cell } of this.pieceCells(p)) g.grid[r][c] = { ch: cell.ch, vowel: cell.vowel, id: g.nextId++ };
    settle(g.grid);
    this.renderAll();
    this.resolve();
  }

  async resolve() {
    const g = this.g;
    const { config, dict } = this.data;
    g.resolving = true;
    let chain = 0;
    for (;;) {
      const found = findWords(g.grid, dict, g.m.minWordLength);
      if (!found.length) break;
      const clearing = new Set();
      for (const w of found) {
        const mult = 1 + chain * config.chainMultiplierStep;
        const pts = pointsFor(w.len, config) * mult;
        g.score += pts;
        g.words.push(w.word.toUpperCase());
        for (let i = 0; i < w.len; i++) clearing.add(`${w.row},${w.start + i}`);
        this.popTag(w, pts, mult);
      }
      this.renderBoard(clearing);
      this.renderHud();
      this.renderEvidence();
      await sleep(config.timing.clearGlowMs);
      if (g.over) return;
      for (const key of clearing) { const [r, c] = key.split(',').map(Number); g.grid[r][c] = null; }
      settle(g.grid);
      this.renderBoard();
      await sleep(config.timing.settleMs);
      if (g.over) return;
      chain++;
    }
    g.resolving = false;
    for (let r = 0; r < g.line; r++) if (g.grid[r].some(Boolean)) return this.lose();
    if (this.clock() >= g.duration) return this.win();
    this.spawn();
  }

  popTag(w, pts, mult) {
    const g = this.g;
    const pops = this.app.querySelector('.pops');
    if (!pops) return;
    const el = document.createElement('div');
    el.className = 'pop';
    el.style.top = `${((w.row + 0.5) / g.rows) * 100}%`;
    el.innerHTML = `${esc(w.word.toUpperCase())}! +${pts}${mult > 1 ? `<small>CHAIN ×${mult}</small>` : ''}`;
    pops.appendChild(el);
    setTimeout(() => el.remove(), this.data.config.timing.popMs);
    const live = this.app.querySelector('.live');
    if (live) live.textContent = `${w.word}, ${pts} points`;
  }

  // ---------- clues ----------
  findClue() {
    const g = this.g, p = g.piece;
    const { dict, config } = this.data;
    if (!p) return null;
    const combos = p.cells.reduce((acc, cell) => acc.flatMap((a) => cell.options.map((o) => [...a, o])), [[]]);
    let best = null;
    for (const orient of p.cells.length > 1 ? ['h', 'v'] : ['h']) {
      for (let x = 0; x < g.cols; x++) {
        if (orient === 'h' && x + p.cells.length > g.cols) continue;
        for (const letters of combos) {
          const sim = g.grid.map((row) => row.slice());
          const placed = [];
          let ok = true;
          if (orient === 'h') {
            letters.forEach((ch, i) => {
              const r = columnTop(sim, x + i) - 1;
              if (r < 0) ok = false; else { sim[r][x + i] = { ch, vowel: p.cells[i].vowel, piece: i }; placed.push({ r, c: x + i, i }); }
            });
          } else {
            const top = columnTop(sim, x) - letters.length;
            if (top < 0) ok = false;
            else letters.forEach((ch, i) => { sim[top + i][x] = { ch, vowel: p.cells[i].vowel, piece: i }; placed.push({ r: top + i, c: x, i }); });
          }
          if (!ok || placed.some(({ r }) => r < g.line)) continue;
          const words = findWords(sim, dict, g.m.minWordLength).filter((w) =>
            placed.some(({ r, c }) => r === w.row && c >= w.start && c < w.start + w.len));
          if (!words.length) continue;
          const score = words.reduce((s, w) => s + pointsFor(w.len, config), 0);
          const changes = letters.filter((ch, i) => ch !== p.cells[i].ch).length;
          const rank = score * 10 - changes;
          if (!best || rank > best.rank) best = { rank, orient, x, letters, placed, words, sim };
        }
      }
    }
    return best;
  }

  useClue() {
    const g = this.g;
    if (!g?.piece || g.paused) return;
    const best = this.findClue();
    const cost = g.m.clueCost || 0;
    if (cost) { g.score = Math.max(0, g.score - cost); this.renderHud(); }
    if (!best) {
      g.clue = { text: 'No word fits here yet. Try putting a vowel next to a letter on the floor.', cells: [] };
    } else {
      const p = g.piece;
      const w = best.words[0];
      const word = w.word.toUpperCase();
      const mine = best.letters.join('');
      const switches = best.letters
        .map((ch, i) => (ch !== p.cells[i].ch ? ch : null))
        .filter(Boolean);
      // Letters already on the board right beside the new letters in the word's row.
      const row = best.sim[w.row];
      const mineCols = [];
      for (let c = w.start; c < w.start + w.len; c++) if (row[c].piece !== undefined) mineCols.push(c);
      const lc = Math.min(...mineCols) - 1, rc = Math.max(...mineCols) + 1;
      const leftCh = lc >= w.start ? row[lc].ch : null;
      const rightCh = rc < w.start + w.len ? row[rc].ch : null;
      const what = mine.length > 1 ? mine.split('').join('-') : mine;
      const where = leftCh && rightCh ? ` between the ${leftCh} and the ${rightCh}`
        : leftCh || rightCh ? ` next to the ${leftCh || rightCh}` : '';
      let text = switches.length
        ? `Switch to ${switches.join(' and ')} and land ${mine.length > 1 ? 'them' : 'it'}${where} to spell ${word}.`
        : `Land ${what}${where} to spell ${word}.`;
      if (best.orient !== p.orient) text = `Turn it. ${text}`;
      g.clue = { text, cells: best.placed.map(({ r, c }) => `${r},${c}`) };
    }
    this.renderBoard();
    this.renderClue();
  }

  // ---------- pause / end ----------
  pause() {
    const g = this.g;
    if (!g || g.paused || g.over || this.screen !== 'game') return;
    g.paused = true;
    this.audio?.pause();
    this.emitAudio(false);
    this.app.querySelector('.pause-overlay').hidden = false;
    this.app.querySelector('[data-action="resume"]').focus();
  }

  resume() {
    const g = this.g;
    if (!g?.paused) return;
    g.paused = false;
    this.last = performance.now();
    if (this.audio && !this.audioFailed) { this.audio.play().catch(() => {}); this.emitAudio(true); }
    this.app.querySelector('.pause-overlay').hidden = true;
  }

  roomToSpare() {
    const g = this.g;
    let top = g.rows;
    for (let c = 0; c < g.cols; c++) top = Math.min(top, columnTop(g.grid, c));
    return Math.max(0, top - g.line);
  }

  win() {
    const g = this.g;
    if (!g || g.over) return;
    const spare = this.roomToSpare();
    const bonus = spare * this.data.config.roomToSparePerRow;
    g.score += bonus;
    const th = g.lvl.thresholds || [0, 0, 0];
    const mags = th.filter((t) => g.score >= t).length;
    const prev = this.progress.cases[g.n] || {};
    this.progress.cases[g.n] = {
      best: Math.max(prev.best || 0, g.score),
      magnifiers: Math.max(prev.magnifiers || 0, mags),
      mode: this.mode,
      solvedAt: new Date().toISOString(),
    };
    const unlockedNow = mags >= 1 && !prev.magnifiers && g.n < this.data.levels.cases.length;
    const result = { case: g.n, won: true, score: g.score, magnifiers: mags, words: g.words.length, mode: this.mode };
    const summary = { ...g, spare, bonus, mags, unlockedNow };
    this.stopGame();
    this.saveProgress(result);
    this.showClosed(summary);
  }

  lose() {
    const g = this.g;
    if (!g || g.over) return;
    const lasted = Math.min(this.clock(), g.duration);
    const summary = { ...g, lasted };
    this.stopGame();
    this.saveProgress({ case: g.n, won: false, score: g.score, words: g.words.length, mode: this.mode });
    this.showCold(summary);
  }

  showClosed(s) {
    const longest = s.words.reduce((a, w) => (w.length > a.length ? w : a), '');
    const total = this.data.levels.cases.length;
    this.show('closed', `
      <section class="screen result">
        <div class="stamp" role="img" aria-label="Case closed">CASE CLOSED</div>
        <div class="hand" style="font-size:20px">Case ${pad2(s.n)} · ${esc(s.lvl.trackTitle)}</div>
        ${magnifiers(s.mags, 52)}
        <div class="stats">
          <div class="stat"><b>${s.score}</b><small>Score</small></div>
          <div class="stat"><b>${s.words.length}</b><small>Words</small></div>
          <div class="stat"><b>${esc(longest || '–')}</b><small>Longest</small></div>
        </div>
        ${s.bonus ? `<div class="hand muted" style="font-size:18px">Room to spare: ${s.spare} empty rows, +${s.bonus}</div>` : ''}
        ${s.words.length ? `<div class="chips" aria-label="Evidence">${s.words.map((w) => `<span class="ev">${esc(w)}</span>`).join('')}</div>` : ''}
        ${s.unlockedNow ? `<div class="note">Case ${pad2(s.n + 1)} is unlocked!</div>` : ''}
        ${!s.mags ? `<div class="note">Score ${s.lvl.thresholds[0]} points to earn a magnifier and open the next case.</div>` : ''}
        <div class="actions">
          ${s.mags && s.n < total ? `<button class="btn primary" data-action="play-case" data-case="${s.n + 1}" data-autofocus>${ICON.play} Next case</button>` : ''}
          <button class="btn" data-action="play-case" data-case="${s.n}">${ICON.restart} Replay</button>
          <button class="btn" data-action="cases">${ICON.folder} Case files</button>
        </div>
      </section>`);
  }

  showCold(s) {
    const tips = this.data.config.tips || [];
    const tip = tips[Math.floor(Math.random() * tips.length)] || '';
    this.show('cold', `
      <section class="screen result">
        <h2>The case went cold</h2>
        <div class="hand" style="font-size:22px">The stack crossed the line!</div>
        <div class="muted">You lasted <b style="color:var(--paper)">${fmtTime(s.lasted)}</b> of ${fmtTime(s.duration)} in ${esc(s.lvl.trackTitle)}</div>
        <div class="stats" style="grid-template-columns:repeat(2,1fr)">
          <div class="stat"><b>${s.score}</b><small>Score</small></div>
          <div class="stat"><b>${s.words.length}</b><small>Words</small></div>
        </div>
        ${tip ? `<div class="note"><b>Detective tip:</b> ${esc(tip)}</div>` : ''}
        <div class="actions">
          <button class="btn primary" data-action="play-case" data-case="${s.n}" data-autofocus>${ICON.restart} Reopen the case</button>
          <button class="btn" data-action="cases">${ICON.folder} Case files</button>
          <button class="btn" data-action="title">Change mode</button>
        </div>
      </section>`);
  }

  // ---------- rendering the game ----------
  renderGameShell() {
    const g = this.g;
    const cells = [];
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) cells.push(`<div class="cell" data-r="${r}" data-c="${c}"></div>`);
    this.show('game', `
      <section class="screen game">
        <header class="hud">
          <button class="icon-btn" data-action="pause" aria-label="Pause">${ICON.pause}</button>
          <div class="meta">
            <div class="case-no">Case ${pad2(g.n)}</div>
            <div class="track">${esc(g.lvl.trackTitle)}</div>
          </div>
          <div class="score"><small>Score</small><b class="score-val">0</b></div>
        </header>
        <div class="songbar">
          <div class="progress" aria-hidden="true"><i class="song-fill" style="width:0%"></i></div>
          <span class="time-left" aria-label="Time left">${fmtTime(g.duration)}</span>
          <span class="chip">${esc(g.m.label)}</span>
        </div>
        <div class="playfield">
          <div class="board-wrap" style="--line-rows:${g.line}">
            <div class="board" aria-label="Game board. Spell words left to right in a row.">${cells.join('')}</div>
            <div class="tape" aria-hidden="true"><span>${'CASE LINE · DO NOT CROSS · '.repeat(6)}</span></div>
            <div class="pops"></div>
          </div>
          <aside class="side">
            <div class="panel"><div class="ptitle" id="sw-lbl">Switch</div><div class="opts" role="group" aria-labelledby="sw-lbl"></div></div>
            <div class="panel"><div class="ptitle">Next</div><div class="next-tiles" aria-label="Next letters"></div></div>
            ${this.clues ? `<button class="clue-btn" data-action="clue">${ICON.clue} Clue</button>` : ''}
          </aside>
        </div>
        <div class="note clue-note" role="status" hidden></div>
        <div class="controls">
          <button data-ctl="left" aria-label="Move left">${ICON.left}<span>Left</span></button>
          <button data-ctl="right" aria-label="Move right">${ICON.right}<span>Right</span></button>
          <button data-ctl="turn" aria-label="Turn">${ICON.turn}<span>Turn</span></button>
          <button data-ctl="drop" class="drop" aria-label="Drop">${ICON.drop}<span>Drop</span></button>
        </div>
        <div class="evidence"><span class="lbl">Evidence</span></div>
        <div class="sr live" aria-live="polite"></div>
        <div class="overlay pause-overlay" hidden>
          <div class="card" role="dialog" aria-label="Paused">
            <h2>Paused</h2>
            <button class="btn primary" data-action="resume">${ICON.play} Resume</button>
            <button class="btn" data-action="restart">${ICON.restart} Restart</button>
            <button class="btn" data-action="cases">${ICON.folder} Case files</button>
          </div>
        </div>
      </section>`);
    this.cellEls = [...this.app.querySelectorAll('.board .cell')];
  }

  renderAll() {
    this.renderBoard();
    this.renderSide();
    this.renderHud();
    this.renderClue();
    this.updateSongBar();
  }

  renderBoard(clearing) {
    const g = this.g;
    if (!g || !this.cellEls) return;
    const falling = new Map();
    const ghost = new Set();
    if (g.piece) {
      const p = g.piece;
      for (const pc of this.pieceCells(p)) falling.set(`${pc.r},${pc.c}`, pc);
      let dy = 0;
      while (this.fits(p, 0, dy + 1)) dy++;
      if (dy > 0) for (const pc of this.pieceCells(p, p.x, p.y + dy)) ghost.add(`${pc.r},${pc.c}`);
    }
    const hint = new Set(g.clue?.cells || []);
    for (const el of this.cellEls) {
      const r = +el.dataset.r, c = +el.dataset.c, key = `${r},${c}`;
      const f = falling.get(key);
      const cell = f ? f.cell : g.grid[r][c];
      let cls = 'cell';
      if (r < g.line) cls += ' danger';
      if (cell) cls += cell.vowel ? ' t-v' : ' t-c';
      if (f) cls += ' fall' + (f.i === g.piece.sel && g.piece.cells.length > 1 ? ' sel' : '');
      else if (ghost.has(key)) cls += ' ghost';
      if (!cell && hint.has(key)) cls += ' hint';
      if (clearing?.has(key)) cls += ' clear';
      if (el.className !== cls) el.className = cls;
      const text = cell ? cell.ch : '';
      if (el.textContent !== text) el.textContent = text;
    }
  }

  renderSide() {
    const g = this.g;
    const opts = this.app.querySelector('.opts');
    if (!opts) return;
    const p = g.piece;
    if (!p) { opts.className = 'opts'; opts.innerHTML = '<div class="empty">Landing…</div>'; }
    else {
      const cell = p.cells[p.sel];
      opts.className = `opts${cell.vowel ? ' v' : ''}`;
      opts.innerHTML = cell.options
        .map((o, i) => `<button data-ctl="letter" data-letter="${o}" aria-pressed="${o === cell.ch}" aria-label="Switch to ${o}${cell.vowel ? '' : `, key ${i + 1}`}">${o}</button>`)
        .join('');
    }
    const next = this.app.querySelector('.next-tiles');
    next.innerHTML = g.next.cells.map((c) => `<div class="cell ${c.vowel ? 't-v' : 't-c'}">${c.ch}</div>`).join('');
    const turn = this.app.querySelector('[data-ctl="turn"]');
    if (turn) turn.disabled = !p || p.cells.length < 2;
    const clue = this.app.querySelector('.clue-btn');
    if (clue) clue.disabled = !p;
  }

  renderHud() {
    const el = this.app.querySelector('.score-val');
    if (el) el.textContent = this.g.score;
  }

  renderEvidence() {
    const el = this.app.querySelector('.evidence');
    if (!el) return;
    el.innerHTML = `<span class="lbl">Evidence</span>${this.g.words.slice().reverse().map((w) => `<span class="ev">${esc(w)}</span>`).join('')}`;
  }

  renderClue() {
    const el = this.app.querySelector('.clue-note');
    if (!el) return;
    const clue = this.g?.clue;
    el.hidden = !clue;
    el.textContent = clue ? clue.text : '';
  }

  updateSongBar() {
    const g = this.g;
    const fill = this.app.querySelector('.song-fill');
    if (!fill) return;
    const t = this.clock();
    fill.style.width = `${Math.min(100, (t / g.duration) * 100)}%`;
    const left = fmtTime(g.duration - t);
    const tl = this.app.querySelector('.time-left');
    if (tl.textContent !== left) tl.textContent = left;
  }

  // ---------- input ----------
  control(name, letter) {
    const g = this.g;
    if (!g || g.paused || g.over || this.screen !== 'game') return;
    if (name === 'letter') return this.setLetter(letter);
    if (!g.piece || g.resolving) return;
    if (name === 'left') this.move(-1);
    else if (name === 'right') this.move(1);
    else if (name === 'turn') this.turn();
    else if (name === 'drop') this.hardDrop();
    else if (name === 'down') { g.dropTimer = 0; this.stepDown(); }
  }

  onPointerDown(e) {
    const ctl = e.target.closest('[data-ctl]');
    if (ctl && !ctl.disabled) {
      e.preventDefault();
      this.control(ctl.dataset.ctl, ctl.dataset.letter);
      return;
    }
    const cellEl = e.target.closest('.board .cell');
    const p = this.g?.piece;
    if (cellEl && p) {
      const r = +cellEl.dataset.r, c = +cellEl.dataset.c;
      const hit = this.pieceCells(p).find((pc) => pc.r === r && pc.c === c);
      if (hit) this.selectBlock(hit.i);
    }
  }

  onClick(e) {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'mode') { this.mode = b.dataset.mode; this.saveProgress(); this.showTitle(); this.app.querySelector(`[data-mode="${this.mode}"]`).focus(); }
    else if (a === 'clues') { this.clues = !this.clues; b.setAttribute('aria-checked', this.clues); this.saveProgress(); }
    else if (a === 'cases') this.showCases();
    else if (a === 'title') { this.stopGame(); this.showTitle(); }
    else if (a === 'select') {
      const n = +b.dataset.case;
      if (!this.isUnlocked(n)) return;
      this.selectedCase = n;
      this.showCases();
      this.app.querySelector(`[data-case="${n}"]`).focus();
    }
    else if (a === 'play') this.startCase(this.selectedCase);
    else if (a === 'play-case') this.startCase(+b.dataset.case);
    else if (a === 'pause') this.pause();
    else if (a === 'resume') this.resume();
    else if (a === 'restart') this.startCase(this.g.n);
    else if (a === 'clue') this.useClue();
  }

  onKey(e) {
    if (this.screen !== 'game' || !this.g) return;
    const g = this.g;
    if (e.key === 'Escape') {
      e.preventDefault();
      return g.paused ? this.resume() : this.pause();
    }
    if (g.paused) return;
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'turn', ArrowDown: 'down', ' ': 'drop' };
    if (map[e.key]) { e.preventDefault(); return this.control(map[e.key]); }
    const p = g.piece;
    if (!p) return;
    if (e.key === 'Tab' && p.cells.length > 1) {
      e.preventDefault();
      return this.selectBlock((p.sel + (e.shiftKey ? p.cells.length - 1 : 1)) % p.cells.length);
    }
    const n = Number(e.key);
    const cell = p.cells[p.sel];
    if (n >= 1 && n <= cell.options.length) { e.preventDefault(); return this.setLetter(cell.options[n - 1]); }
    if (/^[a-z]$/i.test(e.key) && cell.options.includes(e.key.toUpperCase())) return this.setLetter(e.key.toUpperCase());
    if ((e.key === 'c' || e.key === 'C') && this.clues) this.useClue();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('word-play-game')) customElements.define('word-play-game', WordPlayGame);
if (typeof window !== 'undefined') window.WordPlayLogic = { findWords, settle, pointsFor };
})();

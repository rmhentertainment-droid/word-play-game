// <scrub-squad> — Scrub Squad, the "No Germs" handwashing game for totsmots.com (Kids mode > Games). Ages 3-8.
// Two big glossy hands (palm side + back of hand). Germs creep onto zones; the player rubs them off (finger or mouse:
// real rubbing, not taps). The song is the clock. Plain JavaScript, no build step, one self-contained custom element.
//
// Locked rules (Ryan): scrubbing removes GERMS ONLY, the skin colour never changes (foam/bubbles sit on top). A zone needs
// its full scrub time, faster rubbing does not fill it faster. Half-done zones un-clean after a grace period, clean zones
// stay clean. No shame states. The song is never cut: if it runs out it jumps back to chorus 2; finishing early plays
// the rinse + celebration while the song keeps going. No ads, purchases, outbound links or data collection (fonts and
// art are served from this folder; the only thing saved is the hands/mode choice, on the device).
//
// Files next to this script: song.json (from the Wix Songs collection via tools/pull-song.mjs, plus section markers),
// art/artwork.jpg (title card), fonts/ (Lilita One + Lato, OFL).
//
// Attributes:
//   song-src, song-title, song-duration  set from Velo page code (Songs collection); otherwise song.json is used
//   song-seconds   testing only: the song is replaced by a silent clock this many seconds long (sections scaled)
//   exit-label     set when drawn inside Kids mode: shows a back button on the title screen (fires game-exit)
//   littles-ending "full" (default: Littles hear the whole song) or "chorus" (fade out at the end of a chorus) — open item 1
//   hero-sign      present = show the "Be clean, be healthy, be a hero" sign on the celebration screen — open item 2
//   data-url       folder holding song.json, art/ and fonts/ (defaults to the folder this script came from)
// Events: game-audio {playing}, game-exit, game-finish {mode, loops, seconds}. The song announces itself with window
// event "tm-media-play" {el} so the site music player fades out; other audio on the page is paused while it plays.
(() => {
const SCRIPT_URL = (typeof document !== 'undefined' && (document.currentScript?.src ||
  [...document.querySelectorAll('script[src]')].map((s) => s.src).find((u) => /scrub-squad\.js(\?|$)/.test(u)))) || '';
const SAVE_KEY = 'scrubsquad-v1';
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const NAVY = '#041146';
const TEAL = '#00C7DF';
const PINK = '#E4025C';
const RED = '#E5322B';

// Zones per hand: 0 palm / back of hand, 1 fingers, 2 fingertips / nails, 3 thumb, 4 wrist
const MODES = {
  std: { groups: [[0], [1], [2], [3], [4]], need: 2.0, decay: 0.18, grace: 1.2, maxG: 2, germR: 15 },
  lit: { groups: [[0, 4], [1, 2], [3]], need: 2.6, decay: 0.08, grace: 2.2, maxG: 2, germR: 22 },
};
const ZONE_NAMES = [['Palm', 'Fingers', 'Fingertips', 'Thumb', 'Wrist'], ['Back of hand', 'Fingers', 'Nails', 'Thumb', 'Wrist']];
const LIT_NAMES = [['Palm and wrist', 'Fingers', 'Thumb'], ['Back of hand and wrist', 'Fingers', 'Thumb']];
// light, mid, shadow. Brown (the kid in the No Germs artwork) is first and the default.
const SKINS = [
  { name: 'Brown', c: ['#C68A5E', '#94603C', '#5E3820'] },
  { name: 'Deep brown', c: ['#8E5A3A', '#5E3520', '#341A0C'] },
  { name: 'Tan', c: ['#E8B48A', '#C98A5E', '#93603E'] },
  { name: 'Light', c: ['#FFE4D0', '#F2C3A2', '#CF9572'] },
];
const GERMS = [
  { name: 'Gloop', body: '#7BD23A', dark: '#2F7A10', tip: '#C3F77A', spk: 'ball' },
  { name: 'Boo', body: '#3FA6EC', dark: '#1A4F9C', tip: '#9EDCFF', spk: 'nub' },
  { name: 'Prickles', body: '#A85BE2', dark: '#5A1E8E', tip: '#FF6FB0', spk: 'cone' },
];
const FOAM_LIFE = 4; // seconds a soap bubble stays on the hand
const PRAISE = ['Squeaky!', 'Bye-bye, germs!', 'Sparkly!', 'Scrub-a-dub!', 'Shiny clean!', 'Germ-free zone!'];
// Fallback timing if song.json has no markers (fractions of the song are scaled to its length)
const DEFAULT_SECTIONS = [['Intro', 'intro', 0], ['Chorus', 'chorus', 0.052], ['Verse', 'verse', 0.238], ['Chorus', 'chorus', 0.425],
  ['Verse', 'verse', 0.611], ['Chorus', 'chorus', 0.797], ['Outro', 'outro', 0.96]];

// ---------- the hand (local box 240 x 330, fingers up, thumb on the right) ----------
const HW = 240;
const HH = 330;
const FING = [{ x: 28, w: 30, t: 74 }, { x: 62, w: 33, t: 34 }, { x: 99, w: 34, t: 18 }, { x: 137, w: 32, t: 40 }];
const FBASE = 176;
const TIP_LEN = 40;
const THUMB = { bx: 158, by: 238, ang: -0.88, w: 38, len: 112 }; // ang: direction from base to tip (radians)

function rrect(p, x, y, w, h, r) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
  p.moveTo(x + a, y);
  p.lineTo(x + w - b, y); p.arcTo(x + w, y, x + w, y + b, b);
  p.lineTo(x + w, y + h - c); p.arcTo(x + w, y + h, x + w - c, y + h, c);
  p.lineTo(x + d, y + h); p.arcTo(x, y + h, x, y + h - d, d);
  p.lineTo(x, y + a); p.arcTo(x, y, x + a, y, a);
  p.closePath();
}
// capsule from a base point along angle th, total length len, width w
function capsule(p, bx, by, th, w, len) {
  const r = w / 2;
  const tx = bx + Math.cos(th) * (len - r);
  const ty = by + Math.sin(th) * (len - r);
  const n = th - Math.PI / 2;
  p.moveTo(bx + Math.cos(n) * r, by + Math.sin(n) * r);
  p.lineTo(tx + Math.cos(n) * r, ty + Math.sin(n) * r);
  p.arc(tx, ty, r, n, n + Math.PI, false);
  p.lineTo(bx + Math.cos(n + Math.PI) * r, by + Math.sin(n + Math.PI) * r);
  p.arc(bx, by, r, n + Math.PI, n + TAU, false);
  p.closePath();
}
const thumbTip = () => [THUMB.bx + Math.cos(THUMB.ang) * (THUMB.len - THUMB.w / 2), THUMB.by + Math.sin(THUMB.ang) * (THUMB.len - THUMB.w / 2)];

// Drawing shapes
const SH = { palm: new Path2D(), fingers: FING.map(() => new Path2D()), thumb: new Path2D(), wrist: new Path2D() };
rrect(SH.palm, 24, 142, 152, 110, [34, 28, 44, 50]);
FING.forEach((f, i) => capsule(SH.fingers[i], f.x + f.w / 2, FBASE, -Math.PI / 2, f.w, FBASE - f.t));
capsule(SH.thumb, THUMB.bx, THUMB.by, THUMB.ang, THUMB.w, THUMB.len);
rrect(SH.wrist, 58, 232, 90, 80, [0, 0, 12, 12]);
const ALL_SH = [SH.wrist, SH.palm, SH.thumb, ...SH.fingers];
const UNION = new Path2D();
ALL_SH.forEach((p) => UNION.addPath(p));
// Zone shapes (hit tests, foam, keyboard focus ring)
const ZP = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
ZP[0].addPath(SH.palm);
FING.forEach((f) => {
  const r = f.w / 2;
  ZP[1].rect(f.x, f.t + TIP_LEN, f.w, 160 - f.t - TIP_LEN);
  ZP[2].moveTo(f.x, f.t + TIP_LEN); ZP[2].lineTo(f.x, f.t + r); ZP[2].arc(f.x + r, f.t + r, r, Math.PI, TAU); ZP[2].lineTo(f.x + f.w, f.t + TIP_LEN); ZP[2].closePath();
});
ZP[3].addPath(SH.thumb);
ZP[4].addPath(SH.wrist);
const HIT_ORDER = [3, 2, 1, 0, 4];
const hctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const inZone = (z, x, y) => hctx.isPointInPath(ZP[z], x, y);
const hitZone = (x, y) => { for (const z of HIT_ORDER) if (inZone(z, x, y)) return z; return -1; };
const inHand = (x, y) => hctx.isPointInPath(UNION, x, y);

const CSS = `
:host { display:block; position:relative; width:100%; height:100%; min-height:320px; overflow:hidden; background:#020818; color:#fff;
  font:16px/1.4 "Lato", system-ui, sans-serif; -webkit-tap-highlight-color:transparent; user-select:none; -webkit-user-select:none; }
* { box-sizing:border-box; }
.stage { position:absolute; inset:0; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; cursor:crosshair; outline:none; }
.ov { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:clamp(12px,3vw,32px); }
.hide { display:none !important; }
.lil, h1, h2 { font-family:"Lilita One", "Lato", sans-serif; font-weight:400; letter-spacing:.5px; }
button { font:inherit; color:inherit; -webkit-tap-highlight-color:transparent; }
button:focus-visible { outline:3px solid #fff; outline-offset:3px; }
/* title */
.title { background:radial-gradient(120% 90% at 30% 20%,#0d3b63ee,#041146f2 60%,#020a24fa); gap:clamp(16px,3.5vw,48px); }
.title .art { width:min(46vh,40%); aspect-ratio:1; border-radius:24px; overflow:hidden; flex:none; transform:rotate(-2deg);
  box-shadow:0 0 0 4px #ffffff30,0 18px 50px #000b; background:#0b2a52; }
.title .art img { width:100%; height:100%; object-fit:cover; display:block; }
.title .panel { width:min(520px,56%); display:flex; flex-direction:column; gap:10px; max-height:100%; padding:4px; }
.logo { margin:0; font-size:clamp(40px,6vw,76px); line-height:.92; color:${TEAL}; transform:rotate(-2deg);
  text-shadow:0 3px 0 #fff,0 7px 0 ${NAVY},0 11px 14px #0009,3px 3px 0 ${NAVY},-3px 3px 0 ${NAVY}; }
.logo b { display:block; color:${RED}; font-weight:400; font-size:.6em; }
.sub { margin:6px 0 4px; color:#d4eef8; font-weight:700; font-size:clamp(15px,1.8vw,19px); }
.row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.lab { font:900 13px "Lato",sans-serif; color:#9fd6ea; width:100%; margin-top:6px; letter-spacing:.3px; }
.chip { min-height:48px; padding:8px 16px; border-radius:999px; border:2px solid #ffffff38; background:#ffffff12; color:#fff;
  font:900 16px "Lato",sans-serif; cursor:pointer; }
.chip[aria-pressed=true] { background:${TEAL}; border-color:#fff; color:${NAVY}; box-shadow:0 3px 0 ${NAVY}; }
.sw { width:48px; height:48px; border-radius:50%; padding:0; min-height:0; position:relative; }
.sw[aria-pressed=true]::after { content:""; position:absolute; inset:-6px; border-radius:50%; border:3px solid #fff; }
.big { font-family:"Lilita One","Lato",sans-serif; font-size:clamp(26px,3.2vw,34px); padding:12px 42px 14px; border-radius:999px; border:3px solid #fff;
  background:${PINK}; color:#fff; cursor:pointer; box-shadow:0 6px 0 #7a0131,0 12px 24px #0008; letter-spacing:1px; min-height:60px; }
.big:active { transform:translateY(4px); box-shadow:0 2px 0 #7a0131; }
.big.alt { background:${TEAL}; color:${NAVY}; box-shadow:0 6px 0 #00707f,0 12px 24px #0008; }
.big.alt:active { box-shadow:0 2px 0 #00707f; }
.big[disabled] { opacity:.6; }
.round { position:absolute; top:10px; left:10px; width:52px; height:52px; border-radius:50%; border:2px solid #ffffff66; background:#041146b0;
  color:#fff; cursor:pointer; display:grid; place-items:center; z-index:3; }
.round svg { width:24px; height:24px; }
.narrow .title { flex-direction:column; justify-content:flex-start; overflow:auto; padding-top:max(64px,6vh); }
.narrow .title .art { width:min(52%,240px); }
.narrow .title .panel { width:min(520px,100%); align-items:center; text-align:center; }
.narrow .row { justify-content:center; }
.narrow .lab { text-align:center; }
.short .title .art { width:min(36vh,34%); }
/* toast */
.toast { position:absolute; left:50%; bottom:calc(var(--bot,74px) + 6px); transform:translate(-50%,0); pointer-events:none; font-family:"Lilita One","Lato",sans-serif;
  font-size:clamp(22px,3.6vw,40px); color:#fff; white-space:nowrap; opacity:0; transition:opacity .3s, transform .3s; z-index:2;
  text-shadow:0 3px 0 ${NAVY},2px 2px 0 ${NAVY},-2px 2px 0 ${NAVY},0 0 18px #00C7DF88; }
.toast.on { opacity:1; transform:translate(-50%,6px); }
/* celebrate */
.celebrate { pointer-events:none; }
/* the hands behind stay exactly as they are: the message sits on its own card */
.celebrate .card { pointer-events:auto; display:flex; flex-direction:column; align-items:center; text-align:center; max-height:100%; overflow:auto;
  background:#041146e0; border:3px solid #ffffff26; border-radius:30px; padding:clamp(16px,3vw,30px) clamp(18px,4vw,44px); box-shadow:0 20px 60px #000b; }
.celebrate h2 { margin:0; font-size:clamp(44px,8vw,100px); line-height:.95; color:${TEAL}; transform:rotate(-3deg);
  text-shadow:0 4px 0 #fff,0 8px 0 ${NAVY},5px 8px 0 ${RED},0 16px 30px #000a; animation:pop .6s cubic-bezier(.2,1.6,.4,1) both; }
.celebrate p { font:900 clamp(17px,2.3vw,24px) "Lato",sans-serif; margin:16px 0 18px; color:#fff; text-shadow:0 2px 6px #000; }
.sign { background:linear-gradient(180deg,#fbfdff,#e6eef5); color:${NAVY}; border:5px solid #1c3c6e; border-radius:10px; padding:10px 22px 12px;
  transform:rotate(2deg); box-shadow:0 10px 24px #0009; margin:0 0 20px; font-family:"Lilita One","Lato",sans-serif; font-size:clamp(18px,2.4vw,26px); line-height:1.08; }
.sign svg { display:block; margin:0 auto 4px; }
.sign i { display:block; height:5px; border-radius:3px; background:${RED}; margin-top:6px; transform:rotate(-2deg); }
@keyframes pop { from { transform:rotate(-3deg) scale(.4); opacity:0; } }
/* pause */
.pause { background:#020a24cc; flex-direction:column; gap:16px; text-align:center; }
.pause h2 { margin:0 0 6px; font-size:clamp(40px,6vw,64px); color:${TEAL}; text-shadow:0 4px 0 ${NAVY}; }
.loading { font:900 20px "Lato",sans-serif; color:#cfe9f5; }
.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (prefers-reduced-motion:reduce) { .toast { transition:none; } .celebrate h2 { animation:none; } }
`;

const ICON = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.4" fill="#fff"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" fill="#fff"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  crown: '<svg viewBox="0 0 48 28" width="46" height="27" aria-hidden="true" fill="none" stroke="#041146" stroke-width="3" stroke-linejoin="round"><path d="M4 24h40L41 6l-9 9-8-12-8 12-9-9z"/></svg>',
};

class ScrubSquad extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.prefs = { mode: 'std', skin: 0 };
    this.ready = false;
    this.S = null;
  }

  static get observedAttributes() { return ['song-src', 'song-title', 'song-duration']; }
  attributeChangedCallback(name, old, v) {
    if (!this.song || old === v || !v) return;
    const busy = this.S && this.S.phase !== 'title';
    if (name === 'song-title') { this.song.title = v; this.renderTitleText(); }
    if (name === 'song-src' && this.audio && !busy && this.song.audio !== v) { this.song.audio = v; this.audio.src = v; }
  }

  // ---------- setup ----------
  connectedCallback() {
    if (this.shadow.firstChild) { this.startLoop(); return; }
    this.base = new URL(this.getAttribute('data-url') || './', SCRIPT_URL || location.href);
    this.loadFonts();
    try { Object.assign(this.prefs, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch { /* private mode */ }
    if (!MODES[this.prefs.mode]) this.prefs.mode = 'std';
    if (!SKINS[this.prefs.skin]) this.prefs.skin = 0;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exit = this.getAttribute('exit-label');
    this.shadow.innerHTML = `<style>${CSS}</style>
      <div class="stage" role="application" aria-roledescription="game" aria-label="Scrub Squad">
        <canvas tabindex="0" aria-label="Two hands with germs on them. Rub a germ back and forth to scrub it off. Keyboard: arrow keys pick a spot, hold Space to scrub."></canvas>
        <button class="round hide" data-act="pause" aria-label="Pause">${ICON.pause}</button>
        <div class="toast" aria-hidden="true"></div>
        <div class="ov title">
          ${exit ? `<button class="round" data-act="exit" aria-label="${esc(exit)}">${ICON.back}</button>` : ''}
          <div class="art"><img alt="No Germs song artwork: a boy scrubbing soapy hands at a sink while cartoon germs panic"></div>
          <div class="panel">
            <h1 class="logo"><b class="songname"></b>Scrub Squad</h1>
            <p class="sub">Rub away every germ while the song plays. Every zone, every time!</p>
            <div class="row"><button class="big" data-act="play" disabled>Loading…</button></div>
            <div class="row" role="group" aria-label="Who's playing?"><span class="lab">Who's playing?</span>
              <button class="chip" data-mode="std">Standard · ages 5–8</button>
              <button class="chip" data-mode="lit">Littles · ages 3–5</button></div>
            <div class="row skins" role="group" aria-label="Hands"><span class="lab">Hands</span></div>
          </div>
        </div>
        <div class="ov celebrate hide"><div class="card">
          <h2>Every zone,<br>every time!</h2>
          <p>Squeaky clean! The Scrub Squad wins!</p>
          ${this.hasAttribute('hero-sign') ? `<div class="sign">${ICON.crown}Be clean<br>Be healthy<br>Be a hero<i></i></div>` : ''}
          <div class="row" style="justify-content:center"><button class="big" data-act="again">Scrub again</button><button class="big alt" data-act="title">Back</button></div>
        </div></div>
        <div class="ov pause hide" role="dialog" aria-label="Paused">
          <h2>Paused</h2>
          <button class="big" data-act="resume">Keep scrubbing</button>
          <div class="row" style="justify-content:center"><button class="big alt" data-act="restart">Start over</button><button class="big alt" data-act="title">Back</button></div>
        </div>
        <div class="sr" aria-live="polite"></div>
      </div>`;
    const $ = (s) => this.shadow.querySelector(s);
    this.cv = $('canvas');
    this.ctx = this.cv.getContext('2d');
    this.el = { title: $('.title'), celebrate: $('.celebrate'), pause: $('.pause'), pauseBtn: $('[data-act="pause"]'), toast: $('.toast'),
      live: $('.sr'), play: $('[data-act="play"]'), skins: $('.skins'), stage: $('.stage') };
    $('.title .art img').src = new URL('art/artwork.jpg', this.base).href;
    SKINS.forEach((sk, i) => {
      const b = document.createElement('button');
      b.className = 'chip sw';
      b.dataset.skin = i;
      b.style.background = `radial-gradient(circle at 35% 30%,${sk.c[0]},${sk.c[1]} 60%,${sk.c[2]})`;
      b.setAttribute('aria-label', `${sk.name} hands`);
      this.el.skins.append(b);
    });
    this.syncChips();
    this.el.stage.addEventListener('click', (e) => this.onClick(e));
    this.cv.addEventListener('pointerdown', (e) => this.onDown(e));
    this.cv.addEventListener('pointermove', (e) => this.onMove(e));
    this.cv.addEventListener('pointerup', (e) => this.onUp(e));
    this.cv.addEventListener('pointercancel', (e) => this.onUp(e));
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    this.cv.addEventListener('keydown', (e) => this.onKey(e, true));
    this.cv.addEventListener('keyup', (e) => this.onKey(e, false));
    this.cv.addEventListener('blur', () => { this.keyScrub = false; });
    this._vis = () => { if (document.hidden && this.S && (this.S.phase === 'play' || this.S.phase === 'rinse')) this.pause(); };
    document.addEventListener('visibilitychange', this._vis);
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this);
    this.S = this.freshState();
    this.fit();
    this.startLoop();
    // The game is open: the site's music player goes quiet.
    this.hushPage();
    window.dispatchEvent(new CustomEvent('tm-media-play', { detail: {} }));
    this.load();
  }

  // Leaving (Kids mode removes the element): stop everything and let go of the song; adding it again starts fresh.
  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearInterval(this.fadeT);
    clearTimeout(this.toastT);
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio = null; }
    this.emitAudio(false);
    if (this.ac) { this.ac.close().catch(() => {}); this.ac = null; this.rubGain = null; this.rubBp = null; }
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this._vis);
    this.shadow.innerHTML = '';
    this.ready = false;
    this.L = null;
  }

  loadFonts() {
    if (document.getElementById('scrub-squad-fonts')) return;
    const f = (file) => new URL(`fonts/${file}`, this.base).href;
    const st = document.createElement('style');
    st.id = 'scrub-squad-fonts';
    st.textContent = `@font-face{font-family:"Lilita One";font-weight:400;font-display:swap;src:url(${f('lilita-one.woff2')}) format("woff2")}
@font-face{font-family:"Lato";font-weight:900;font-display:swap;src:url(${f('lato-900.woff2')}) format("woff2")}
@font-face{font-family:"Lato";font-weight:700;font-display:swap;src:url(${f('lato-700.woff2')}) format("woff2")}`;
    document.head.appendChild(st);
    document.fonts?.load?.('400 40px "Lilita One"').catch(() => {});
    document.fonts?.load?.('900 16px "Lato"').catch(() => {});
  }

  async load() {
    let rec = null;
    if (this.getAttribute('song-src')) {
      rec = { audio: this.getAttribute('song-src'), title: this.getAttribute('song-title'), duration: Number(this.getAttribute('song-duration')) || null };
    }
    let file = null;
    try { file = await fetch(new URL('song.json', this.base)).then((r) => r.json()); } catch { file = null; }
    rec = { ...(file || {}), ...(rec || {}) };
    const end = Number(rec.end) || Number(rec.duration) || 147;
    let sections = Array.isArray(rec.sections) && rec.sections.length ? rec.sections.map((s) => ({ ...s }))
      : DEFAULT_SECTIONS.map(([name, kind, f]) => ({ name, kind, start: f * end }));
    const choruses = sections.filter((s) => s.kind === 'chorus');
    let loopFrom = Number(rec.loopFrom) || (choruses[1] || choruses[0] || sections[0]).start;
    let loopAt = Number(rec.loopAt) || (sections.find((s) => s.kind === 'outro') || { start: end }).start;
    let bpm = Number(rec.bpm) || 100;
    let firstBeat = Number(rec.firstBeat) || 0;
    let songEnd = end;
    const test = Number(this.getAttribute('song-seconds'));
    this.testMode = test > 0;
    this.noMusic = !(test > 0) && !rec.audio;
    if (test > 0) {
      const k = test / end;
      sections = sections.map((s) => ({ ...s, start: s.start * k }));
      loopFrom *= k; loopAt *= k; firstBeat *= k; songEnd = test;
      this.noMusic = true;
    }
    sections.forEach((s, i) => { s.end = i + 1 < sections.length ? sections[i + 1].start : songEnd; });
    this.song = { title: rec.title || 'No Germs', audio: test > 0 ? null : (rec.audioLight || rec.audio), end: songEnd, sections, loopFrom, loopAt, bpm, firstBeat };
    this.renderTitleText();
    if (this.song.audio) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = this.song.audio;
      a.addEventListener('ended', () => this.onSongEnded());
      a.addEventListener('play', () => this.emitAudio(true));
      a.addEventListener('pause', () => { if (!this.S || this.S.phase === 'title' || this.S.paused || this.songDone) this.emitAudio(false); });
      a.addEventListener('loadedmetadata', () => {
        // the file may be a little longer than the record: the real length is the song's end (the loop point is unchanged)
        if (a.duration && isFinite(a.duration) && Math.abs(a.duration - this.song.end) < 8) {
          this.song.end = a.duration;
          this.song.sections[this.song.sections.length - 1].end = a.duration;
        }
      });
      this.audio = a;
    }
    this.ready = true;
    this.el.play.disabled = false;
    this.el.play.textContent = "Let's scrub!";
  }

  renderTitleText() {
    const n = this.shadow.querySelector('.songname');
    if (n) n.textContent = this.song?.title || '';
  }

  freshState() {
    return { phase: 'title', t: 0, clock: 0, paused: false, groups: [], subToG: null, germs: [], foam: [[], []], parts: [], sec: -1, loops: 0,
      rinseT: 0, lastSquish: 0, everScrubbed: false, lastScrubT: 0, hintT: -99, taps: 0, tapToastT: -99, startT: 0, doneT: 0,
      ptr: { id: null, down: false, x: 0, y: 0, e: 0, h: -1, z: -1, g: -1, dist: 0, downAt: 0 }, kz: 0, kbd: false };
  }

  // ---------- layout ----------
  fit() {
    const r = this.getBoundingClientRect();
    const W = Math.max(280, Math.round(r.width));
    const H = Math.max(280, Math.round(r.height));
    const dprRaw = Math.min(2, window.devicePixelRatio || 1);
    // keep the pixel count modest so school Chromebooks and older phones stay smooth
    const DPR = Math.min(dprRaw, Math.sqrt(3200000 / (W * H)));
    if (this.L && this.L.W === W && this.L.H === H && this.L.DPR === DPR) return;
    this.cv.width = Math.round(W * DPR);
    this.cv.height = Math.round(H * DPR);
    const land = W >= H * 1.05;
    this.el.stage.classList.toggle('narrow', !land || W < 620);
    this.el.stage.classList.toggle('short', H < 520 && land);
    const top = clamp(H * 0.12, 64, 96);
    const bot = clamp(H * 0.13, 70, 104);
    this.el.stage.style.setProperty('--top', `${top}px`);
    this.el.stage.style.setProperty('--bot', `${bot}px`);
    const areaH = H - top - bot;
    const hands = [];
    for (let i = 0; i < 2; i++) {
      let sx; let sy; let sw; let sh;
      if (land) { sw = W / 2; sh = areaH; sx = i * sw; sy = top; } else { sw = W; sh = areaH / 2; sx = 0; sy = top + i * sh; }
      const rot = !land;
      const lab = 26;
      const bw = rot ? HH : HW;
      const bh = rot ? HW : HH;
      const s = Math.min((sw * (rot ? 0.94 : 0.86)) / bw, ((sh - lab) * 0.95) / bh);
      hands.push({ s, rot, ox: sx + (sw - bw * s) / 2, oy: sy + lab + (sh - lab - bh * s) / 2, mirror: i === 1, lx: sx + sw / 2, ly: sy + 2, bw, bh });
    }
    this.L = { W, H, DPR, top, bot, land, hands };
    this.bg = this.renderBg();
    this.handArt = [this.renderHand(0), this.renderHand(1)];
  }
  toScreen(h, x, y) {
    const t = this.L.hands[h];
    const m = t.mirror ? HW - x : x;
    return t.rot ? [t.ox + (HH - y) * t.s, t.oy + m * t.s] : [t.ox + m * t.s, t.oy + y * t.s];
  }
  toLocal(h, x, y) {
    const t = this.L.hands[h];
    let m; let ly;
    if (t.rot) { m = (y - t.oy) / t.s; ly = HH - (x - t.ox) / t.s; } else { m = (x - t.ox) / t.s; ly = (y - t.oy) / t.s; }
    return [t.mirror ? HW - m : m, ly];
  }
  handXf(c, h) {
    const t = this.L.hands[h];
    c.translate(t.ox, t.oy);
    c.scale(t.s, t.s);
    if (t.rot) { c.translate(HH, 0); c.rotate(Math.PI / 2); }
    if (t.mirror) { c.translate(HW, 0); c.scale(-1, 1); }
  }

  // ---------- pre-rendered art (redrawn only on resize or a new skin) ----------
  renderBg() {
    const { W, H, DPR } = this.L;
    const c = document.createElement('canvas');
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    const x = c.getContext('2d');
    x.scale(DPR, DPR);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0B2F55'); g.addColorStop(0.6, '#06193F'); g.addColorStop(1, '#030C26');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // night bathroom tiles: grout, a soft sheen on each tile, a few darker tiles
    const ts = Math.max(48, Math.min(W, H) / 8.5);
    const ox = ((W % ts) / 2) - ts;
    let k = 0;
    for (let ty = -ts * 0.3; ty < H; ty += ts) {
      for (let tx = ox; tx < W; tx += ts) {
        k++;
        const v = (k * 7919) % 13;
        if (v === 3) { x.fillStyle = '#00C7DF0c'; x.fillRect(tx + 2, ty + 2, ts - 4, ts - 4); }
        if (v === 8) { x.fillStyle = '#0000001a'; x.fillRect(tx + 2, ty + 2, ts - 4, ts - 4); }
        const sh = x.createLinearGradient(tx, ty, tx + ts, ty + ts);
        sh.addColorStop(0, '#ffffff10'); sh.addColorStop(0.45, '#ffffff00');
        x.fillStyle = sh; x.fillRect(tx + 2, ty + 2, ts - 4, ts - 4);
      }
    }
    x.strokeStyle = '#00C7DF1c'; x.lineWidth = 2.5;
    x.beginPath();
    for (let tx = ox; tx < W; tx += ts) { x.moveTo(tx, 0); x.lineTo(tx, H); }
    for (let ty = -ts * 0.3; ty < H; ty += ts) { x.moveTo(0, ty); x.lineTo(W, ty); }
    x.stroke();
    // light from the sink
    const r = x.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.62);
    r.addColorStop(0, '#1d6f9a55'); r.addColorStop(1, '#0000');
    x.fillStyle = r; x.fillRect(0, 0, W, H);
    // graffiti: paint splats and a crown, like the No Germs artwork
    const m = Math.min(W, H);
    this.splat(x, W * 0.05, H * 0.93, m * 0.1, '#E5322B38');
    this.splat(x, W * 0.96, H * 0.1, m * 0.09, '#00C7DF38');
    this.splat(x, W * 0.9, H * 0.88, m * 0.05, '#E4025C2a');
    x.save(); x.translate(W * 0.08, H * 0.2); x.rotate(-0.15); x.strokeStyle = '#ffffff1c'; x.lineWidth = 4; x.lineJoin = 'round';
    const cw = m * 0.12;
    x.beginPath(); x.moveTo(0, cw * 0.6); x.lineTo(cw, cw * 0.6); x.lineTo(cw * 0.94, 0); x.lineTo(cw * 0.72, cw * 0.28); x.lineTo(cw * 0.5, -cw * 0.08);
    x.lineTo(cw * 0.28, cw * 0.28); x.lineTo(cw * 0.06, 0); x.closePath(); x.stroke(); x.restore();
    // vignette
    const vg = x.createRadialGradient(W / 2, H / 2, m * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#0009');
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
    return c;
  }
  splat(x, cx, cy, r, col) {
    x.fillStyle = col;
    x.beginPath();
    for (let i = 0; i <= 22; i++) { const a = (i / 22) * TAU; const rr = r * (i % 2 ? 0.62 : 1) * (1 + 0.25 * Math.sin(i * 3.7)); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.fill();
    for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.3; x.beginPath(); x.arc(cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45, r * 0.09 * (1 + (i % 3)), 0, TAU); x.fill(); }
  }

  // One hand, drawn once into its own canvas. The skin is the same before, during and after scrubbing.
  renderHand(h) {
    const t = this.L.hands[h];
    const { DPR } = this.L;
    const pad = 10 * t.s;
    const c = document.createElement('canvas');
    c.width = Math.ceil((t.bw * t.s + pad * 2) * DPR);
    c.height = Math.ceil((t.bh * t.s + pad * 2) * DPR);
    const x = c.getContext('2d');
    x.scale(DPR, DPR);
    x.translate(pad, pad);
    x.scale(t.s, t.s);
    if (t.rot) { x.translate(HH, 0); x.rotate(Math.PI / 2); }
    if (t.mirror) { x.translate(HW, 0); x.scale(-1, 1); }
    this.drawHandArt(x, h, SKINS[this.prefs.skin].c);
    return { c, x: t.ox - pad, y: t.oy - pad, w: c.width / DPR, h: c.height / DPR };
  }
  // paint the hand's edge band offset by (dx, dy): the hand minus a shifted copy of itself, clipped to the hand
  rim(x, col, dx, dy, alpha) {
    const m = x.getTransform();
    const t = document.createElement('canvas');
    t.width = x.canvas.width; t.height = x.canvas.height;
    const y = t.getContext('2d');
    y.setTransform(m);
    y.fillStyle = col; ALL_SH.forEach((p) => y.fill(p));
    y.globalCompositeOperation = 'destination-out';
    // shift on the screen (not in hand space) so the light comes from the same side on both hands, in any orientation
    const k = Math.hypot(m.a, m.b);
    y.setTransform(new DOMMatrix([1, 0, 0, 1, -dx * k, -dy * k]).multiply(m));
    ALL_SH.forEach((p) => y.fill(p));
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = alpha; x.drawImage(t, 0, 0); x.restore();
  }
  drawHandArt(x, h, sk) {
    x.lineJoin = 'round'; x.lineCap = 'round';
    // drop shadow
    { // drop shadow, offset on the screen so both hands cast it the same way
      const m = x.getTransform(); const k = Math.hypot(m.a, m.b);
      x.save(); x.setTransform(new DOMMatrix([1, 0, 0, 1, 6 * k, 10 * k]).multiply(m)); x.fillStyle = '#00000055'; ALL_SH.forEach((p) => x.fill(p)); x.restore();
    }
    // outline, then the skin over it (so fingers and palm merge into one shape)
    x.strokeStyle = NAVY; x.lineWidth = 9;
    ALL_SH.forEach((p) => x.stroke(p));
    const gr = x.createRadialGradient(84, 128, 8, 110, 180, 240);
    gr.addColorStop(0, sk[0]); gr.addColorStop(0.55, sk[1]); gr.addColorStop(1, sk[2]);
    x.fillStyle = gr;
    ALL_SH.forEach((p) => x.fill(p));
    // rounded 3D: a shadow along the lower-right edge and a light rim along the upper-left (the outline only, no inner lines)
    this.rim(x, sk[2], 7, 9, 0.55);
    this.rim(x, '#ffffff', -4, -5, 0.22);
    x.save();
    x.clip(UNION);
    x.strokeStyle = `${sk[2]}bb`; x.lineWidth = 2.4;
    if (h === 0) {
      // palm side: palm lines and finger creases
      x.beginPath();
      x.moveTo(40, 188); x.quadraticCurveTo(96, 172, 152, 196);
      x.moveTo(46, 212); x.quadraticCurveTo(100, 198, 136, 238);
      x.moveTo(124, 152); x.quadraticCurveTo(112, 204, 88, 252);
      x.stroke();
      FING.forEach((f) => {
        [TIP_LEN + 4, TIP_LEN + 36].forEach((d) => {
          if (f.t + d > 150) return;
          x.beginPath(); x.moveTo(f.x + 7, f.t + d); x.quadraticCurveTo(f.x + f.w / 2, f.t + d + 4, f.x + f.w - 7, f.t + d); x.stroke();
        });
      });
      // thumb crease
      x.save(); x.translate(THUMB.bx, THUMB.by); x.rotate(THUMB.ang + Math.PI / 2);
      x.beginPath(); x.moveTo(-11, -54); x.quadraticCurveTo(0, -50, 11, -54); x.stroke(); x.restore();
    } else {
      // back of hand: nails, knuckle wrinkles
      FING.forEach((f) => {
        const nw = f.w - 12;
        const p = new Path2D(); rrect(p, f.x + 6, f.t + 5, nw, 26, [nw / 2, nw / 2, 7, 7]);
        x.fillStyle = '#F4D0C8e0'; x.fill(p);
        x.strokeStyle = `${sk[2]}cc`; x.lineWidth = 2; x.stroke(p);
        x.fillStyle = '#ffffffb0'; x.beginPath(); x.ellipse(f.x + 11, f.t + 13, 2.4, 5.5, 0, 0, TAU); x.fill();
        x.strokeStyle = `${sk[2]}bb`; x.lineWidth = 2.2;
        for (let k = 0; k < 2; k++) { const y = f.t + 66 + k * 5; if (y < 150) { x.beginPath(); x.moveTo(f.x + 9, y); x.quadraticCurveTo(f.x + f.w / 2, y - 4, f.x + f.w - 9, y); x.stroke(); } }
      });
      x.beginPath();
      FING.forEach((f) => { x.moveTo(f.x + 9, 158); x.quadraticCurveTo(f.x + f.w / 2, 151, f.x + f.w - 9, 158); });
      x.stroke();
      const [tx, ty] = thumbTip();
      x.save(); x.translate(tx, ty); x.rotate(THUMB.ang + Math.PI / 2);
      const p = new Path2D(); rrect(p, -12, -12, 24, 26, [12, 12, 7, 7]);
      x.fillStyle = '#F4D0C8e0'; x.fill(p); x.strokeStyle = `${sk[2]}cc`; x.lineWidth = 2; x.stroke(p);
      x.fillStyle = '#ffffffb0'; x.beginPath(); x.ellipse(-6, -4, 2.4, 5, 0, 0, TAU); x.fill();
      x.restore();
    }
    // gloss: soft highlights plus a sharp specular glint on each part
    x.fillStyle = '#ffffff1c';
    x.beginPath(); x.ellipse(66, 182, 20, 32, -0.4, 0, TAU); x.fill();
    FING.forEach((f) => { x.beginPath(); x.ellipse(f.x + 8.5, f.t + (FBASE - f.t) * 0.4, 3.2, (FBASE - f.t) * 0.26, 0, 0, TAU); x.fill(); });
    x.fillStyle = '#ffffff70';
    x.beginPath(); x.ellipse(56, 164, 5, 9, -0.5, 0, TAU); x.fill();
    FING.forEach((f) => { x.beginPath(); x.ellipse(f.x + 9, f.t + 18, 2.6, 6, 0, 0, TAU); x.fill(); });
    x.save(); x.translate(THUMB.bx, THUMB.by); x.rotate(THUMB.ang + Math.PI / 2);
    x.fillStyle = '#ffffff1c'; x.beginPath(); x.ellipse(-9, -48, 4, 26, 0, 0, TAU); x.fill();
    x.restore();
    x.restore();
    // hoodie cuff, like the kid in the artwork
    const cg = x.createLinearGradient(0, 292, 0, 330);
    cg.addColorStop(0, '#3ADCF0'); cg.addColorStop(1, '#0090A8');
    const cuff = new Path2D(); rrect(cuff, 44, 292, 116, 38, 13);
    x.fillStyle = cg; x.strokeStyle = NAVY; x.lineWidth = 5; x.fill(cuff); x.stroke(cuff);
    x.strokeStyle = '#ffffff55'; x.lineWidth = 2;
    for (let cx = 57; cx < 152; cx += 10) { x.beginPath(); x.moveTo(cx, 298); x.lineTo(cx, 324); x.stroke(); }
    x.fillStyle = '#ffffff40'; x.beginPath(); x.ellipse(70, 300, 14, 4, 0, 0, TAU); x.fill();
  }

  // ---------- round ----------
  newRound() {
    const M = MODES[this.prefs.mode];
    const S = this.freshState();
    S.phase = 'play';
    for (let h = 0; h < 2; h++) {
      M.groups.forEach((subs, i) => S.groups.push({ h, subs, prog: 0, clean: false, last: -9, lastSpawn: -9, decayed: false, warnT: -9,
        name: this.prefs.mode === 'lit' ? LIT_NAMES[h][i] : ZONE_NAMES[h][subs[0]] }));
    }
    // germs creep on one zone at a time during the intro
    S.groups.forEach((g, i) => { g.delay = 0.4 + i * (this.prefs.mode === 'lit' ? 0.55 : 0.38); });
    S.subToG = [[], []];
    S.groups.forEach((g, i) => g.subs.forEach((z) => { S.subToG[g.h][z] = i; }));
    S.groups.forEach((g) => { g.lc = this.localCenter(g.subs); });
    S.kz = 0;
    this.S = S;
    this.songDone = false;
    this.fadeAt = null;
  }
  startRound() {
    if (!this.ready) return;
    // iOS: sound has to start inside this tap
    this.audioOn();
    if (!this.testMode) this.noMusic = !this.audio;
    this.newRound();
    this.el.title.classList.add('hide');
    this.el.celebrate.classList.add('hide');
    this.el.pause.classList.add('hide');
    this.el.pauseBtn.classList.remove('hide');
    this.songPlay(0);
    this.cv.focus({ preventScroll: true });
    this.say('Germs are coming. Rub them off!');
  }
  toTitle() {
    this.songStop(true);
    this.S = this.freshState();
    this.el.title.classList.remove('hide');
    this.el.celebrate.classList.add('hide');
    this.el.pause.classList.add('hide');
    this.el.pauseBtn.classList.add('hide');
    this.setRub(0);
    this.el.play.focus({ preventScroll: true });
  }
  pause() {
    const S = this.S;
    if (!S || S.paused || !(S.phase === 'play' || S.phase === 'rinse')) return;
    S.paused = true;
    S.ptr.down = false;
    this.keyScrub = false;
    this.setRub(0);
    if (this.audio) this.audio.pause();
    this.el.pause.classList.remove('hide');
    this.el.pauseBtn.classList.add('hide');
    this.shadow.querySelector('[data-act="resume"]').focus({ preventScroll: true });
  }
  resume() {
    const S = this.S;
    if (!S?.paused) return;
    this.audioOn();
    S.paused = false;
    this.el.pause.classList.add('hide');
    this.el.pauseBtn.classList.remove('hide');
    if (this.audio && !this.noMusic) this.audio.play().catch(() => {});
    this.last = performance.now();
    this.cv.focus({ preventScroll: true });
  }
  leave() {
    this.songStop(false);
    this.dispatchEvent(new CustomEvent('game-exit', { bubbles: true, composed: true }));
  }

  // ---------- song (the clock) ----------
  songTime() {
    if (this.audio && !this.noMusic) return this.audio.currentTime;
    return this.S.clock;
  }
  songPlay(from) {
    this.S.clock = from;
    if (!this.audio || this.noMusic) return;
    clearInterval(this.fadeT);
    this.audio.volume = 1;
    try { this.audio.currentTime = from; } catch { /* not seekable yet */ }
    const p = this.audio.play();
    if (p?.catch) {
      p.catch(() => {
        // the song could not start (blocked or offline): the round still runs, on a silent clock
        if (this.audio.paused) { this.noMusic = true; this.S.clock = from; }
      });
    }
  }
  songSeek(to) {
    this.S.clock = to;
    if (this.audio && !this.noMusic) {
      try { this.audio.currentTime = to; } catch { /* ignore */ }
      if (this.audio.paused && !this.S.paused) this.audio.play().catch(() => {});
    }
  }
  songStop(fade) {
    clearInterval(this.fadeT);
    this.songDone = true;
    const a = this.audio;
    if (!a || a.paused) { this.emitAudio(false); return; }
    if (!fade) { a.pause(); return; }
    this.fadeT = setInterval(() => {
      a.volume = Math.max(0, a.volume - 0.07);
      // iOS ignores volume: stop when the fade would be done
      if (a.volume <= 0.01 || (this.fadeStart && performance.now() - this.fadeStart > 1600)) { clearInterval(this.fadeT); a.pause(); a.volume = 1; this.fadeStart = 0; }
    }, 90);
    this.fadeStart = performance.now();
  }
  onSongEnded() {
    const S = this.S;
    if (!S) return;
    if (S.phase === 'play') { this.loopSong(); return; }
    this.songDone = true;
    this.emitAudio(false);
  }
  loopSong() {
    this.S.loops++;
    this.songSeek(this.song.loopFrom);
    this.toast('One more chorus! Keep scrubbing!');
  }
  secAt(t) {
    const ss = this.song.sections;
    for (let i = ss.length - 1; i >= 0; i--) if (t >= ss[i].start) return i;
    return 0;
  }
  emitAudio(playing) {
    if (this._playing === playing) return;
    this._playing = playing;
    this.dispatchEvent(new CustomEvent('game-audio', { detail: { playing }, bubbles: true, composed: true }));
    if (playing) { window.dispatchEvent(new CustomEvent('tm-media-play', { detail: { el: this.audio } })); this.hushPage(); }
  }
  hushPage() {
    const media = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el instanceof HTMLMediaElement) media.push(el);
        if (el.shadowRoot && el !== this) walk(el.shadowRoot);
      }
    };
    try { walk(document); } catch { /* ignore */ }
    for (const m of media) if (m !== this.audio && !m.paused) m.pause();
  }

  // ---------- sound effects (made on the fly: no files to download) ----------
  audioOn() {
    if (!this.ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ac = new AC();
        this.sfx = this.ac.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.ac.destination);
        const len = this.ac.sampleRate * 2;
        this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = this.noise.getChannelData(0);
        // soft (pinkish) noise for foam and water
        let b0 = 0; let b1 = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + w * 0.3; b1 = 0.6 * b1 + w * 0.4; d[i] = (b0 + b1) * 0.5; }
        // the rubbing sound: a looping soapy swish whose loudness follows the rubbing
        const src = this.ac.createBufferSource(); src.buffer = this.noise; src.loop = true;
        const bp = this.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.9;
        const lfo = this.ac.createOscillator(); lfo.frequency.value = 7; const lg = this.ac.createGain(); lg.gain.value = 500;
        lfo.connect(lg).connect(bp.frequency);
        this.rubGain = this.ac.createGain(); this.rubGain.gain.value = 0;
        src.connect(bp).connect(this.rubGain).connect(this.sfx);
        src.start(); lfo.start();
        this.rubBp = bp;
      } catch { this.ac = null; }
    }
    if (this.ac?.state === 'suspended') this.ac.resume().catch(() => {});
  }
  setRub(v) {
    if (!this.rubGain) return;
    this.rubGain.gain.setTargetAtTime(v, this.ac.currentTime, v ? 0.04 : 0.08);
  }
  tone(f, at, dur, type, vol, f2) {
    const c = this.ac; const t = c.currentTime + at;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  noiseHit(at, dur, freq, q, vol, type = 'bandpass') {
    const c = this.ac; const t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name, arg) {
    if (!this.ac || this.ac.state !== 'running') return;
    switch (name) {
      case 'pop': // a bubbly "blip" plus a tiny click
        this.tone(rnd(420, 520), 0, 0.11, 'sine', 0.28, rnd(1300, 1600));
        this.noiseHit(0, 0.03, 4000, 1.5, 0.12, 'highpass');
        break;
      case 'fizz': this.tone(rnd(1800, 2600), 0, 0.05, 'sine', 0.035, rnd(2800, 3600)); break;
      case 'chime': { // a bell that climbs the scale as the zones get clean
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
        const f = 659.25 * 2 ** (scale[Math.min(arg || 0, scale.length - 1)] / 12);
        [[1, 0.16, 0.9], [2.76, 0.05, 0.5], [5.4, 0.025, 0.3]].forEach(([m, v, d]) => this.tone(f * m, 0, d, 'sine', v));
        this.tone(f * 1.5, 0.08, 0.7, 'triangle', 0.06);
        break;
      }
      case 'sneak': // tiptoe plucks: friendly, not scary
        this.tone(392, 0, 0.12, 'triangle', 0.08); this.tone(330, 0.17, 0.12, 'triangle', 0.08);
        break;
      case 'rinse': { // a rush of water with droplets
        const c = this.ac; const t = c.currentTime;
        const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
        f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(3200, t + 0.7); f.frequency.linearRampToValueAtTime(900, t + 2.2);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        s.connect(f).connect(g).connect(this.sfx); s.start(t); s.stop(t + 2.5);
        for (let i = 0; i < 9; i++) this.tone(rnd(700, 1400), 0.2 + i * 0.2 + rnd(0, 0.1), 0.08, 'sine', 0.05, rnd(1600, 2400));
        break;
      }
      case 'fanfare': [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => { this.tone(f, i * 0.1, 0.5, 'triangle', 0.09); this.tone(f * 2, i * 0.1, 0.3, 'sine', 0.03); }); break;
      default: break;
    }
  }

  // ---------- germs, foam, particles ----------
  spot(g) {
    const S = this.S;
    for (let n = 0; n < 500; n++) {
      const z = pick(g.subs);
      const x = rnd(0, HW); const y = rnd(0, HH);
      if (y > 280) continue; // not under the cuff
      if (hitZone(x, y) !== z || !inHand(x + 8, y) || !inHand(x - 8, y) || !inHand(x, y + 8) || !inHand(x, y - 8)) continue;
      let ok = true;
      for (const o of S.germs) if (o.h === g.h && o.st !== 'pop' && Math.hypot(o.x - x, o.y - y) < 30) ok = false;
      if (ok || n > 380) return [x, y];
    }
    return this.localCenter(g.subs);
  }
  spawn(gi, sneaky) {
    const S = this.S; const g = S.groups[gi];
    const [x, y] = this.spot(g);
    const a = Math.random() * TAU;
    S.germs.push({ g: gi, h: g.h, x, y, fx: x + Math.cos(a) * 46, fy: y + Math.sin(a) * 46, born: S.t, st: 'in', type: Math.floor(Math.random() * 3),
      ph: Math.random() * TAU, sneaky });
    g.lastSpawn = S.t;
  }
  popGerm(o, quiet) {
    const S = this.S;
    o.st = 'pop'; o.popT = S.t;
    if (quiet) return;
    const [sx, sy] = this.toScreen(o.h, o.x, o.y);
    this.burst(sx, sy, 10, GERMS[o.type].tip);
    for (let i = 0; i < 3; i++) this.bubble(sx, sy, false);
    this.play('pop');
  }
  burst(x, y, n, c) {
    const P = this.S.parts;
    for (let i = 0; i < n && P.length < 220; i++) { const a = Math.random() * TAU; const v = rnd(60, 240); P.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.6, age: 0, c }); }
  }
  bubble(x, y, big) {
    const P = this.S.parts;
    if (P.length >= 220) return;
    P.push({ k: 'bub', x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: rnd(-20, 20), vy: rnd(-80, -30), r: rnd(5, big ? 24 : 12), life: rnd(1.2, 2.4), age: 0 });
  }
  twinkle(x, y) {
    const P = this.S.parts;
    if (P.length >= 220) return;
    P.push({ k: 'tw', x, y, vx: 0, vy: -6, r: rnd(5, 10), life: 0.9, age: 0 });
  }

  toast(msg) {
    const el = this.el.toast;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => el.classList.remove('on'), 1600);
  }
  say(text) { this.el.live.textContent = ''; setTimeout(() => { this.el.live.textContent = text; }, 30); }

  // ---------- update ----------
  update(dt) {
    const S = this.S;
    if (!S || S.paused) return;
    S.t += dt;
    if (this.noMusic && S.phase !== 'title' && !this.songDone) S.clock += dt;
    const M = MODES[this.prefs.mode];
    const p = S.ptr;
    p.e *= Math.exp(-dt * 10);
    for (const q of S.parts) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 'spark') q.vy += 420 * dt; else if (q.k === 'bub') q.vx += Math.sin(q.age * 6) * 8 * dt; }
    S.parts = S.parts.filter((q) => q.age < q.life);
    S.germs = S.germs.filter((o) => o.st !== 'pop' || S.t - o.popT < 0.35);
    if (S.phase === 'title') { this.idle(); return; }
    const st = this.songTime();
    const si = this.secAt(st);
    const kind = this.song.sections[si].kind;
    this.chorus = kind === 'chorus';
    this.beat = (st - this.song.firstBeat) * (this.song.bpm / 60);
    if (S.phase === 'play') {
      if (si !== S.sec) {
        if (S.sec >= 0 || si === 0) {
          if (kind === 'intro') this.toast('Here come the germs!');
          else if (kind === 'chorus') this.toast('Chorus! Scrub-a-dub!');
          else if (kind === 'verse') this.toast('Keep scrubbing!');
        }
        S.sec = si;
      }
      // the song never cuts out: if time runs out, it goes back to chorus 2
      if (st >= this.song.loopAt || (this.noMusic && st >= this.song.end)) this.loopSong();
      // scrubbing: only while the finger is really moving, and only at the zone's own pace
      const kb = this.keyScrub && S.kz >= 0;
      if (kb) { p.g = S.kz; p.h = S.groups[S.kz].h; }
      const scrub = (kb || (p.down && p.e > 4)) && p.g >= 0;
      if (scrub) {
        const g = S.groups[p.g];
        S.everScrubbed = true;
        S.lastScrubT = S.t;
        if (!g.clean) {
          g.prog = Math.min(1, g.prog + dt / M.need);
          g.last = S.t;
          if (g.prog >= 1) this.zoneClean(p.g);
        }
        this.setRub(clamp(0.05 + p.e * 0.004, 0.05, 0.16));
        if (this.rubBp) this.rubBp.frequency.setTargetAtTime(this.chorus ? 1700 : 1300, this.ac.currentTime, 0.1);
        if (Math.random() < dt * 5) this.play('fizz');
        const [sx, sy] = kb ? this.zoneCenter(S.kz) : [p.x, p.y];
        const [lx, ly] = this.toLocal(g.h, sx + (kb ? rnd(-30, 30) : 0), sy + (kb ? rnd(-30, 30) : 0));
        const fo = S.foam[g.h];
        if (Math.random() < 0.6) {
          fo.push({ x: lx + rnd(-8, 8), y: ly + rnd(-8, 8), r: rnd(4, 10) * (this.prefs.mode === 'lit' ? 1.2 : 1), b: S.t });
          while (fo.length > 140 || (fo.length && S.t - fo[0].b > FOAM_LIFE)) fo.shift();
        }
        if (Math.random() < (this.chorus ? 0.5 : 0.22)) this.bubble(sx, sy, this.chorus);
      } else {
        this.setRub(0);
      }
      // half-done zones slowly un-clean after a grace period; clean zones stay clean
      S.groups.forEach((g, gi) => {
        if (!g.clean && g.prog > 0 && S.t - g.last > M.grace) { g.prog = Math.max(0, g.prog - dt * M.decay); g.decayed = true; }
        if (S.t < g.delay) return;
        const live = S.germs.filter((o) => o.g === gi && o.st !== 'pop');
        const target = g.clean ? 0 : Math.ceil((1 - g.prog) * M.maxG - 1e-6);
        if (live.length > target) {
          let best = live[0]; let bd = 1e9;
          for (const o of live) { const [sx, sy] = this.toScreen(o.h, o.x, o.y); const d = Math.hypot(sx - p.x, sy - p.y); if (d < bd) { bd = d; best = o; } }
          this.popGerm(best);
        } else if (live.length < target && S.t - g.lastSpawn > 0.9) {
          const sneaky = g.decayed;
          this.spawn(gi, sneaky);
          if (sneaky && S.t - g.warnT > 5) { g.warnT = S.t; this.toast('Sneaky germs snuck back!'); this.play('sneak'); }
        }
        if (g.clean && Math.random() < dt * 1.2) { const [x, y] = this.spot(g); const [sx, sy] = this.toScreen(g.h, x, y); this.twinkle(sx, sy); }
      });
      // a little help for new scrubbers
      const idleFor = S.t - Math.max(S.lastScrubT, 2.5);
      if ((!S.everScrubbed && S.t > 3.5 && S.t - S.hintT > 7) || (S.everScrubbed && idleFor > 7 && S.t - S.hintT > 9)) {
        S.hintT = S.t; this.toast('Rub to scrub!');
      }
      if (S.groups.every((g) => g.clean)) this.allClean();
    } else if (S.phase === 'rinse') {
      const k = (S.t - S.rinseT) / 2.2;
      const wy = this.L.top + (this.L.H - this.L.top) * k;
      for (let h = 0; h < 2; h++) S.foam[h] = S.foam[h].filter((f) => this.toScreen(h, f.x, f.y)[1] > wy);
      if (Math.random() < 0.6) this.bubble(rnd(this.L.W * 0.2, this.L.W * 0.8), wy, true);
      if (k >= 1) {
        S.phase = 'celebrate';
        S.foam = [[], []];
        this.el.celebrate.classList.remove('hide');
        this.el.pauseBtn.classList.add('hide');
        this.play('fanfare');
        for (let i = 0; i < 40; i++) this.bubble(rnd(0, this.L.W), this.L.H * 0.9, true);
        this.shadow.querySelector('[data-act="again"]').focus({ preventScroll: true });
        this.say('Every zone, every time! Squeaky clean!');
      }
    } else if (S.phase === 'celebrate') {
      if (Math.random() < 0.15) this.bubble(rnd(0, this.L.W), this.L.H, true);
      if (Math.random() < 0.05) this.twinkle(rnd(0, this.L.W), rnd(this.L.top, this.L.H - this.L.bot));
    }
    // Littles "fade at the end of a chorus" option (open item 1)
    if (this.fadeAt != null && !this.songDone && st >= this.fadeAt) { this.fadeAt = null; this.songStop(true); }
    if (this.noMusic && !this.songDone && S.phase !== 'play' && st >= this.song.end) this.songDone = true;
  }
  zoneClean(gi) {
    const S = this.S; const g = S.groups[gi];
    g.clean = true;
    S.germs.filter((o) => o.g === gi && o.st !== 'pop').forEach((o) => this.popGerm(o));
    const n = S.groups.filter((x) => x.clean).length;
    this.play('chime', n - 1);
    if (n < S.groups.length) this.toast(pick(PRAISE));
    const [cx, cy] = this.zoneCenter(gi);
    for (let i = 0; i < 14; i++) this.bubble(cx, cy, true);
    this.burst(cx, cy, 18, '#ffffff');
    this.say(`${g.name} clean!`);
  }
  localCenter(subs) {
    let sx = 0; let sy = 0; let n = 0;
    for (let y = 4; y < HH; y += 10) for (let x = 4; x < HW; x += 10) { if (subs.includes(hitZone(x, y))) { sx += x; sy += y; n++; } }
    if (!n) return [120, 200];
    // the point of the zone nearest its middle (the middle of the fingers zone is a gap between two fingers)
    const cx = sx / n; const cy = sy / n; let best = [cx, cy]; let bd = 1e9;
    for (let y = 2; y < HH; y += 4) for (let x = 2; x < HW; x += 4) {
      if (!subs.includes(hitZone(x, y)) || !inHand(x + 6, y) || !inHand(x - 6, y)) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  zoneCenter(gi) {
    const g = this.S.groups[gi];
    return this.toScreen(g.h, g.lc[0], g.lc[1]);
  }
  allClean() {
    const S = this.S;
    S.phase = 'rinse'; S.rinseT = S.t; S.doneT = S.t;
    this.setRub(0);
    S.ptr.down = false; this.keyScrub = false;
    this.play('rinse');
    this.toast('Rinse!');
    S.germs.filter((o) => o.st !== 'pop').forEach((o) => this.popGerm(o, true));
    // Littles: optionally fade out at the end of the chorus that is playing (or the next one)
    if (this.prefs.mode === 'lit' && this.getAttribute('littles-ending') === 'chorus') {
      const st = this.songTime();
      const ch = this.song.sections.find((s) => s.kind === 'chorus' && s.end > st + 2);
      this.fadeAt = ch ? ch.end - 1.5 : null;
    }
    this.dispatchEvent(new CustomEvent('game-finish', { bubbles: true, composed: true,
      detail: { mode: this.prefs.mode, loops: S.loops, seconds: Math.round(S.t) } }));
  }
  idle() {
    const S = this.S;
    if (S.germs.length < 6 && Math.random() < 0.03) {
      const h = Math.random() < 0.5 ? 0 : 1;
      const [x, y] = this.spot({ h, subs: [Math.floor(Math.random() * 5)] });
      S.germs.push({ g: -1, h, x, y, fx: x, fy: y - 34, born: S.t, st: 'in', type: Math.floor(Math.random() * 3), ph: Math.random() * TAU });
    }
    for (const o of S.germs) if (o.st !== 'pop' && S.t - o.born > 4 + o.ph) this.popGerm(o, true);
  }

  // ---------- drawing ----------
  startLoop() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  draw() {
    const c = this.ctx; const { DPR } = this.L;
    if (!this.S) return;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.drawImage(this.bg, 0, 0, this.L.W, this.L.H);
    for (let h = 0; h < 2; h++) {
      const a = this.handArt[h];
      c.drawImage(a.c, a.x, a.y, a.w, a.h);
      this.drawFoam(h);
      this.drawLabel(h);
    }
    this.drawFocus();
    this.drawGerms();
    this.drawHud();
    this.drawRinse();
    this.drawParts();
  }
  drawLabel(h) {
    const c = this.ctx; const t = this.L.hands[h];
    const txt = h ? 'BACK OF HAND' : 'PALM SIDE';
    c.font = `900 ${Math.round(clamp(t.s * 13, 11, 15))}px "Lato", sans-serif`;
    const tw = c.measureText(txt).width;
    c.fillStyle = '#04114699';
    c.beginPath(); const p = new Path2D(); rrect(p, t.lx - tw / 2 - 12, t.ly, tw + 24, 24, 12); c.fill(p);
    c.fillStyle = '#9fe8f5'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, t.lx, t.ly + 12.5);
  }
  drawFoam(h) {
    const fo = this.S.foam[h];
    if (!fo.length) return;
    const c = this.ctx; const now = this.S.t;
    c.save(); this.handXf(c, h); c.clip(UNION);
    // suds are see-through bubbles (a ring and a shine, barely any fill) that fade within a few seconds:
    // the skin under them always shows its own colour
    c.lineWidth = 1.6; c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff';
    for (const f of fo) {
      const age = now - f.b;
      const a = clamp(1 - age / FOAM_LIFE, 0, 1) * Math.min(1, age * 8 + 0.3);
      if (a <= 0) continue;
      const r = f.r * Math.min(1, 0.4 + age * 6);
      c.globalAlpha = a * 0.12; c.beginPath(); c.arc(f.x, f.y, r, 0, TAU); c.fill();
      c.globalAlpha = a * 0.75; c.stroke();
      c.globalAlpha = a * 0.9; c.beginPath(); c.arc(f.x - r * 0.35, f.y - r * 0.35, Math.max(0.8, r * 0.18), 0, TAU); c.fill();
    }
    c.restore();
  }
  drawFocus() {
    const S = this.S;
    if (!S.kbd || S.phase !== 'play' || !S.groups[S.kz]) return;
    const g = S.groups[S.kz]; const c = this.ctx;
    c.save(); this.handXf(c, g.h);
    c.setLineDash([8, 6]); c.lineDashOffset = -S.t * 30; c.strokeStyle = '#ffffff'; c.lineWidth = 4 / this.L.hands[g.h].s * 1.2;
    g.subs.forEach((z) => c.stroke(ZP[z]));
    c.restore();
  }
  drawGerms() {
    const S = this.S; const M = MODES[this.prefs.mode]; const p = S.ptr; const c = this.ctx;
    const bounce = S.phase === 'play' && this.chorus && !this.reduced;
    for (const o of S.germs) {
      const t = this.L.hands[o.h];
      let { x, y } = o;
      const k = clamp((S.t - o.born) / (o.sneaky ? 1.4 : 0.8), 0, 1);
      if (o.st === 'in') {
        x = o.fx + (o.x - o.fx) * k; y = o.fy + (o.y - o.fy) * k;
        y -= Math.abs(Math.sin(k * Math.PI * (o.sneaky ? 4 : 3))) * (o.sneaky ? 5 : 9); // tiptoe hops
        if (k >= 1) o.st = 'on';
      }
      const [sx, sy] = this.toScreen(o.h, x, y);
      const scared = (p.down && p.e > 4 && p.g === o.g) || (this.keyScrub && S.kz === o.g);
      let r = M.germR * t.s; let a = 1; let dy = 0;
      if (bounce && !scared) dy = -Math.abs(Math.sin(this.beat * Math.PI + o.ph * 0.2)) * r * 0.45;
      if (o.st === 'pop') { const q = (S.t - o.popT) / 0.35; r *= 1 + q * 0.6; a = 1 - q; } else r *= 0.4 + 0.6 * k;
      if (o.st !== 'pop') { c.fillStyle = '#00000040'; c.beginPath(); c.ellipse(sx + r * 0.15, sy + r * 0.95, r * 0.8, r * 0.25, 0, 0, TAU); c.fill(); }
      this.drawGerm(c, o.type, sx, sy + dy, r, S.t + o.ph, scared, a);
    }
  }
  drawGerm(c, type, x, y, r, t, scared, alpha = 1) {
    const G = GERMS[type];
    c.save(); c.globalAlpha = Math.max(0, alpha); c.translate(x, y);
    const wob = scared ? Math.sin(t * 40) * 0.08 : Math.sin(t * 3) * 0.05;
    c.rotate(wob); c.scale(1 + Math.sin(t * 5) * 0.03, 1 - Math.sin(t * 5) * 0.03);
    const n = G.spk === 'nub' ? 8 : 9;
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.3; const len = r * (G.spk === 'cone' ? 1.55 : 1.45);
      const ex = Math.cos(a) * len; const ey = Math.sin(a) * len;
      if (G.spk === 'cone') {
        c.fillStyle = G.dark;
        c.beginPath(); c.moveTo(Math.cos(a - 0.24) * r * 0.85, Math.sin(a - 0.24) * r * 0.85); c.lineTo(ex, ey); c.lineTo(Math.cos(a + 0.24) * r * 0.85, Math.sin(a + 0.24) * r * 0.85); c.fill();
        c.fillStyle = G.tip; c.beginPath(); c.arc(ex, ey, r * 0.13, 0, TAU); c.fill();
      } else {
        c.strokeStyle = G.dark; c.lineWidth = r * 0.17;
        c.beginPath(); c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); c.lineTo(ex, ey); c.stroke();
        c.fillStyle = G.tip; c.beginPath(); c.arc(ex, ey, r * (G.spk === 'nub' ? 0.25 : 0.2), 0, TAU); c.fill();
        c.fillStyle = '#ffffffb0'; c.beginPath(); c.arc(ex - r * 0.06, ey - r * 0.06, r * 0.07, 0, TAU); c.fill();
      }
    }
    const bg = c.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.05, 0, 0, r * 1.1);
    bg.addColorStop(0, G.tip); bg.addColorStop(0.45, G.body); bg.addColorStop(1, G.dark);
    c.fillStyle = bg; c.strokeStyle = NAVY; c.lineWidth = Math.max(1, r * 0.07);
    c.beginPath();
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; const rr = r * (1 + 0.06 * Math.sin(a * 5 + t * 4)); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.fill(); c.stroke();
    c.fillStyle = '#ffffff70'; c.beginPath(); c.ellipse(-r * 0.4, -r * 0.52, r * 0.22, r * 0.12, -0.6, 0, TAU); c.fill();
    // googly eyes
    const ey = -r * 0.18; const er = r * 0.33; const look = scared ? 0 : Math.sin(t * 1.3) * 0.4;
    for (const sd of [-1, 1]) {
      c.fillStyle = '#fff'; c.lineWidth = r * 0.06; c.beginPath(); c.arc(sd * r * 0.34, ey, er, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#120a1a'; c.beginPath(); c.arc(sd * r * 0.34 + look * er * 0.4, ey + er * 0.15, er * (scared ? 0.3 : 0.47), 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(sd * r * 0.34 + look * er * 0.4 - er * 0.15, ey, er * 0.13, 0, TAU); c.fill();
    }
    // mouth: a sly grin while sneaking, a big "oh!" while being scrubbed
    c.fillStyle = '#5A0E1E'; c.beginPath();
    if (scared) c.ellipse(0, r * 0.44, r * 0.26, r * 0.3, 0, 0, TAU); else c.ellipse(0, r * 0.38, r * 0.42, r * 0.22, 0, 0, Math.PI);
    c.fill();
    c.fillStyle = '#fff';
    if (scared) { c.fillRect(-r * 0.14, r * 0.15, r * 0.12, r * 0.1); c.fillRect(r * 0.02, r * 0.15, r * 0.12, r * 0.1); } else { c.fillRect(-r * 0.22, r * 0.38, r * 0.14, r * 0.1); c.fillRect(r * 0.08, r * 0.38, r * 0.14, r * 0.1); }
    c.restore();
  }
  // bubbles are drawn once into a small sprite and stamped (cheap on Chromebooks and phones)
  drawBubble(x, y, r, a = 1) {
    if (!this.bubSprite) this.bubSprite = this.makeBubble();
    const c = this.ctx;
    c.globalAlpha = clamp(a, 0, 1);
    c.drawImage(this.bubSprite, x - r * 1.04, y - r * 1.04, r * 2.08, r * 2.08);
    c.globalAlpha = 1;
  }
  makeBubble() {
    const s = document.createElement('canvas'); s.width = s.height = 104;
    const c = s.getContext('2d'); const x = 52; const y = 52; const r = 50;
    c.save();
    const g = c.createRadialGradient(x, y, r * 0.6, x, y, r);
    g.addColorStop(0, '#ffffff08'); g.addColorStop(0.85, '#bdf3ff40'); g.addColorStop(1, '#ffffffaa');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = '#ff7fd060'; c.lineWidth = Math.max(1, r * 0.08); c.beginPath(); c.arc(x, y, r * 0.88, 0.3, 1.4); c.stroke();
    c.strokeStyle = '#7ff0ff50'; c.beginPath(); c.arc(x, y, r * 0.88, 3.4, 4.2); c.stroke();
    c.fillStyle = '#ffffffdd'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.12, -0.7, 0, TAU); c.fill();
    c.restore();
    return s;
  }
  drawHud() {
    const S = this.S;
    if (S.phase === 'title') return;
    const c = this.ctx; const { W, H, top, bot } = this.L; const song = this.song;
    // song bar (the clock): intro / verse / chorus segments with a bubble playhead. No numbers.
    const x0 = 76; const x1 = W - Math.max(20, W * 0.05);
    const ry = top * 0.58; const rh = clamp(top * 0.2, 13, 18);
    const span = x1 - x0; const st = this.songTime(); const f = clamp(st / song.end, 0, 1);
    c.fillStyle = '#00000088';
    let p = new Path2D(); rrect(p, x0 - 5, ry - rh / 2 - 5, span + 10, rh + 10, (rh + 10) / 2); c.fill(p);
    c.font = `900 ${W < 560 ? 10 : 12}px "Lato", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
    song.sections.forEach((s) => {
      const a = s.start / song.end; const b = s.end / song.end;
      const col = s.kind === 'chorus' ? PINK : s.kind === 'verse' ? TEAL : '#2C4F86';
      c.fillStyle = col; c.globalAlpha = f >= a ? 1 : 0.42;
      const w = Math.max(2, span * (b - a) - 3);
      p = new Path2D(); rrect(p, x0 + span * a + 1.5, ry - rh / 2, w, rh, Math.min(rh / 2, w / 2)); c.fill(p);
      // played part gets a gloss line
      if (f >= a) { c.fillStyle = '#ffffff40'; c.fillRect(x0 + span * a + 6, ry - rh / 2 + 3, Math.max(0, Math.min(w, span * (f - a)) - 10), 2); }
      c.globalAlpha = 1;
      const show = W >= 560 || s.kind === 'chorus';
      if (show && w > 30) { c.fillStyle = '#cfefff'; c.fillText(s.name, x0 + span * (a + b) / 2, ry - rh / 2 - 7); }
    });
    // where the song jumps back to if time runs out
    const lp = x0 + span * (song.loopFrom / song.end);
    c.strokeStyle = '#ffffffaa'; c.setLineDash([3, 3]); c.lineWidth = 2; c.beginPath(); c.moveTo(lp, ry + rh / 2 + 3); c.lineTo(lp, ry + rh / 2 + 11); c.stroke(); c.setLineDash([]);
    const pulse = this.chorus && !this.reduced ? 1 + 0.12 * Math.abs(Math.sin(this.beat * Math.PI)) : 1;
    this.drawBubble(x0 + span * f, ry, rh * 1.1 * pulse);
    // bubble meter: one bubble per zone, filling with teal; the germ becomes a sparkle when the zone is clean
    const n = S.groups.length; const half = n / 2;
    const by = H - bot / 2;
    const gap = Math.min(bot * 0.92, (W * 0.9) / (n + 1));
    const br = Math.min(gap * 0.4, bot * 0.34);
    const total = gap * n + gap * 0.6;
    const bx0 = W / 2 - total / 2 + gap / 2;
    c.fillStyle = '#00000070';
    p = new Path2D(); rrect(p, bx0 - gap / 2 - 4, by - br - 9, total + 8, br * 2 + 18, br + 9); c.fill(p);
    S.groups.forEach((g, i) => {
      const x = bx0 + i * gap + (i >= half ? gap * 0.6 : 0);
      c.save(); c.beginPath(); c.arc(x, by, br * 0.92, 0, TAU); c.clip();
      const fill = g.clean ? 1 : g.prog;
      const lg = c.createLinearGradient(0, by + br, 0, by - br);
      lg.addColorStop(0, '#00C7DFdd'); lg.addColorStop(1, '#5FE6F5aa');
      c.fillStyle = lg;
      const wave = Math.sin(S.t * 5 + i) * br * 0.06;
      c.beginPath(); c.moveTo(x - br, by + br);
      const yy = by + br - 2 * br * fill;
      c.lineTo(x - br, yy + wave); c.quadraticCurveTo(x, yy - wave * 2, x + br, yy + wave); c.lineTo(x + br, by + br); c.fill();
      c.restore();
      if (!g.clean) this.drawGerm(c, i % 3, x, by, br * 0.42 * (1 - g.prog * 0.5), S.t + i, false, 0.95);
      else {
        c.save(); c.translate(x, by); c.rotate(this.reduced ? 0 : S.t * 0.8 + i); c.fillStyle = '#fff'; c.beginPath();
        for (let k = 0; k < 8; k++) { const rr = k % 2 ? br * 0.17 : br * 0.52; c.lineTo(Math.cos((k / 8) * TAU) * rr, Math.sin((k / 8) * TAU) * rr); }
        c.fill(); c.restore();
      }
      this.drawBubble(x, by, br);
      const active = (S.ptr.down && S.ptr.e > 4 && S.ptr.g === i) || (this.keyScrub && S.kz === i);
      if (active) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(x, by, br + 5, 0, TAU); c.stroke(); }
    });
  }
  drawRinse() {
    const S = this.S;
    if (S.phase !== 'rinse') return;
    const c = this.ctx; const { W, H, top } = this.L;
    const k = clamp((S.t - S.rinseT) / 2.2, 0, 1); const wy = top + (H - top) * k;
    // a thin sheet of water at the waterline only: the hands keep their exact colour above and below it
    const band = Math.max(18, H * 0.05);
    const g = c.createLinearGradient(0, wy - band, 0, wy);
    g.addColorStop(0, '#7fe6f600'); g.addColorStop(1, '#bff4ff66');
    c.fillStyle = g; c.fillRect(0, wy - band, W, band);
    c.fillStyle = '#ffffffcc';
    for (let i = 0; i < 40; i++) { const x = (i * 97 + S.t * 380) % W; const y = wy - ((i * 53) % 70); c.beginPath(); c.ellipse(x, y, 2, 7, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#ffffffdd'; c.fillRect(0, wy - 2, W, 3);
  }
  drawParts() {
    const c = this.ctx;
    for (const q of this.S.parts) {
      const a = 1 - q.age / q.life;
      if (q.k === 'bub') this.drawBubble(q.x, q.y, q.r, Math.min(1, a * 2));
      else if (q.k === 'tw') {
        const s = q.r * Math.sin(Math.PI * (q.age / q.life));
        c.save(); c.translate(q.x, q.y); c.fillStyle = '#ffffff'; c.globalAlpha = 0.9; c.beginPath();
        for (let k = 0; k < 8; k++) { const rr = k % 2 ? s * 0.25 : s; c.lineTo(Math.cos((k / 8) * TAU) * rr, Math.sin((k / 8) * TAU) * rr); }
        c.fill(); c.restore();
      } else { c.fillStyle = q.c; c.globalAlpha = Math.max(0, a); c.beginPath(); c.arc(q.x, q.y, 3, 0, TAU); c.fill(); c.globalAlpha = 1; }
    }
    const p = this.S.ptr;
    if (p.down && this.S.phase === 'play' && !this.S.paused) { c.fillStyle = '#ffffff30'; c.beginPath(); c.arc(p.x, p.y, 24, 0, TAU); c.fill(); this.drawBubble(p.x, p.y, 20); }
  }

  // ---------- input ----------
  locate(x, y) {
    const p = this.S.ptr;
    p.h = -1; p.z = -1; p.g = -1;
    // a finger on a germ scrubs that germ's zone, even where the germ overlaps the zone next door
    if (this.S.phase === 'play') {
      let best = null; let bd = Infinity;
      for (const o of this.S.germs) {
        if (o.st === 'pop' || o.g < 0) continue;
        const t = this.L.hands[o.h];
        const [sx, sy] = this.toScreen(o.h, o.x, o.y);
        const d = Math.hypot(sx - x, sy - y);
        if (d < MODES[this.prefs.mode].germR * t.s * 1.35 && d < bd) { bd = d; best = o; }
      }
      if (best) { p.h = best.h; p.g = best.g; p.z = this.S.groups[best.g].subs[0]; return; }
    }
    for (let h = 0; h < 2; h++) {
      const [lx, ly] = this.toLocal(h, x, y);
      const z = hitZone(lx, ly);
      if (z >= 0) { p.h = h; p.z = z; p.g = this.S.subToG?.[h]?.[z] ?? -1; return; }
    }
  }
  pos(e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  onDown(e) {
    const S = this.S; const p = S.ptr;
    if (S.phase !== 'play' || S.paused) return;
    if (p.down && p.id !== e.pointerId) return; // one scrubbing finger at a time: the 20 seconds are per zone
    e.preventDefault();
    this.audioOn();
    [p.x, p.y] = this.pos(e);
    p.id = e.pointerId; p.down = true; p.e = 0; p.dist = 0; p.downAt = S.t;
    S.kbd = false;
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.locate(p.x, p.y);
  }
  onMove(e) {
    const S = this.S; const p = S.ptr;
    if (!p.down || p.id !== e.pointerId) return;
    const [x, y] = this.pos(e);
    const d = Math.hypot(x - p.x, y - p.y);
    // rubbing energy in hand units, so a big screen and a small one feel the same
    p.e += d / this.L.hands[0].s;
    p.dist += d;
    p.x = x; p.y = y;
    this.locate(x, y);
  }
  onUp(e) {
    const S = this.S; const p = S.ptr;
    if (p.id !== e.pointerId) return;
    // a tap instead of a rub: show how, kindly
    if (S.phase === 'play' && p.down && p.dist < 8 && S.t - p.downAt < 0.35 && p.g >= 0) {
      S.taps++;
      if (S.taps >= 2 && S.t - S.tapToastT > 6) { S.tapToastT = S.t; S.taps = 0; this.toast('Rub back and forth!'); }
    }
    p.down = false; p.e = 0; p.id = null;
    this.setRub(0);
  }
  onKey(e, down) {
    const S = this.S;
    if (S.phase !== 'play' || S.paused) return;
    const n = S.groups.length;
    if (down && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) { S.kz = (S.kz + 1) % n; S.kbd = true; this.say(S.groups[S.kz].name); e.preventDefault(); }
    else if (down && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { S.kz = (S.kz + n - 1) % n; S.kbd = true; this.say(S.groups[S.kz].name); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { this.keyScrub = down; S.kbd = true; e.preventDefault(); if (!down) this.setRub(0); }
    else if (down && (e.key === 'Escape' || e.key === 'p')) { this.pause(); e.preventDefault(); }
  }
  onClick(e) {
    const chip = e.target.closest('[data-mode]');
    if (chip) { this.prefs.mode = chip.dataset.mode; this.persist(); this.syncChips(); return; }
    const sw = e.target.closest('[data-skin]');
    if (sw) {
      this.prefs.skin = Number(sw.dataset.skin); this.persist(); this.syncChips();
      this.handArt = [this.renderHand(0), this.renderHand(1)];
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'play': case 'again': case 'restart': this.startRound(); break;
      case 'title': this.toTitle(); break;
      case 'pause': this.pause(); break;
      case 'resume': this.resume(); break;
      case 'exit': this.leave(); break;
      default: break;
    }
  }
  syncChips() {
    this.shadow.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mode === this.prefs.mode));
    this.shadow.querySelectorAll('[data-skin]').forEach((x) => x.setAttribute('aria-pressed', Number(x.dataset.skin) === this.prefs.skin));
  }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.prefs)); } catch { /* private mode */ } }
}

if (typeof customElements !== 'undefined' && !customElements.get('scrub-squad')) customElements.define('scrub-squad', ScrubSquad);
})();

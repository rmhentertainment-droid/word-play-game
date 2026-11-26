// <clean-up-crew> — Clean Up Crew, a song-timed sorting game for totsmots.com (Kids mode > Games).
// Kids drag toys into the right bins before "Clean Up Crew (We Got This)" ends; the room goes from messy to sparkling.
// One self-contained custom element. Stand-in art is drawn in code (art.js, loaded next to this file); real art files
// replace it by name through art/art.json. The song record (title, audio link, length) is song.json, written by
// tools/pull-song.mjs from the Wix Songs collection, so the title is never typed by hand.
//
// Attributes:
//   song-src, song-title, song-duration  set from Velo page code (Songs collection); otherwise song.json is used
//   song-seconds  testing only: every round lasts this many seconds, with no music
//   exit-label    set when the game is drawn inside Kids mode: shows a back button and makes the finish buttons
//                 fire events instead of leaving the page
//   start-screen  "classroom" opens the Classroom timer first
//   data-url      folder holding song.json and art/ (defaults to the folder this script came from)
//   home-url      where Home goes when not inside Kids mode (default /kids)
// Events:
//   game-audio   {playing}  the song started or stopped (Velo page code can hide the site music player)
//   game-exit    back button / "Choose a New Game"  (Kids mode shows the Games grid)
//   game-home    "Home"  (Kids mode closes the games layer)
//   game-finish  {mode, sorted, total, stars, secondsLeft, badge, songSeconds}
// The song announces itself with window event "tm-media-play" {el}, so the site music player fades out, and any other
// audio on the page is paused while a round plays.
(() => {
const SCRIPT_URL = (typeof document !== 'undefined' && (document.currentScript?.src ||
  [...document.querySelectorAll('script[src]')].map((s) => s.src).find((u) => /clean-up-crew\.js(\?|$)/.test(u)))) || '';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap';
const SAVE_KEY = 'cleanupcrew-v1';
const STW = 1280;
const STH = 720;
const BIN_Y = 474;
const BIN_W = 272;
const BINS = [
  { k: 'blocks', name: 'Blocks', x: 57 },
  { k: 'stuffies', name: 'Stuffies', x: 355 },
  { k: 'books', name: 'Books', x: 653 },
  { k: 'clothes', name: 'Clothes', x: 951 },
];
const TOYS = {
  brick: { label: 'Brick block', bin: 'blocks', w: 118, h: 94 },
  star: { label: 'Star block', bin: 'blocks', w: 104, h: 104 },
  teddy: { label: 'Teddy bear', bin: 'stuffies', w: 104, h: 118 },
  book: { label: 'Storybook', bin: 'books', w: 120, h: 97 },
  shirt: { label: 'T-shirt', bin: 'clothes', w: 118, h: 107 },
};
// [toy, colour, extra]  Big mess = 4 per bin; Little mess = 3 + 3 + 2 + 2
const MESS = {
  big: [['brick', '#E8383D'], ['brick', '#1E6FE0'], ['star', '#2CCBEA'], ['star', '#F0558C'],
    ['teddy', '#C98A4B'], ['teddy', '#E0A85C'], ['teddy', '#F08DB0'], ['teddy', '#A98BE0'],
    ['book', '#F0558C', 'heart'], ['book', '#1EB7D8', 'star'], ['book', '#7B5CE0', 'moon'], ['book', '#FF8A3D', 'star'],
    ['shirt', '#F0558C'], ['shirt', '#1EB7D8'], ['shirt', '#7B5CE0'], ['shirt', '#FFB000', '#FFFFFF']],
  little: [['brick', '#E8383D'], ['star', '#2CCBEA'], ['brick', '#1E6FE0'],
    ['teddy', '#C98A4B'], ['teddy', '#F08DB0'], ['teddy', '#E0A85C'],
    ['book', '#F0558C', 'heart'], ['book', '#1EB7D8', 'star'],
    ['shirt', '#1EB7D8'], ['shirt', '#F0558C']],
};
// Where toys can land (top-left corners on the 1280 x 720 stage), clear of the HUD, the robot and the bins
const SLOTS = [
  [214, 132], [372, 132], [530, 132], [688, 132], [846, 132], [1004, 132],
  [196, 250], [346, 250], [496, 250], [646, 250], [796, 250], [946, 250], [1096, 250],
  [262, 352], [432, 352], [602, 352], [772, 352], [942, 352], [1112, 352],
];
// Spots inside a bin where sorted toys peek out over the rim (relative to the bin)
const PEEK = [[46, -38, -10], [146, -30, 8], [96, -50, 4], [176, -40, -6]];
const CHEERS = ['Great job!', 'Nice!', 'Keep going!'];

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (s) => {
  s = Math.max(0, Math.ceil(s - 0.001));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const rand = (a, b) => a + Math.random() * (b - a);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// the school day before d (Friday for a Monday), so weekends don't break a class streak
const prevSchoolDay = (d) => {
  const p = new Date(d);
  do { p.setDate(p.getDate() - 1); } while (p.getDay() === 0 || p.getDay() === 6);
  return dayKey(p);
};
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
const svg = (body, size, extra = '') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ${extra}>${body}</svg>`;
const STROKE = (c, w = 2.6) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const STAR_PATH = 'M12 2.2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.1l-5.9 3.1 1.2-6.5L2.5 9.1l6.6-.9z';
const SPARK_PATH = 'M12 1c.8 6 3.2 9.6 11 11-7.8 1.4-10.2 5-11 11-.8-6-3.2-9.6-11-11 7.8-1.4 10.2-5 11-11z';
const I = {
  note: (c, s) => svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', s, STROKE(c)),
  star: (s, fill = '#FFD12E', stroke = '#E8A400') => svg(`<path d="${STAR_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`, s),
  spark: (s, fill = '#FFFFFF') => svg(`<path d="${SPARK_PATH}" fill="${fill}"/>`, s),
  play: (s, c = '#0B2F57') => svg(`<path d="M6.5 3.8v16.4c0 .8.9 1.3 1.6.9l13-8.2c.6-.4.6-1.3 0-1.7l-13-8.2c-.7-.5-1.6 0-1.6.8z" fill="${c}"/>`, s),
  pause: (s, c = '#0B2F57') => svg(`<rect x="5" y="4" width="5" height="16" rx="1.5" fill="${c}"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="${c}"/>`, s),
  layers: (s, c) => svg('<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>', s, STROKE(c, 2.2)),
  screen: (s, c) => svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', s, STROKE(c, 2.4)),
  lock: (s, c) => svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', s, STROKE(c, 2.4)),
  clock: (s, c) => svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.5h4M18.5 6.5l1.5-1.5"/>', s, STROKE(c, 2.4)),
  again: (s, c) => svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>', s, STROKE(c)),
  list: (s, c) => svg(`<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="${c}"/><circle cx="4.5" cy="12" r="1.2" fill="${c}"/><circle cx="4.5" cy="18" r="1.2" fill="${c}"/>`, s, STROKE(c)),
  home: (s, c) => svg('<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>', s, STROKE(c)),
  check: (s) => svg('<circle cx="12" cy="12" r="10" fill="#3CC85A" stroke="#FFFFFF" stroke-width="2"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>', s),
  back: (s, c) => svg('<path d="M15 5l-7 7 7 7"/>', s, STROKE(c, 3)),
  full: (s, c) => svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', s, STROKE(c, 2.6)),
  rotate: (s, c) => svg('<rect x="3" y="8" width="13" height="9" rx="2"/><path d="M17 4a5 5 0 0 1 4 5M21 9l1.5-2M21 9l-2.4-.6"/>', s, STROKE(c, 2)),
};

// ---------- the playroom (from the v2 canvas) ----------
const SPARKLE_SPOTS = [[300, 60, 26], [470, 210, 18], [640, 96, 22], [820, 200, 16], [980, 60, 24], [1210, 230, 20],
  [140, 330, 18], [560, 300, 16], [900, 330, 22], [1060, 410, 16], [360, 420, 20], [700, 440, 18]];
const ROOM = `
<div class="room">
<div style="position:absolute;left:0;top:0;width:1280px;height:500px;background:linear-gradient(180deg,#8ADAF8 0%,#56C1EE 100%)"></div>
<div style="position:absolute;left:-40px;top:36px;width:360px;height:470px;border-radius:180px 180px 0 0;background:rgba(255,255,255,.22)"></div>
<div style="position:absolute;left:50px;top:120px;width:220px;height:190px;box-sizing:border-box;border-radius:22px;border:12px solid #fff;background:linear-gradient(180deg,#CFF3FF 0%,#F2FCFF 100%);box-shadow:0 10px 24px rgba(11,47,87,.15)">
<div style="position:absolute;left:92px;top:0;width:12px;height:166px;background:#fff"></div>
<div style="position:absolute;left:22px;top:40px;width:60px;height:24px;border-radius:999px;background:#fff"></div>
<div style="position:absolute;left:120px;top:100px;width:50px;height:20px;border-radius:999px;background:#fff"></div>
<div style="position:absolute;left:0;bottom:0;width:196px;height:40px;border-radius:40px 60px 0 0;background:#8FD46A"></div></div>
<div style="position:absolute;left:1040px;top:96px;width:34px;height:92px;border-radius:6px;background:linear-gradient(90deg,#1FB6D6,#3FD0EC)"></div>
<div style="position:absolute;left:1078px;top:84px;width:30px;height:104px;border-radius:6px;background:linear-gradient(90deg,#F5B800,#FFD84D)"></div>
<div style="position:absolute;left:1112px;top:104px;width:24px;height:84px;border-radius:6px;background:linear-gradient(90deg,#E43C7F,#F66CA0)"></div>
<div class="lamp" style="position:absolute;left:1160px;top:92px">${I.star(84, '#FFE46B', '#F5B800')}</div>
<div style="position:absolute;left:1020px;top:186px;width:240px;height:22px;border-radius:10px;background:linear-gradient(180deg,#F6DAB2,#DDB07A);box-shadow:0 10px 16px rgba(11,47,87,.18)"></div>
<div style="position:absolute;left:1140px;top:250px;width:112px;height:124px;box-sizing:border-box;border-radius:20px;border:10px solid #fff;background:linear-gradient(180deg,#BDEBFA,#E9F9FF);overflow:hidden;box-shadow:0 8px 18px rgba(11,47,87,.15)">
<div style="position:absolute;left:30px;top:18px;width:34px;height:34px;border-radius:50%;background:#FFD12E"></div>
<div style="position:absolute;left:-10px;top:62px;width:120px;height:60px;border-radius:50% 50% 0 0;background:#4FB7E2"></div></div>
<div style="position:absolute;left:0;top:488px;width:1280px;height:14px;background:rgba(255,255,255,.75)"></div>
<div style="position:absolute;left:0;top:502px;width:1280px;height:218px;background:repeating-linear-gradient(90deg,rgba(120,70,20,.08) 0 2px,transparent 2px 170px),linear-gradient(180deg,#F3C690 0%,#DDA06A 100%)"></div>
<div class="rug" style="position:absolute;left:110px;top:560px;width:1060px;height:220px;box-sizing:border-box;border-radius:50%;border:12px solid #7FD3E6;background:radial-gradient(ellipse at 50% 40%,#FBF1E2 0%,#EBD5B6 100%)"></div>
<svg aria-hidden="true" style="position:absolute;left:0;top:300px" width="200" height="190" viewBox="0 0 200 190"><path d="M100 180C80 120 40 100 10 96c30-6 62 8 86 60" fill="#5DBB3F"/><path d="M100 180c-4-70 16-120 54-150-14 40-22 90-40 150" fill="#78D152"/><path d="M100 180c10-50 40-80 92-82-34 14-60 44-80 84" fill="#4AA932"/><path d="M100 180C70 140 60 80 76 30c10 50 20 100 30 150" fill="#6CC646"/></svg>
<div style="position:absolute;left:34px;top:452px;width:132px;height:120px;border-radius:14px 14px 56px 56px;background:radial-gradient(circle at 30% 30%,#fff,#E9EEF2);box-shadow:0 14px 20px rgba(11,47,87,.2)">
<div style="position:absolute;left:22px;top:30px;width:22px;height:22px;border-radius:50%;background:#FFC928"></div>
<div style="position:absolute;left:70px;top:54px;width:22px;height:22px;border-radius:50%;background:#2CC4E4"></div>
<div style="position:absolute;left:40px;top:80px;width:18px;height:18px;border-radius:50%;background:#2CC4E4"></div></div>
<div style="position:absolute;left:1120px;top:500px;width:240px;height:180px;border-radius:50% 50% 44% 44%;background:radial-gradient(circle at 32% 28%,#FFA3C1 0%,#F0558C 60%,#D53A73 100%);box-shadow:0 16px 24px rgba(11,47,87,.22)"></div>
</div>
<div class="dim"></div>
<div class="sparkles">${SPARKLE_SPOTS.map(([x, y, s], i) => `<span class="spk" style="left:${x}px;top:${y}px;animation-delay:${(i * 0.37) % 2}s">${I.spark(s)}</span>`).join('')}</div>`;

// ---------- styles ----------
const CSS = `
:host { display:block; position:relative; width:100%; height:100%; min-height:240px; overflow:hidden; contain:content;
  background:linear-gradient(180deg,#8ADAF8 0%,#56C1EE 69.4%,#F3C690 69.4%,#DDA06A 100%);
  font-family:Fredoka, Lato, system-ui, sans-serif; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
:host(:fullscreen) { width:100vw; height:100vh; }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; -webkit-tap-highlight-color:transparent; cursor:pointer; }
:focus-visible { outline:5px solid #FFD12E; outline-offset:4px; }
.stage { position:absolute; left:0; top:0; width:1280px; height:720px; transform-origin:0 0; overflow:hidden; color:#0B2F57;
  font-weight:600; touch-action:none; }
.screen { position:absolute; inset:0; }
.room { position:absolute; inset:0; transition:filter .6s; }
.dim { position:absolute; inset:0; background:rgba(70,80,105,.24); opacity:0; transition:opacity .6s; pointer-events:none; }
.sparkles { position:absolute; inset:0; pointer-events:none; }
.spk { position:absolute; opacity:0; transform:scale(.4); transition:opacity .5s, transform .5s; }
.spk.on { opacity:1; transform:scale(1); animation:twinkle 2s ease-in-out infinite; }
@keyframes twinkle { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(.6); opacity:.6; } }
.abs { position:absolute; }
/* type */
.title { position:absolute; left:0; width:1280px; margin:0; text-align:center; font-weight:700; line-height:1; letter-spacing:-1px;
  -webkit-text-stroke:14px #0B2F57; paint-order:stroke fill; text-shadow:0 10px 0 #0B2F57, 0 18px 30px rgba(11,47,87,.35); color:#fff; }
.title .y { color:#FFD12E; }
.logo { display:flex; align-items:center; gap:8px; background:linear-gradient(180deg,#164A7A,#0B2F57); color:#fff; border-radius:999px;
  padding:8px 20px 10px; font-size:26px; font-weight:700; box-shadow:0 6px 0 #07203D; white-space:nowrap; }
.logo img { height:34px; display:block; }
/* chunky buttons */
.btn { position:absolute; border-radius:999px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:16px;
  border:5px solid var(--rim); background:linear-gradient(180deg,var(--t) 0%,var(--b) 100%); color:var(--fg);
  box-shadow:0 10px 0 var(--ledge), 0 18px 30px rgba(11,47,87,.3); transition:transform .08s, box-shadow .08s; padding:0; line-height:1; }
.btn:active:not(:disabled) { transform:translateY(6px); box-shadow:0 4px 0 var(--ledge), 0 8px 16px rgba(11,47,87,.3); }
.btn:disabled { cursor:default; filter:saturate(.5); opacity:.85; }
.yellow { --t:#FFE56E; --b:#FFC21A; --rim:#FFF3B8; --ledge:#D99A00; --fg:#0B2F57; }
.navy { --t:#1A5488; --b:#0B2F57; --rim:#2CCBEA; --ledge:#07203D; --fg:#FFFFFF; border-width:6px; }
.cyan { --t:#7BE6F8; --b:#1EC0E2; --rim:#CFF7FF; --ledge:#0E92B0; --fg:#0B2F57; }
.pink { --t:#FF7FB2; --b:#E2367E; --rim:#FFD0E3; --ledge:#A81E58; --fg:#FFFFFF; }
.white { --t:#FFFFFF; --b:#E8F6FB; --rim:#FFFFFF; --ledge:#B9DCEA; --fg:#0B2F57; }
.small { position:absolute; height:56px; border:0; border-radius:999px; padding:0 22px 0 16px; background:rgba(255,255,255,.94); color:#0B2F57;
  font-size:20px; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:0 5px 0 #B9DCEA; transition:transform .08s, box-shadow .08s; }
.small:active { transform:translateY(4px); box-shadow:0 1px 0 #B9DCEA; }
.round { position:absolute; width:72px; height:72px; border:0; border-radius:50%; background:#fff; display:grid; place-items:center;
  box-shadow:0 6px 0 #C9E7F2, 0 10px 18px rgba(11,47,87,.2); transition:transform .08s, box-shadow .08s; }
.round:active { transform:translateY(4px); box-shadow:0 2px 0 #C9E7F2; }
.sub { display:block; font-size:16px; font-weight:600; opacity:.85; margin-top:4px; }
/* hold-to-open (Grown-ups) */
.hold { overflow:hidden; }
.hold .fill { position:absolute; left:0; top:0; bottom:0; width:0; background:#FFD12E; opacity:.6; }
.hold.holding .fill { width:100%; transition:width 1.2s linear; }
.hold > :not(.fill) { position:relative; }
.hint { position:absolute; right:24px; top:88px; background:#0B2F57; color:#fff; border-radius:16px; padding:8px 14px; font-size:18px; }
/* toys */
.toy { position:absolute; left:0; top:0; padding:0; border:0; background:none; touch-action:none; cursor:grab;
  filter:drop-shadow(0 14px 12px rgba(11,47,87,.28)); will-change:transform; }
.toy svg, .toy img { display:block; width:100%; height:100%; pointer-events:none; }
.toy.dragging { cursor:grabbing; z-index:5; filter:drop-shadow(0 26px 18px rgba(11,47,87,.35)) drop-shadow(0 0 12px rgba(255,255,255,.9)); }
.toy.picked { z-index:4; filter:drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px #FFD12E) drop-shadow(0 20px 16px rgba(11,47,87,.3)); }
.toy.returning { transition:transform .5s cubic-bezier(.34,1.56,.64,1); }
.toy.flying { pointer-events:none; z-index:6; filter:drop-shadow(0 0 14px #fff) drop-shadow(0 0 22px rgba(255,236,150,.9)); }
.toy.fade { transition:opacity .2s, transform .2s; opacity:0; }
/* bins */
.bin { position:absolute; top:${BIN_Y}px; width:${BIN_W}px; height:218px; padding:0; border:0; background:none; }
.bin > * { position:absolute; pointer-events:none; }
.bin .bk, .bin .fr { left:0; top:0; width:${BIN_W}px; height:218px; }
.bin .fr { filter:drop-shadow(0 16px 14px rgba(11,47,87,.3)); }
.bin .glow { left:-30px; top:-50px; width:332px; height:300px; border-radius:50%; opacity:0; transition:opacity .15s;
  background:radial-gradient(closest-side, rgba(255,255,255,.95), rgba(255,240,170,.55) 55%, rgba(255,255,255,0) 100%); }
.bin.hover .glow { opacity:1; }
.bin.hover .fr { transform:translateY(-6px) scale(1.03); transition:transform .15s; }
.bin.ready .glow { opacity:.55; animation:breathe 1.2s ease-in-out infinite; }
@keyframes breathe { 50% { opacity:.2; } }
.bin .peek { left:0; top:0; width:${BIN_W}px; height:218px; }
.bin .peek > * { position:absolute; }
.bin .peek svg, .bin .peek img, .stage svg[preserveAspectRatio], .stage .abs > img, .mini img { display:block; width:100%; height:100%; }
.bin .count { z-index:2; right:10px; top:-14px; background:#fff; border-radius:999px; padding:3px 14px 5px; font-size:22px; font-weight:700;
  box-shadow:0 4px 0 #C9E7F2; font-variant-numeric:tabular-nums; }
.nocounts .bin .count { display:none; }
.bin.wiggle .fr, .bin.wiggle .peek { animation:wiggle .45s; }
@keyframes wiggle { 20% { transform:rotate(-3deg); } 40% { transform:rotate(3deg); } 60% { transform:rotate(-2deg); } 80% { transform:rotate(1deg); } }
.bin.pop .fr { animation:pop .35s; }
@keyframes pop { 40% { transform:scale(1.06, .95); } 70% { transform:scale(.98, 1.03); } }
.peek .in { animation:drop-in .35s ease-out; }
@keyframes drop-in { from { transform:translateY(-30px) scale(.6); opacity:0; } }
/* HUD */
.timer { position:absolute; left:420px; top:14px; width:440px; height:104px; border-radius:999px; border:6px solid #2CCBEA;
  background:linear-gradient(180deg,#164A7A,#0B2F57); box-shadow:0 8px 0 #07203D, 0 14px 26px rgba(11,47,87,.3);
  display:flex; align-items:center; justify-content:center; gap:18px; color:#fff; }
.timer .t { font-size:60px; font-weight:700; line-height:.9; font-variant-numeric:tabular-nums; min-width:150px; }
.bar { width:190px; height:12px; border-radius:6px; background:rgba(255,255,255,.18); overflow:hidden; margin-top:6px; }
.bar i { display:block; height:100%; width:0; border-radius:6px; background:linear-gradient(90deg,#FFD12E,#FFB800); }
.score { position:absolute; right:24px; top:26px; height:72px; display:flex; align-items:center; gap:10px; background:#fff; border-radius:999px;
  padding:0 26px 0 16px; font-size:38px; font-weight:700; box-shadow:0 6px 0 #C9E7F2, 0 12px 22px rgba(11,47,87,.2); font-variant-numeric:tabular-nums; }
.score.bump { animation:bump .3s; }
@keyframes bump { 50% { transform:scale(1.1); } }
/* robot + bubble */
.robot { position:absolute; left:20px; top:112px; width:152px; height:184px; pointer-events:none; filter:drop-shadow(0 14px 12px rgba(11,47,87,.28)); }
.robot > * { width:100%; height:100%; display:block; }
.robot.cheer { animation:hop .6s; }
@keyframes hop { 30% { transform:translateY(-26px) rotate(-4deg); } 60% { transform:translateY(0) rotate(2deg); } 80% { transform:translateY(-8px); } }
.bubble { position:absolute; left:186px; top:132px; background:#fff; border-radius:36px; padding:14px 30px 16px; text-align:center; pointer-events:none;
  box-shadow:0 8px 0 #B9DCEA, 0 14px 24px rgba(11,47,87,.2); opacity:0; transform:scale(.6); transform-origin:0 60%; transition:opacity .2s, transform .25s cubic-bezier(.34,1.56,.64,1); z-index:7; }
.bubble.on { opacity:1; transform:scale(1); }
.bubble b { display:block; font-size:46px; font-weight:700; line-height:1; white-space:nowrap; }
.bubble small { display:block; font-size:20px; color:#456A8A; margin-top:4px; }
.bubble::before { content:''; position:absolute; left:-20px; top:44px; border-top:14px solid transparent; border-bottom:14px solid transparent; border-right:22px solid #fff; }
/* effects */
.fx { position:absolute; inset:0; pointer-events:none; z-index:6; overflow:visible; }
.arc { fill:none; stroke-linecap:round; stroke-dasharray:1; stroke-dashoffset:1; animation:draw .5s ease-out forwards, fadeout .5s .45s forwards; }
.arc.glo { stroke:rgba(255,255,255,.4); stroke-width:22; }
.arc.core { stroke:#fff; stroke-width:6; }
@keyframes draw { to { stroke-dashoffset:0; } }
@keyframes fadeout { to { opacity:0; } }
.sp { position:absolute; width:24px; height:24px; margin:-12px 0 0 -12px; pointer-events:none; z-index:6; animation:sp .7s ease-out forwards; }
@keyframes sp { from { transform:scale(1) rotate(0); opacity:1; } to { transform:translate(var(--dx),var(--dy)) scale(.2) rotate(90deg); opacity:0; } }
.confetti { position:absolute; top:-30px; width:16px; height:8px; border-radius:3px; pointer-events:none; animation:fall linear forwards; }
@keyframes fall { to { transform:translate(var(--dx), 800px) rotate(var(--r)); } }
/* overlays */
.veil { position:absolute; inset:0; background:rgba(11,47,87,.55); display:grid; place-items:center; z-index:20; }
.panel { position:relative; width:760px; border-radius:40px; border:6px solid #3FD6F2; background:linear-gradient(180deg,#164A7A 0%,#0B2F57 100%);
  box-shadow:0 0 0 6px rgba(255,209,46,.75), 0 22px 40px rgba(11,47,87,.4); color:#fff; padding:36px 40px 40px; text-align:center; }
.panel h2 { margin:0 0 22px; font-size:52px; font-weight:700; line-height:1; }
.panel .row { display:flex; justify-content:center; gap:24px; }
.panel .btn { position:relative; }
.opt { position:relative; flex:1; height:220px; border-radius:32px; border:6px solid #2CCBEA; background:rgba(255,255,255,.08); color:#fff;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; font-size:40px; font-weight:700; }
.opt small { font-size:24px; color:#BFEFF8; font-weight:600; }
.opt .minis { display:flex; gap:4px; height:62px; align-items:flex-end; }
.opt .minis svg { height:56px; width:auto; }
.opt[aria-pressed="true"] { border-color:#FFD12E; background:rgba(255,209,46,.16); box-shadow:0 0 0 4px rgba(255,209,46,.5); }
.opt .tick { position:absolute; right:14px; top:14px; display:none; }
.opt[aria-pressed="true"] .tick { display:block; }
.set { display:flex; align-items:center; justify-content:space-between; gap:16px; text-align:left; padding:14px 0; border-bottom:2px solid rgba(255,255,255,.12); font-size:24px; }
.set small { display:block; color:#BFEFF8; font-size:17px; font-weight:500; }
.switch { flex:none; width:96px; height:54px; border-radius:999px; border:4px solid #2CCBEA; background:rgba(255,255,255,.1); position:relative; padding:0; }
.switch::after { content:''; position:absolute; left:4px; top:4px; width:38px; height:38px; border-radius:50%; background:#fff; transition:left .15s; }
.switch[aria-checked="true"] { background:#3CC85A; border-color:#A8EBB5; }
.switch[aria-checked="true"]::after { left:46px; }
.seg { display:flex; gap:8px; }
.seg button { height:54px; padding:0 18px; border-radius:999px; border:4px solid #2CCBEA; background:transparent; color:#fff; font-size:20px; font-weight:700; }
.seg button[aria-pressed="true"] { background:#FFD12E; border-color:#FFF3B8; color:#0B2F57; }
.linkbtn { height:54px; padding:0 20px; border-radius:999px; border:4px solid #2CCBEA; background:transparent; color:#fff; font-size:20px; font-weight:700; }
/* finish */
.fpanel { position:absolute; left:296px; top:246px; width:688px; height:318px; border-radius:40px; border:6px solid #3FD6F2;
  background:linear-gradient(180deg,#164A7A 0%,#0B2F57 100%); box-shadow:0 0 0 6px rgba(255,209,46,.75), 0 22px 40px rgba(11,47,87,.4); }
.ring { position:absolute; border-radius:50%; }
.ring > div { position:absolute; border-radius:50%; background:#0B2F57; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; text-align:center; }
.pill { display:flex; align-items:center; gap:8px; height:48px; border-radius:999px; border:3px solid #2CCBEA; background:rgba(255,255,255,.08);
  padding:0 18px 0 8px; color:#fff; font-size:22px; font-weight:600; white-space:nowrap; }
.ribbon { display:flex; align-items:center; gap:10px; background:linear-gradient(180deg,#E6FBFF,#B8EEF9); border:4px solid #fff; border-radius:999px;
  padding:6px 14px 6px 26px; font-size:32px; font-weight:700; box-shadow:0 6px 0 #0E92B0; }
.bstar { position:absolute; filter:drop-shadow(0 6px 0 rgba(11,47,87,.25)); }
.bstar.in { animation:starin .5s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes starin { from { transform:scale(0) rotate(-40deg); } }
.friend { position:absolute; filter:drop-shadow(0 14px 12px rgba(11,47,87,.28)); }
.friend > * { width:100%; height:100%; display:block; }
.friend.dance { animation:sway 1.6s ease-in-out infinite; transform-origin:50% 100%; }
@keyframes sway { 50% { transform:rotate(3deg) translateY(-6px); } }
.chipbadge { position:absolute; right:26px; top:24px; display:flex; align-items:center; gap:10px; background:#fff; border-radius:999px; padding:6px 18px 6px 8px; box-shadow:0 5px 0 #B9DCEA; }
.chipbadge .medal { width:40px; height:40px; border-radius:50%; background:linear-gradient(180deg,#FFE56E,#FFC21A); display:grid; place-items:center; flex:none; }
.mini { position:absolute; overflow:hidden; border:6px solid #fff; border-radius:26px; background:linear-gradient(180deg,#A5E3F8 0%,#7FD3F2 60%,#F1C892 60%,#DDA06A 100%); }
.mini > * { position:absolute; }
.mini .mt { transition:transform .9s cubic-bezier(.45,.05,.3,1); }
/* classroom */
.cring { position:absolute; left:80px; top:136px; width:440px; height:440px; border-radius:50%; box-shadow:0 0 0 10px #fff, 0 24px 44px rgba(11,47,87,.4); }
.cring > div { position:absolute; left:34px; top:34px; width:372px; height:372px; border-radius:50%; background:radial-gradient(circle at 40% 30%,#1A5488,#0B2F57);
  display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; }
.note { position:absolute; left:0; right:0; text-align:center; font-size:22px; color:#fff; text-shadow:0 2px 0 #0B2F57; }
/* loading + turn your device */
.loading { position:absolute; inset:0; display:grid; place-items:center; font-size:40px; font-weight:700; color:#0B2F57; }
.spin { width:34px; height:34px; border-radius:50%; border:5px solid rgba(11,47,87,.25); border-top-color:#0B2F57; animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.turn { position:absolute; inset:0; z-index:50; display:none; place-items:center; padding:24px; background:linear-gradient(180deg,#8ADAF8,#56C1EE); text-align:center; color:#0B2F57; }
.turn.on { display:grid; }
.turn .card { background:#fff; border-radius:32px; padding:24px 24px 28px; box-shadow:0 8px 0 #B9DCEA, 0 16px 30px rgba(11,47,87,.2); max-width:340px; }
.turn .bot { width:150px; height:182px; margin:0 auto; }
.turn .bot > * { width:100%; height:100%; }
.turn b { display:block; font-size:30px; font-weight:700; margin:10px 0 6px; }
.turn p { margin:0 0 14px; font-size:19px; color:#456A8A; }
.turn .ico { animation:tilt 2s ease-in-out infinite; display:inline-block; }
@keyframes tilt { 50% { transform:rotate(-90deg); } }
.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.rm *, .rm *::before, .rm *::after { animation:none !important; transition:none !important; }
`;

class CleanUpCrew extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.settings = { counts: true, sound: true, mess: 'big' };
    this.save = { rounds: 0, best: 0, captain: null, streak: { count: 0, last: null } };
    this.realArt = {};
    this.ready = false;
    this.g = null;
    this.cls = null;
  }

  // Velo page code sets the song record after the element has started: take it while nothing is playing.
  static get observedAttributes() { return ['song-src', 'song-title', 'song-duration']; }
  attributeChangedCallback(name, old, v) {
    if (!this.song || old === v || !v) return;
    const busy = this.g || this.cls?.running;
    if (name === 'song-title') this.song.title = v;
    if (name === 'song-duration' && Number(v) > 0 && !busy && !Number(this.getAttribute('song-seconds'))) {
      this.song.duration = Number(v);
      this.song.fromRecord = true;
    }
    if (name === 'song-src' && this.audio && !busy && this.song.audio !== v) {
      this.song.audio = v;
      this.audio.src = v;
    }
  }

  // ---------- setup ----------
  connectedCallback() {
    if (this.shadow.firstChild) return;
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    this.loadSaved();
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shadow.innerHTML = `<style>${CSS}</style>
      <div class="stage${this.reduced ? ' rm' : ''}" role="application" aria-roledescription="game" aria-label="Clean Up Crew">${ROOM}<div class="screen"></div>
        <div class="sr" aria-live="polite"></div></div>
      <div class="turn" role="dialog" aria-label="Turn your device"><div class="card"><div class="bot"></div>
        <b>Turn your device</b><p>Clean Up Crew plays sideways.</p><span class="ico">${I.rotate(56, '#0B2F57')}</span></div></div>`;
    this.stage = this.shadow.querySelector('.stage');
    this.screen = this.shadow.querySelector('.screen');
    this.live = this.shadow.querySelector('.sr');
    this.turn = this.shadow.querySelector('.turn');
    this.stage.addEventListener('click', (e) => this.onClick(e));
    this.stage.addEventListener('pointerdown', (e) => this.onDown(e));
    this.stage.addEventListener('pointermove', (e) => this.onMove(e));
    this.stage.addEventListener('pointerup', (e) => this.onUp(e));
    this.stage.addEventListener('pointercancel', (e) => this.onUp(e, true));
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this);
    this.fit();
    this._vis = () => {
      if (document.hidden) { if (this.g && !this.g.over) this.pause(); if (this.cls?.running) this.classPause(); }
      else if (this.cls?.running) this.wake(true);
    };
    document.addEventListener('visibilitychange', this._vis);
    this.base = new URL(this.getAttribute('data-url') || './', SCRIPT_URL || location.href);
    this.screen.innerHTML = `<div class="loading"><div style="display:flex;align-items:center;gap:16px"><span class="spin"></span>Loading…</div></div>`;
    // The game page is open: the site's music player goes quiet (and stays quiet).
    this.hushPage();
    window.dispatchEvent(new CustomEvent('tm-media-play', { detail: {} }));
    this.load();
  }

  disconnectedCallback() {
    this.stopRound();
    this.stopClass();
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio = null; }
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this._vis);
  }

  async load() {
    const artReady = window.CleanUpCrewArt ? Promise.resolve() : loadScript(new URL('art.js', SCRIPT_URL || this.base).href);
    const fontReady = document.fonts?.load ? document.fonts.load('700 40px Fredoka').catch(() => {}) : Promise.resolve();
    const songInfo = this.loadSongInfo();
    const realArt = fetch(new URL('art/art.json', this.base)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    try { await artReady; } catch {
      this.screen.innerHTML = '<div class="loading">The game did not load. Check the internet and try again.</div>';
      return;
    }
    this.A = window.CleanUpCrewArt.ART;
    const manifest = await realArt;
    await Promise.all(Object.entries(manifest || {}).filter(([k]) => !k.startsWith('_')).map(([k, f]) => new Promise((res) => {
      const img = new Image();
      img.onload = () => { this.realArt[k] = img.src; res(); };
      img.onerror = res;
      img.src = new URL(`art/${f}`, this.base).href;
    })));
    await Promise.race([fontReady, new Promise((r) => setTimeout(r, 2500))]);
    await songInfo;
    const songReady = this.loadAudio();
    this.turn.querySelector('.bot').innerHTML = this.art('robot-wave');
    if (this.getAttribute('start-screen') === 'classroom') this.renderClassroom();
    else this.renderStart();
    await songReady;
    this.ready = true;
    const play = this.shadow.querySelector('[data-act="play"]');
    if (play) { play.disabled = false; play.innerHTML = `${I.play(52)}<span>Play</span>`; }
    const cstart = this.shadow.querySelector('[data-act="cl-toggle"]');
    if (cstart) cstart.disabled = false;
  }

  // Song record: from attributes (Velo page code), else song.json next to this file.
  async loadSongInfo() {
    let song = null;
    if (this.getAttribute('song-src')) {
      song = { audio: this.getAttribute('song-src'), title: this.getAttribute('song-title'), duration: Number(this.getAttribute('song-duration')) || null };
    } else {
      try { song = await fetch(new URL('song.json', this.base)).then((r) => r.json()); } catch { song = null; }
    }
    this.song = { title: song?.title || '', duration: song?.duration || 145, audio: song?.audio || null, fromRecord: !!song?.duration };
    const test = Number(this.getAttribute('song-seconds'));
    if (test > 0) this.song.duration = test;
  }

  // The song itself: resolves when it can play through (or after a few seconds on a slow connection)
  async loadAudio() {
    const test = Number(this.getAttribute('song-seconds'));
    if (test > 0) { this.song.duration = test; this.noMusic = true; return; }
    if (!this.song.audio) { this.noMusic = true; return; }
    const a = document.createElement('audio');
    a.preload = 'auto';
    a.hidden = true;
    a.src = this.song.audio;
    this.shadow.appendChild(a); // kept inside the game so the site player's media scan can find it
    this.audio = a;
    // the Songs record's length is the round's length; the file's own length is used only when the record has none
    a.addEventListener('loadedmetadata', () => { if (!this.song.fromRecord && isFinite(a.duration) && a.duration > 1) this.song.duration = a.duration; });
    // Something else paused the song (the site player, a headset button): pause the game with it.
    a.addEventListener('pause', () => {
      if (this.selfPause || a.ended) return;
      if (this.g && !this.g.over && !this.g.paused) this.pause();
      if (this.cls?.running) this.classPause();
    });
    a.addEventListener('play', () => { this.emitAudio(true); });
    a.addEventListener('ended', () => { if (this.g && !this.g.over) this.finish('time'); });
    await new Promise((resolve) => {
      const done = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(done, 9000); // slow connection: let them start; the song keeps loading
      a.addEventListener('canplaythrough', done, { once: true });
      a.addEventListener('error', () => { this.noMusic = true; done(); }, { once: true });
    });
  }

  fit() {
    const w = this.clientWidth;
    let h = this.clientHeight;
    if (h < 120 && w > 0) { h = Math.round((w * 9) / 16); this.style.height = `${h}px`; }
    if (!w || !h) return;
    const s = Math.min(w / STW, h / STH);
    this.scale = s;
    this.stage.style.transform = `translate(${(w - STW * s) / 2}px, ${(h - STH * s) / 2}px) scale(${s})`;
    const portraitPhone = h > w && w < 600;
    if (portraitPhone !== this.turn.classList.contains('on')) {
      this.turn.classList.toggle('on', portraitPhone);
      if (portraitPhone && this.g && !this.g.over) this.pause();
    }
  }

  toStage(e) {
    const r = this.stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
  }

  // ---------- saved state (badge, class streak, grown-up settings) ----------
  loadSaved() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (d) {
        Object.assign(this.save, d.save || {});
        Object.assign(this.settings, d.settings || {});
      }
    } catch { /* private mode */ }
    if (!MESS[this.settings.mess]) this.settings.mess = 'big';
  }
  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ save: this.save, settings: this.settings })); } catch { /* storage blocked */ }
  }

  // ---------- art ----------
  art(name, ...args) {
    if (this.realArt[name]) return `<img src="${esc(this.realArt[name])}" alt="" draggable="false">`;
    const A = this.A;
    const map = {
      'robot-wave': () => A.robot('wave'), 'robot-thumbs': () => A.robot('thumbs'), 'robot-cheer': () => A.robot('cheer'),
      rhino: () => A.rhino(), leopard: () => A.leopard(), car: () => A.car(), crayon: () => A.crayon(),
      brick: () => A.brick(...args), 'star-block': () => A.starBlock(...args), teddy: () => A.teddy(...args),
      book: () => A.book(...args), shirt: () => A.shirt(...args),
    };
    const a = map[name] ? map[name]() : null;
    if (!a) return '';
    return `<svg viewBox="${a.vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${a.body}</svg>`;
  }
  toyArt(kind, color, extra) {
    const name = kind === 'star' ? 'star-block' : kind;
    // real art for a toy is one file per toy kind (colours vary only in the drawn stand-ins)
    return this.art(name, color, extra == null ? undefined : extra);
  }
  binArt(k, part) {
    const real = this.realArt[`bin-${k}`];
    if (real) return part === 'fr' ? `<img src="${esc(real)}" alt="" draggable="false" style="width:100%;height:100%">` : '';
    const a = part === 'fr' ? this.A.binFront(k) : this.A.binBack(k);
    return `<svg viewBox="${a.vb}" aria-hidden="true" style="width:100%;height:100%">${a.body}</svg>`;
  }
  logo() {
    return `<div class="logo">${this.realArt.logo ? `<img src="${esc(this.realArt.logo)}" alt="Tots Mots">` : `${I.note('#3FD6F2', 24)}Tots Mots`}</div>`;
  }

  // ---------- sound (a soft chime, made on the fly: no files) ----------
  ctxOn() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; } }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  tone(freq, at, len, vol = 0.12, type = 'sine') {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + len);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + len + 0.05);
  }
  chime() {
    if (!this.settings.sound || !this.ctx) return;
    this.tone(1318.5, 0, 0.5); this.tone(1975.5, 0.07, 0.6, 0.08);
  }
  fanfare() {
    if (!this.settings.sound || !this.ctx) return;
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => this.tone(f, i * 0.12, 0.5, 0.1, 'triangle'));
  }

  // ---------- site music player + media ----------
  emitAudio(playing) {
    this.dispatchEvent(new CustomEvent('game-audio', { detail: { playing }, bubbles: true, composed: true }));
    if (playing) {
      window.dispatchEvent(new CustomEvent('tm-media-play', { detail: { el: this.audio } }));
      this.hushPage();
    }
  }
  // One sound at a time: pause any other audio or video on the page, including inside other custom elements.
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
  songPlay(from = 0) {
    if (!this.audio || this.noMusic) return;
    clearInterval(this.fadeT);
    this.selfPause = false;
    try { this.audio.currentTime = from; } catch { /* not seekable yet */ }
    this.audio.volume = 1;
    this.audio.play().catch(() => { this.noMusic = true; });
  }
  songPause() {
    if (!this.audio) return;
    this.selfPause = true;
    this.audio.pause();
  }
  songStop(fade) {
    if (!this.audio) return;
    const a = this.audio;
    this.selfPause = true;
    clearInterval(this.fadeT);
    if (!fade || a.paused) { a.pause(); this.emitAudio(false); return; }
    this.fadeT = setInterval(() => {
      a.volume = Math.max(0, a.volume - 0.08);
      if (a.volume <= 0.01) { clearInterval(this.fadeT); a.pause(); a.volume = 1; this.emitAudio(false); }
    }, 90);
  }
  // Seconds into the song: the audio itself, or a plain clock when there is no music
  songTime(state) {
    if (this.audio && !this.noMusic) return this.audio.currentTime;
    return state.clock;
  }
  songEnded(state) {
    if (this.audio && !this.noMusic) return this.audio.ended || this.audio.currentTime >= this.song.duration - 0.05;
    return state.clock >= this.song.duration;
  }

  say(text) { this.live.textContent = ''; setTimeout(() => { this.live.textContent = text; }, 30); }

  // ---------- screens ----------
  backBtn(label) {
    const l = label || this.getAttribute('exit-label');
    return l ? `<button class="round" data-act="exit" style="left:24px;top:14px" aria-label="${esc(l)}">${I.back(34, '#0B2F57')}</button>` : '';
  }

  renderStart() {
    this.stopRound();
    this.stopClass();
    this.setRoom(0.6);
    const hasExit = !!this.getAttribute('exit-label');
    const mess = this.settings.mess;
    const s = this.song;
    this.screen.innerHTML = `
      ${this.backBtn()}
      <button class="small" data-act="classroom" style="left:${hasExit ? 112 : 24}px;top:22px">${I.screen(26, '#0B2F57')}Classroom timer</button>
      <button class="small hold" data-act="grownups" style="right:24px;top:22px" aria-label="Grown-ups: press and hold to open settings"><span class="fill"></span>${I.lock(22, '#0B2F57')}<span>Grown-ups</span></button>
      <span class="hint" hidden>Press and hold for grown-up settings</span>
      <div class="abs" style="left:0;top:18px;width:1280px;display:flex;justify-content:center;pointer-events:none">${this.logo().replace('class="logo"', 'class="logo" style="font-size:28px"')}</div>
      <h1 class="title" style="top:84px;font-size:124px"><span>Clean Up </span><span class="y">Crew</span></h1>
      <span class="abs" style="left:1000px;top:60px">${I.spark(40, '#FFD12E')}</span><span class="abs" style="left:240px;top:120px">${I.spark(28)}</span>
      <div class="abs" style="left:330px;top:226px;width:620px;height:62px;border-radius:999px;background:linear-gradient(180deg,#fff,#EEF8FC);display:flex;align-items:center;justify-content:center;gap:14px;font-size:30px;font-weight:700;box-shadow:0 6px 0 #B9DCEA,0 12px 22px rgba(11,47,87,.2)">${I.star(32)}Tidy up before the song ends!${I.star(32)}</div>
      <div class="abs" style="left:300px;top:306px;width:680px;height:222px;border-radius:40px;border:9px solid #fff;overflow:hidden;box-shadow:0 16px 30px rgba(11,47,87,.28);background:linear-gradient(180deg,#A5E3F8 0%,#7FD3F2 58%,#F1C892 58%,#DDA06A 100%)">
        <div class="abs" style="left:150px;top:130px;width:420px;height:90px;border-radius:50%;background:#F6E8D4"></div>
        <div class="abs" style="left:14px;top:22px;width:130px;height:158px;filter:drop-shadow(0 10px 10px rgba(11,47,87,.25))">${this.art('robot-wave')}</div>
        ${['blocks', 'stuffies', 'books'].map((k, i) => `<div class="abs" style="left:${200 + i * 135}px;top:24px;width:124px;height:99px;filter:drop-shadow(0 8px 8px rgba(11,47,87,.25))">${this.binArt(k, 'fr')}</div>`).join('')}
        <div class="abs" style="left:222px;top:136px;width:84px;height:57px;filter:drop-shadow(0 8px 8px rgba(11,47,87,.25))">${this.art('car')}</div>
        <div class="abs" style="left:352px;top:142px;width:64px;height:51px;transform:rotate(-8deg);filter:drop-shadow(0 8px 8px rgba(11,47,87,.25))">${this.toyArt('brick', '#1EB7D8')}</div>
        <div class="abs" style="left:468px;top:138px;width:80px;height:65px;transform:rotate(-6deg);filter:drop-shadow(0 8px 8px rgba(11,47,87,.25))">${this.toyArt('book', '#1EB7D8')}</div>
      </div>
      <div class="abs" style="left:70px;top:566px;width:104px;height:83px;transform:rotate(-8deg);filter:drop-shadow(0 14px 12px rgba(11,47,87,.28))">${this.toyArt('brick', '#FFC21A')}</div>
      <div class="abs" style="left:1010px;top:650px;width:150px;height:40px;transform:rotate(-14deg);filter:drop-shadow(0 8px 8px rgba(11,47,87,.25))">${this.art('crayon')}</div>
      <div class="abs" style="left:0;top:508px;width:1280px;display:flex;justify-content:center;pointer-events:none"><div style="display:flex;align-items:center;gap:10px;background:#fff;border-radius:999px;padding:8px 20px 8px 10px;font-size:20px;font-weight:600;box-shadow:0 5px 0 #B9DCEA"><span style="width:34px;height:34px;border-radius:50%;background:#3FD6F2;display:grid;place-items:center">${I.note('#0B2F57', 22)}</span>${esc(s.title)} <span style="color:#456A8A">· ${fmt(s.duration)}</span></div></div>
      <button class="btn yellow" data-act="play" style="left:210px;top:582px;width:410px;height:112px;font-size:64px" ${this.ready ? '' : 'disabled'}>${this.ready ? `${I.play(52)}<span>Play</span>` : '<span class="spin"></span><span style="font-size:40px">Loading…</span>'}</button>
      <button class="btn navy" data-act="level" style="left:660px;top:582px;width:410px;height:112px;font-size:44px" aria-label="Choose level. Now: ${mess === 'big' ? 'Big mess, 16 toys' : 'Little mess, 10 toys'}">${I.layers(44, '#fff')}<span style="text-align:left">Choose Level<span class="sub">${mess === 'big' ? 'Big mess · 16 toys' : 'Little mess · 10 toys'}</span></span></button>`;
    this.bindHold();
  }

  // Grown-ups: press and hold (keyboard: Enter / Space opens at once), so a quick tap from a child doesn't open it
  bindHold() {
    const b = this.shadow.querySelector('.hold');
    const hint = this.shadow.querySelector('.hint');
    if (!b) return;
    let t = 0;
    let ht = 0;
    let opened = false;
    const stop = () => { clearTimeout(t); b.classList.remove('holding'); };
    b.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.stopPropagation();
      opened = false;
      try { b.setPointerCapture(e.pointerId); } catch { /* old browser */ }
      b.classList.add('holding');
      t = setTimeout(() => { opened = true; stop(); this.openGrownups(); }, 1200);
    });
    b.addEventListener('pointerup', () => {
      const early = b.classList.contains('holding');
      stop();
      if (early && !opened) { hint.hidden = false; clearTimeout(ht); ht = setTimeout(() => { hint.hidden = true; }, 2500); }
    });
    ['pointercancel', 'lostpointercapture'].forEach((n) => b.addEventListener(n, stop));
  }

  openLevel() {
    const opt = (k, n, name, toys) => `<button class="opt" data-act="mess" data-mess="${k}" aria-pressed="${this.settings.mess === k}">
      <span class="tick">${I.check(40)}</span>
      <span class="minis">${toys.map(([t, c, x]) => this.toyArt(t, c, x)).join('')}</span>
      <span>${name}</span><small>${n} toys</small></button>`;
    this.overlay(`<div class="panel" role="dialog" aria-label="Choose level"><h2>Choose Level</h2>
      <div class="row">${opt('little', 10, 'Little mess', [['teddy', '#C98A4B'], ['book', '#F0558C', 'heart']])}
      ${opt('big', 16, 'Big mess', [['teddy', '#C98A4B'], ['book', '#F0558C', 'heart'], ['shirt', '#1EB7D8'], ['brick', '#E8383D']])}</div></div>`, true);
  }

  openGrownups() {
    const s = this.settings;
    const cap = this.save.captain;
    const st = this.save.streak?.count || 0;
    this.overlay(`<div class="panel" role="dialog" aria-label="Grown-ups settings" style="width:820px;padding-bottom:30px"><h2>Grown-ups</h2>
      <div class="set"><span>Toy counts on the bins<small>The "1 / 4" chips are for grown-ups. Bins use pictures only.</small></span>
        <button class="switch" role="switch" data-act="set-counts" aria-checked="${s.counts}" aria-label="Show toy counts on the bins"></button></div>
      <div class="set"><span>Sounds<small>The chime and cheers. The song always plays.</small></span>
        <button class="switch" role="switch" data-act="set-sound" aria-checked="${s.sound}" aria-label="Sounds"></button></div>
      <div class="set"><span>Mess size</span><span class="seg">
        <button data-act="mess-set" data-mess="little" aria-pressed="${s.mess === 'little'}">Little · 10</button>
        <button data-act="mess-set" data-mess="big" aria-pressed="${s.mess === 'big'}">Big · 16</button></span></div>
      <div class="set"><span>Badge: Clean Up Crew Captain<small>${cap ? `Earned ${esc(cap)}` : 'Not yet: sort every toy before the song ends.'}</small></span>
        <span style="text-align:right">Class streak: ${st} ${st === 1 ? 'day' : 'days'}<small>Saved on this device</small></span></div>
      <div class="row" style="margin-top:24px;align-items:center">
        <button class="linkbtn" data-act="reset">Reset badge and streak</button>
        <button class="btn yellow" data-act="close" style="width:220px;height:84px;font-size:36px">Done</button></div></div>`, true);
  }

  overlay(html, closeOnVeil) {
    this.closeOverlay();
    const v = document.createElement('div');
    v.className = 'veil';
    if (closeOnVeil) v.dataset.veil = '1';
    v.innerHTML = html;
    this.stage.appendChild(v);
    this.ov = v;
    this.ovReturn = this.shadow.activeElement;
    setTimeout(() => v.querySelector('button')?.focus({ preventScroll: true }), 30);
  }
  closeOverlay() {
    if (!this.ov) return;
    this.ov.remove();
    this.ov = null;
    if (this.ovReturn?.isConnected) this.ovReturn.focus({ preventScroll: true });
  }

  // ---------- room transform ----------
  setRoom(c) {
    const room = this.stage.querySelector('.room');
    const dim = this.stage.querySelector('.dim');
    room.style.filter = c >= 1 ? '' : `saturate(${(0.8 + 0.2 * c).toFixed(3)}) brightness(${(0.95 + 0.05 * c).toFixed(3)})`;
    dim.style.opacity = String(1 - c);
    const on = Math.round(c * SPARKLE_SPOTS.length);
    this.stage.querySelectorAll('.spk').forEach((s, i) => s.classList.toggle('on', i < on));
  }

  // ---------- play ----------
  startRound() {
    if (!this.ready) return;
    this.ctxOn();
    this.closeOverlay();
    this.stopRound();
    const list = shuffle(MESS[this.settings.mess]);
    const slots = shuffle(SLOTS);
    const items = list.map(([kind, color, extra], i) => {
      const t = TOYS[kind];
      const [sx, sy] = slots[i];
      return { id: i, kind, color, extra, bin: t.bin, w: t.w, h: t.h, label: t.label,
        x: sx + rand(-12, 12), y: sy + rand(-8, 8), rot: rand(-20, 20), done: false, busy: false };
    });
    const totals = {};
    for (const b of BINS) totals[b.k] = items.filter((i) => i.bin === b.k).length;
    this.g = { items, totals, counts: Object.fromEntries(BINS.map((b) => [b.k, 0])), sorted: 0, total: items.length,
      streak: 0, cheers: 0, paused: false, over: false, clock: 0, picked: null, startedAt: performance.now() };
    this.renderPlay();
    this.setRoom(0);
    if (this.noMusic) this.g.clock = 0;
    this.songPlay(0);
    if (this.noMusic) this.emitAudio(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
    this.say(`Clean up time! Put each toy in its bin before the song ends. ${items.length} toys.`);
  }

  renderPlay() {
    const g = this.g;
    this.screen.innerHTML = `
      <div class="robot" aria-hidden="true">${this.art('robot-wave')}</div>
      <div class="bubble" aria-hidden="true"><b></b><small></small></div>
      <div class="bins ${this.settings.counts ? '' : 'nocounts'}">${BINS.map((b) => `
        <button class="bin" data-bin="${b.k}" style="left:${b.x}px" aria-label="${b.name} bin">
          <div class="glow"></div><div class="bk">${this.binArt(b.k, 'bk')}</div><div class="peek"></div><div class="fr">${this.binArt(b.k, 'fr')}</div>
          <div class="count" aria-hidden="true">0 / ${g.totals[b.k]}</div></button>`).join('')}</div>
      <div class="toys">${g.items.map((it) => `<button class="toy" data-toy="${it.id}" aria-label="${esc(it.label)}"
        style="width:${it.w}px;height:${it.h}px">${this.toyArt(it.kind, it.color, it.extra)}</button>`).join('')}</div>
      <svg class="fx" width="1280" height="720" viewBox="0 0 1280 720" aria-hidden="true"></svg>
      <div class="abs" style="left:24px;top:24px">${this.logo()}</div>
      <div class="timer" role="timer" aria-label="Time left in the song">${I.clock(50, '#3FD6F2')}<div><div class="t">${fmt(this.song.duration)}</div><div class="bar"><i></i></div></div></div>
      <div class="score" aria-label="Toys put away">${I.star(44)}<span class="sc">0 / ${g.total}</span></div>
      <button class="round" data-act="pause" style="right:24px;top:114px" aria-label="Pause">${I.pause(28)}</button>`;
    this.fx = this.screen.querySelector('.fx');
    this.timerT = this.screen.querySelector('.timer .t');
    this.timerBar = this.screen.querySelector('.timer .bar i');
    this.scoreEl = this.screen.querySelector('.score');
    this.robotEl = this.screen.querySelector('.robot');
    this.bubbleEl = this.screen.querySelector('.bubble');
    this.binEls = Object.fromEntries(BINS.map((b) => [b.k, this.screen.querySelector(`.bin[data-bin="${b.k}"]`)]));
    for (const it of g.items) {
      it.el = this.screen.querySelector(`.toy[data-toy="${it.id}"]`);
      this.place(it, it.x, it.y, it.rot, 1);
    }
    this.updateBins();
  }

  place(it, x, y, rot, s) {
    it.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${s})`;
  }

  updateBins() {
    const g = this.g;
    for (const b of BINS) {
      const el = this.binEls[b.k];
      el.querySelector('.count').textContent = `${g.counts[b.k]} / ${g.totals[b.k]}`;
      el.setAttribute('aria-label', `${b.name} bin, ${g.counts[b.k]} of ${g.totals[b.k]}`);
    }
    this.scoreEl.querySelector('.sc').textContent = `${g.sorted} / ${g.total}`;
  }

  tick(t) {
    const g = this.g;
    if (!g || g.over) return;
    const dt = Math.min(5, (t - this.last) / 1000);
    this.last = t;
    if (!g.paused) {
      g.clock += dt;
      if (this.audio && !this.noMusic && t - (this.lastHush || 0) > 1500) { this.lastHush = t; this.hushPage(); }
      const now = this.songTime(g);
      const left = this.song.duration - now;
      const txt = fmt(left);
      if (this.timerT.textContent !== txt) this.timerT.textContent = txt;
      this.timerBar.style.width = `${Math.min(100, (now / this.song.duration) * 100).toFixed(2)}%`;
      if (this.songEnded(g)) { this.finish('time'); return; }
    }
    this.raf = requestAnimationFrame((tt) => this.tick(tt));
  }

  pause() {
    const g = this.g;
    if (!g || g.over || g.paused) return;
    g.paused = true;
    this.cancelDrag();
    this.songPause();
    this.overlay(`<div class="panel" role="dialog" aria-label="Paused" style="width:640px"><h2>Paused</h2>
      <div style="display:flex;flex-direction:column;align-items:center;gap:30px">
        <button class="btn yellow" data-act="resume" style="width:420px;height:104px;font-size:52px">${I.play(44)}<span>Resume</span></button>
        <div class="row"><button class="btn cyan" data-act="restart" style="width:250px;height:88px;font-size:34px">${I.again(34, '#0B2F57')}<span>Restart</span></button>
        <button class="btn white" data-act="home" style="width:250px;height:88px;font-size:34px">${I.home(34, '#0B2F57')}<span>Home</span></button></div></div></div>`);
  }
  resume() {
    const g = this.g;
    if (!g || !g.paused) return;
    this.closeOverlay();
    g.paused = false;
    this.last = performance.now();
    if (this.audio && !this.noMusic) {
      this.selfPause = false;
      this.audio.play().catch(() => { this.noMusic = true; g.clock = this.audio.currentTime; });
    }
  }

  stopRound(keepAudio) {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.finishT);
    clearTimeout(this.cheerT);
    if (this.g) {
      this.g.over = true;
      for (const it of this.g.items) cancelAnimationFrame(it.flyRaf);
    }
    this.cancelDrag();
    this.g = null;
    if (!keepAudio && this.audio && !this.audio.paused) this.songStop(false);
  }

  // ---------- drag, tap-to-pick, keyboard ----------
  onDown(e) {
    const el = e.target.closest('.toy');
    const g = this.g;
    if (!el || !g || g.over || g.paused || this.drag) return;
    const it = g.items[Number(el.dataset.toy)];
    if (!it || it.done || it.busy) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = this.toStage(e);
    this.drag = { it, id: e.pointerId, sx: p.x, sy: p.y, ox: p.x - it.x, oy: p.y - it.y, moved: false, hover: null };
  }
  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const p = this.toStage(e);
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < 10) return;
    if (!d.moved) { d.moved = true; this.unpick(); d.it.el.classList.add('dragging'); d.it.el.classList.remove('returning'); }
    d.x = Math.max(-40, Math.min(STW - d.it.w + 40, p.x - d.ox));
    d.y = Math.max(-20, Math.min(STH - d.it.h + 20, p.y - d.oy));
    this.place(d.it, d.x, d.y, 0, 1.12);
    this.setHover(this.binAt(p.x, p.y));
  }
  onUp(e, cancelled) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    const it = d.it;
    it.el.classList.remove('dragging');
    const bin = d.hover;
    this.setHover(null);
    if (!d.moved) { if (!cancelled) this.togglePick(it); return; }
    this.lastDragEnd = performance.now();
    if (bin && !cancelled) this.drop(it, bin, d.x, d.y);
    else this.returnToy(it);
  }
  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.it.el.classList.remove('dragging');
    this.setHover(null);
    if (d.moved) this.returnToy(d.it);
  }
  binAt(x, y) {
    if (y < BIN_Y - 70) return null;
    const b = BINS.find((bb) => x >= bb.x - 10 && x <= bb.x + BIN_W + 10);
    return b ? b.k : null;
  }
  setHover(k) {
    if (this.drag) this.drag.hover = k;
    for (const b of BINS) this.binEls?.[b.k]?.classList.toggle('hover', b.k === k);
  }
  togglePick(it) {
    const g = this.g;
    if (g.picked === it) { this.unpick(); return; }
    this.unpick();
    g.picked = it;
    it.el.classList.add('picked');
    this.place(it, it.x, it.y - 14, 0, 1.12);
    for (const b of BINS) this.binEls[b.k].classList.add('ready');
    this.say(`${it.label} picked up. Now pick a bin.`);
  }
  unpick() {
    const g = this.g;
    if (!g?.picked) return;
    const it = g.picked;
    g.picked = null;
    it.el.classList.remove('picked');
    if (!it.done) this.place(it, it.x, it.y, it.rot, 1);
    for (const b of BINS) this.binEls[b.k].classList.remove('ready');
  }
  returnToy(it) {
    it.el.classList.add('returning');
    this.place(it, it.x, it.y, it.rot, 1);
    setTimeout(() => it.el?.classList.remove('returning'), 520);
  }

  drop(it, k, fromX, fromY) {
    const g = this.g;
    if (!g || g.over || it.done) return;
    const bin = this.binEls[k];
    if (it.bin !== k) {
      // wrong bin: a gentle bounce back and a little wiggle. No penalty.
      g.streak = 0;
      bin.classList.remove('wiggle');
      void bin.offsetWidth;
      bin.classList.add('wiggle');
      setTimeout(() => bin.classList.remove('wiggle'), 460);
      this.returnToy(it);
      this.say(`Hmm, not that bin. Try another one.`);
      return;
    }
    it.done = true;
    it.busy = true;
    it.el.disabled = true;
    it.el.setAttribute('aria-hidden', 'true');
    // lands once: at the end of the flight, or by this timer if animation frames stall (a right drop always counts)
    const backstop = setTimeout(() => { cancelAnimationFrame(it.flyRaf); done(); }, this.reduced ? 400 : 900);
    const done = () => {
      clearTimeout(backstop);
      if (it.landed) return;
      it.landed = true;
      this.land(it, k);
    };
    if (this.reduced) {
      it.el.classList.add('fade');
      setTimeout(done, 200);
      return;
    }
    // fly along a glowing arc into the bin
    const b = BINS.find((bb) => bb.k === k);
    const p0 = { x: fromX + it.w / 2, y: fromY + it.h / 2 };
    const p2 = { x: b.x + BIN_W / 2, y: BIN_Y + 10 };
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - 150 };
    const path = `M${p0.x.toFixed(0)} ${p0.y.toFixed(0)}Q${p1.x.toFixed(0)} ${p1.y.toFixed(0)} ${p2.x.toFixed(0)} ${p2.y.toFixed(0)}`;
    this.fx.insertAdjacentHTML('beforeend', `<path class="arc glo" pathLength="1" d="${path}"/><path class="arc core" pathLength="1" d="${path}"/>`);
    const arcs = [...this.fx.querySelectorAll('path')].slice(-2);
    setTimeout(() => arcs.forEach((a) => a.remove()), 1000);
    it.el.classList.add('flying');
    const t0 = performance.now();
    const DUR = 560;
    let lastSp = 0;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DUR);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const u = 1 - e;
      const x = u * u * p0.x + 2 * u * e * p1.x + e * e * p2.x;
      const y = u * u * p0.y + 2 * u * e * p1.y + e * e * p2.y;
      const s = 1 - 0.5 * e;
      this.place(it, x - it.w / 2, y - it.h / 2, 360 * e * (it.rot > 0 ? 1 : -1) * 0.25, s);
      if (now - lastSp > 45) { lastSp = now; this.sparkle(x, y, 1); }
      if (t < 1) it.flyRaf = requestAnimationFrame(step);
      else done();
    };
    it.flyRaf = requestAnimationFrame(step);
  }

  sparkle(x, y, n) {
    const colors = ['#FFFFFF', '#FFD12E', '#BFF4FF'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'sp';
      s.style.left = `${x + rand(-14, 14)}px`;
      s.style.top = `${y + rand(-14, 14)}px`;
      s.style.setProperty('--dx', `${rand(-40, 40).toFixed(0)}px`);
      s.style.setProperty('--dy', `${rand(-40, 30).toFixed(0)}px`);
      s.innerHTML = I.spark(24, colors[Math.floor(Math.random() * colors.length)]);
      this.screen.appendChild(s);
      setTimeout(() => s.remove(), 720);
    }
  }

  land(it, k) {
    const g = this.g;
    if (!g || g.over) return;
    it.el.remove();
    g.counts[k]++;
    g.sorted++;
    g.streak++;
    const bin = this.binEls[k];
    // the toy peeks out over the rim
    const slot = PEEK[(g.counts[k] - 1) % PEEK.length];
    const peek = bin.querySelector('.peek');
    const pw = it.w * 0.78;
    const ph = it.h * 0.78;
    peek.insertAdjacentHTML('beforeend', `<div class="in" style="left:${slot[0] - (pw - 90) / 2}px;top:${slot[1]}px;width:${pw}px;height:${ph}px;transform:rotate(${slot[2]}deg)">${this.toyArt(it.kind, it.color, it.extra)}</div>`);
    bin.classList.remove('pop');
    void bin.offsetWidth;
    bin.classList.add('pop');
    if (!this.reduced) this.sparkle(BINS.find((b) => b.k === k).x + BIN_W / 2, BIN_Y + 10, 6);
    this.chime();
    this.updateBins();
    this.scoreEl.classList.remove('bump');
    void this.scoreEl.offsetWidth;
    this.scoreEl.classList.add('bump');
    this.setRoom(g.sorted / g.total);
    this.say(`${it.label} in the ${BINS.find((b) => b.k === k).name} bin. ${g.sorted} of ${g.total}.`);
    if (g.streak > 0 && g.streak % 3 === 0) this.cheer(g.streak);
    if (g.sorted >= g.total) this.finishT = setTimeout(() => this.finish('all'), 900);
  }

  cheer(n) {
    const msg = CHEERS[this.g.cheers++ % CHEERS.length];
    this.robotEl.innerHTML = this.art(this.g.cheers % 2 ? 'robot-thumbs' : 'robot-cheer');
    this.robotEl.classList.remove('cheer');
    void this.robotEl.offsetWidth;
    this.robotEl.classList.add('cheer');
    this.bubbleEl.querySelector('b').textContent = msg;
    this.bubbleEl.querySelector('small').textContent = `${n} in a row`;
    this.bubbleEl.classList.add('on');
    if (this.settings.sound && this.ctx) { this.tone(784, 0, 0.25, 0.07, 'triangle'); this.tone(1046.5, 0.1, 0.35, 0.07, 'triangle'); }
    this.say(msg);
    clearTimeout(this.cheerT);
    this.cheerT = setTimeout(() => {
      this.bubbleEl?.classList.remove('on');
      if (this.robotEl) this.robotEl.innerHTML = this.art('robot-wave');
    }, 1900);
  }

  // ---------- finish ----------
  finish(reason) {
    const g = this.g;
    if (!g || g.over) return;
    const now = this.songTime(g);
    const left = reason === 'all' ? Math.max(0, this.song.duration - now) : 0;
    const sorted = g.items.filter((i) => i.done).length;
    const total = g.total;
    const stars = sorted >= total ? 3 : sorted / total >= 0.75 ? 2 : 1;
    let newBadge = false;
    if (stars === 3 && !this.save.captain) {
      this.save.captain = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      newBadge = true;
    }
    this.save.rounds = (this.save.rounds || 0) + 1;
    this.save.best = Math.max(this.save.best || 0, stars);
    this.persist();
    const played = now;
    if (this.noMusic) this.emitAudio(false);
    else this.songStop(true); // fade the song out under the celebration
    this.stopRound(true);
    this.dispatchEvent(new CustomEvent('game-finish', { bubbles: true, composed: true,
      detail: { mode: 'solo', sorted, total, stars, secondsLeft: Math.round(left), badge: newBadge, songSeconds: Math.round(played) } }));
    this.renderFinish({ mode: 'solo', sorted, total, stars, left, newBadge });
  }

  renderFinish(r) {
    this.setRoom(r.mode === 'class' || r.sorted >= r.total ? 1 : r.sorted / r.total);
    const all = r.mode === 'class' ? r.beat : r.sorted >= r.total;
    const head = all ? 'We Got This!' : "Song's over!";
    const ribbon = r.mode === 'class' ? (r.beat ? 'Clean Up Complete!' : 'Room all clean!') : all ? 'Clean Up Complete!' : 'Great cleaning!';
    const frac = Math.max(0, Math.min(1, r.left / this.song.duration));
    const pills = r.mode === 'class'
      ? [`${I.check(34)}Room clean!`, r.beat ? `${I.star(32)}Beat the song!` : `${I.spark(30, '#FFD12E')}Great teamwork!`]
      : [`${I.star(32)}${r.sorted} / ${r.total} toys`, ...(all ? [`${I.check(34)}All sorted`] : []), `${I.spark(30, '#FFD12E')}Clean room!`];
    const st = this.save.streak?.count || 0;
    const corner = r.mode === 'class'
      ? `<div class="chipbadge" style="padding:10px 22px 10px 10px">${I.star(34)}<span style="font-size:22px;font-weight:600">Beat the song ${st} ${st === 1 ? 'day' : 'days'} in a row</span></div>`
      : r.newBadge ? `<div class="chipbadge"><span class="medal">${I.star(24, '#fff', 'none')}</span><span style="line-height:1.05"><span style="font-size:14px;color:#456A8A">New badge</span><br><span style="font-size:18px;font-weight:700">Clean Up Crew Captain</span></span></div>` : '';
    const starSpots = [[470, 10, 96], [568, -8, 130], [698, 10, 96]];
    const binsTidy = BINS.map((b, i) => `<div class="abs" style="left:${12 + i * 90}px;top:66px;width:84px;height:68px;filter:drop-shadow(0 6px 6px rgba(11,47,87,.25))">${this.binArt(b.k, 'fr')}</div>`).join('');
    this.screen.innerHTML = `
      <div class="confetti-layer"></div>
      <div class="friend ${this.reduced ? '' : 'dance'}" style="left:-10px;top:250px;width:310px;height:440px" aria-hidden="true">${this.art('rhino')}</div>
      <div class="friend ${this.reduced ? '' : 'dance'}" style="left:960px;top:250px;width:310px;height:440px;animation-delay:.8s" aria-hidden="true">${this.art('leopard')}</div>
      ${starSpots.map(([x, y, s], i) => `<span class="bstar ${i < r.stars ? 'in' : ''}" style="left:${x}px;top:${y}px;animation-delay:${0.15 + i * 0.25}s">${i < r.stars ? I.star(s) : I.star(s, '#D5E6EE', '#B4CDD9')}</span>`).join('')}
      <span class="sr">${r.stars} ${r.stars === 1 ? 'star' : 'stars'}</span>
      <h1 class="title" style="top:106px;font-size:104px">${head}</h1>
      <div class="fpanel">
        <div class="ring" style="left:34px;top:46px;width:196px;height:196px;background:conic-gradient(#FFD12E 0 ${(frac * 100).toFixed(1)}%, #2CCBEA ${(frac * 100).toFixed(1)}% 100%)">
          <div style="left:16px;top:16px;width:164px;height:164px"><div style="font-size:54px;font-weight:700;line-height:1">${fmt(r.left)}</div><div style="font-size:17px;color:#BFEFF8;margin-top:4px;line-height:1.15">left in<br>the song</div></div></div>
        <div class="mini" style="left:258px;top:46px;width:384px;height:196px">${binsTidy}</div>
        <div class="abs" style="left:0;top:254px;width:676px;display:flex;justify-content:center;gap:12px">${pills.map((p) => `<div class="pill">${p}</div>`).join('')}</div>
      </div>
      <div class="abs" style="left:0;top:222px;width:1280px;display:flex;justify-content:center"><div class="ribbon">${ribbon} ${all ? I.check(34) : I.star(32)}</div></div>
      ${corner}
      <div class="abs" style="left:24px;top:24px">${this.logo()}</div>
      <button class="btn cyan" data-act="${r.mode === 'class' ? 'classroom' : 'again'}" style="left:120px;top:600px;width:330px;height:96px;font-size:38px">${I.again(40, '#0B2F57')}<span>Play Again</span></button>
      <button class="btn pink" data-act="exit" style="left:470px;top:600px;width:370px;height:96px;font-size:32px">${I.list(38, '#fff')}<span>Choose a New Game</span></button>
      <button class="btn yellow" data-act="home" style="left:860px;top:600px;width:300px;height:96px;font-size:38px">${I.home(40, '#0B2F57')}<span>Home</span></button>`;
    this.fanfare();
    if (!this.reduced) this.confetti();
    this.say(`${head} ${r.mode === 'class' ? '' : `${r.sorted} of ${r.total} toys. `}${r.stars} stars.${r.newBadge ? ' New badge: Clean Up Crew Captain.' : ''}`);
    setTimeout(() => this.screen.querySelector('[data-act="again"],[data-act="classroom"]')?.focus({ preventScroll: true }), 60);
  }

  confetti() {
    const layer = this.screen.querySelector('.confetti-layer');
    if (!layer) return;
    const colors = ['#FFD12E', '#F0558C', '#2CCBEA', '#6CC644', '#FFFFFF'];
    let html = '';
    for (let i = 0; i < 70; i++) {
      html += `<span class="confetti" style="left:${rand(0, 1280).toFixed(0)}px;background:${colors[i % colors.length]};--dx:${rand(-120, 120).toFixed(0)}px;--r:${rand(-720, 720).toFixed(0)}deg;animation-duration:${rand(2.4, 4.2).toFixed(2)}s;animation-delay:${rand(0, 1.2).toFixed(2)}s"></span>`;
    }
    layer.innerHTML = html;
    setTimeout(() => { if (layer.isConnected) layer.innerHTML = ''; }, 5600);
  }

  // ---------- classroom timer ----------
  renderClassroom() {
    this.stopRound();
    this.stopClass();
    this.closeOverlay();
    this.setRoom(0);
    this.cls = { running: false, started: false, ended: false, clock: 0 };
    const st = this.save.streak?.count || 0;
    const streakTxt = st ? `Beat the song ${st} ${st === 1 ? 'day' : 'days'} in a row` : 'Beat the song to start a class streak';
    // the room panel tidies itself as the song plays: 8 toys, 2 per bin
    const toys = [['teddy', '#C98A4B', null, 20, 40, -8], ['brick', '#E8383D', null, 170, 120, 12], ['book', '#F0558C', 'heart', 300, 60, -12],
      ['shirt', '#1EB7D8', null, 440, 100, 6], ['star', '#2CCBEA', null, 120, 30, 10], ['teddy', '#F08DB0', null, 520, 30, -6],
      ['book', '#1EB7D8', 'star', 240, 140, 8], ['shirt', '#F0558C', null, 380, 20, -10]];
    const binX = { blocks: 60, stuffies: 188, books: 316, clothes: 444 };
    const used = { blocks: 0, stuffies: 0, books: 0, clothes: 0 };
    this.clsToys = toys.map(([kind, c, x, lx, ly, r], i) => {
      const t = TOYS[kind];
      const w = t.w * 0.6;
      const h = t.h * 0.6;
      const n = used[t.bin]++;
      return { i, kind, c, x, w, h, from: [lx, ly, r], to: [binX[t.bin] + 14 + n * 40 - (w - 50) / 2, 150, n ? 8 : -8], at: 0.08 + (i * 0.77) / toys.length };
    });
    this.screen.innerHTML = `
      <div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(11,47,87,.15),rgba(11,47,87,.35))"></div>
      ${this.backBtn('Back to Clean Up Crew')}
      <div class="abs" style="left:112px;top:20px;display:flex;align-items:center;gap:14px;background:linear-gradient(180deg,#164A7A,#0B2F57);border:5px solid #2CCBEA;color:#fff;border-radius:999px;padding:8px 28px 10px 12px;box-shadow:0 6px 0 #07203D">
        <span style="width:50px;height:50px;border-radius:50%;background:#3FD6F2;display:grid;place-items:center">${I.note('#0B2F57', 28)}</span>
        <span style="line-height:1.05"><span style="font-size:28px;font-weight:700">${esc(this.song.title)}</span><br><span style="font-size:18px;color:#BFEFF8">Clean up the room before the song ends!</span></span></div>
      <div class="abs" style="right:24px;top:30px;display:flex;align-items:center;gap:10px;background:#fff;border-radius:999px;padding:10px 22px 10px 12px;font-size:22px;font-weight:600;box-shadow:0 5px 0 #B9DCEA">${I.star(34)}<span class="streak">${streakTxt}</span></div>
      <div class="cring"><div><div class="ct" style="font-size:150px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums">${fmt(this.song.duration)}</div><div style="font-size:30px;color:#BFEFF8;margin-top:6px">left in the song</div></div></div>
      <div class="mini" style="left:600px;top:136px;width:620px;height:320px;border-width:9px;border-radius:34px;box-shadow:0 20px 36px rgba(11,47,87,.35);background:linear-gradient(180deg,#A5E3F8 0%,#7FD3F2 58%,#F1C892 58%,#DDA06A 100%)">
        <div style="left:120px;top:200px;width:420px;height:110px;border-radius:50%;background:#F6E8D4"></div>
        <div style="left:540px;top:170px;width:60px;height:40px;transform:rotate(-12deg)">${this.art('crayon')}</div>
        <div style="left:500px;top:226px;width:84px;height:57px">${this.art('car')}</div>
        ${BINS.map((b) => `<div style="left:${binX[b.k]}px;top:186px;width:120px;height:96px;z-index:2;filter:drop-shadow(0 8px 8px rgba(11,47,87,.25))">${this.binArt(b.k, 'fr')}</div>`).join('')}
        ${this.clsToys.map((t) => `<div class="mt" data-mt="${t.i}" style="left:0;top:0;width:${t.w}px;height:${t.h}px;z-index:1;filter:drop-shadow(0 8px 8px rgba(11,47,87,.25));transform:translate(${t.from[0]}px,${t.from[1]}px) rotate(${t.from[2]}deg)">${this.toyArt(t.kind, t.c, t.x)}</div>`).join('')}
        <div class="cdim" style="inset:0;background:rgba(70,80,105,.24);z-index:3;transition:opacity .6s;pointer-events:none"></div>
        <div style="right:14px;top:14px;background:#fff;border-radius:999px;padding:6px 16px;font-size:18px;font-weight:600;z-index:4">Room tidies up with the song</div>
      </div>
      <div class="abs" style="left:600px;top:476px;width:620px;height:92px;border-radius:28px;background:#fff;padding:14px 26px;box-shadow:0 6px 0 #B9DCEA">
        <div style="display:flex;justify-content:space-between;font-size:24px;font-weight:700"><span>Our room</span><span class="cmsg" style="color:#456A8A;font-weight:600">Clean by the last chorus</span></div>
        <div style="height:20px;border-radius:10px;background:#DDF1F8;margin-top:8px;overflow:hidden"><div class="cbar" style="width:0;height:20px;border-radius:10px;background:linear-gradient(90deg,#FFD12E,#FFB800)"></div></div></div>
      <button class="btn white" data-act="cl-toggle" style="left:230px;top:606px;width:220px;height:84px;font-size:30px" ${this.ready ? '' : 'disabled'}>${I.play(30)}<span>Start</span></button>
      <button class="btn navy" data-act="cl-again" style="left:474px;top:606px;width:330px;height:84px;font-size:30px">${I.again(32, '#fff')}<span style="text-align:left;line-height:1">Play it again<br><span style="font-size:15px;font-weight:600;opacity:.85">+${fmt(this.song.duration)}</span></span></button>
      <button class="btn yellow" data-act="cl-done" style="left:828px;top:606px;width:330px;height:84px;font-size:32px">${I.check(34)}<span>Everyone's done!</span></button>
      <button class="round" data-act="full" style="right:24px;top:606px;width:84px;height:84px" aria-label="Full screen">${I.full(34, '#0B2F57')}</button>`;
    this.cRing = this.screen.querySelector('.cring');
    this.cT = this.screen.querySelector('.ct');
    this.cBar = this.screen.querySelector('.cbar');
    this.cDim = this.screen.querySelector('.cdim');
    this.classDraw(0);
  }

  classDraw(now) {
    const d = this.song.duration;
    const p = Math.min(1, now / d);
    const left = Math.max(0, d - now);
    this.cRing.style.background = `conic-gradient(#FFD12E 0 ${((left / d) * 100).toFixed(2)}%, rgba(255,255,255,.45) ${((left / d) * 100).toFixed(2)}% 100%)`;
    const txt = fmt(left);
    if (this.cT.textContent !== txt) this.cT.textContent = txt;
    const room = Math.min(1, p / 0.85);
    this.cBar.style.width = `${(room * 100).toFixed(1)}%`;
    this.cDim.style.opacity = String(1 - room);
    for (const t of this.clsToys) {
      const inBin = p >= t.at;
      if (t.inBin === inBin) continue;
      t.inBin = inBin;
      const [x, y, r] = inBin ? t.to : t.from;
      const el = this.screen.querySelector(`[data-mt="${t.i}"]`);
      if (el) el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`;
    }
    this.setRoom(room);
  }

  classTick(t) {
    const c = this.cls;
    if (!c || !c.running) return;
    const dt = Math.min(5, (t - this.last) / 1000);
    this.last = t;
    c.clock += dt;
    if (this.audio && !this.noMusic && t - (this.lastHush || 0) > 1500) { this.lastHush = t; this.hushPage(); }
    const now = this.songTime(c);
    this.classDraw(now);
    if (this.songEnded(c)) {
      c.running = false;
      c.ended = true;
      this.classDraw(this.song.duration);
      this.wake(false);
      if (this.noMusic) this.emitAudio(false);
      this.setToggle('Start');
      this.screen.querySelector('.cmsg').textContent = "Song's over! Tap Everyone's done";
      this.say("The song is over. Tap Everyone's done when the room is clean, or play it again.");
      return;
    }
    this.raf = requestAnimationFrame((tt) => this.classTick(tt));
  }

  setToggle(state) {
    const b = this.screen.querySelector('[data-act="cl-toggle"]');
    if (!b) return;
    b.innerHTML = state === 'Pause' ? `${I.pause(30)}<span>Pause</span>` : `${I.play(30)}<span>${state}</span>`;
  }

  classStart(fromStart) {
    if (!this.ready) return;
    this.ctxOn();
    const c = this.cls;
    if (fromStart || c.ended) {
      c.clock = 0;
      c.ended = false;
      for (const t of this.clsToys) t.inBin = undefined;
      this.screen.querySelector('.cmsg').textContent = 'Clean by the last chorus';
      this.songPlay(0);
    } else if (this.audio && !this.noMusic) {
      this.selfPause = false;
      this.audio.play().catch(() => { this.noMusic = true; });
    }
    if (this.noMusic) this.emitAudio(true);
    c.running = true;
    c.started = true;
    this.setToggle('Pause');
    this.wake(true);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.classTick(t));
  }
  classPause() {
    const c = this.cls;
    if (!c || !c.running) return;
    c.running = false;
    cancelAnimationFrame(this.raf);
    this.songPause();
    this.wake(false);
    this.setToggle('Resume');
  }
  classDone() {
    const c = this.cls;
    if (!c) return;
    const now = c.started ? this.songTime(c) : 0;
    const beat = c.started && !c.ended && now < this.song.duration;
    const left = beat ? Math.max(0, this.song.duration - now) : 0;
    if (beat) {
      const today = dayKey(new Date());
      const s = this.save.streak || { count: 0, last: null };
      if (s.last !== today) s.count = s.last === prevSchoolDay(new Date()) ? s.count + 1 : 1;
      s.last = today;
      this.save.streak = s;
      this.persist();
    }
    this.stopClass();
    this.ctxOn();
    this.dispatchEvent(new CustomEvent('game-finish', { bubbles: true, composed: true,
      detail: { mode: 'class', beat, secondsLeft: Math.round(left), streak: this.save.streak?.count || 0, songSeconds: Math.round(now) } }));
    this.renderFinish({ mode: 'class', beat, stars: beat ? 3 : 2, left, sorted: 1, total: 1 });
  }
  stopClass() {
    const c = this.cls;
    if (!c) return;
    cancelAnimationFrame(this.raf);
    this.cls = null;
    this.wake(false);
    if (this.audio && !this.audio.paused) this.songStop(true);
    else if (this.noMusic && c.running) this.emitAudio(false);
  }
  // keep a classroom screen awake while the timer runs
  async wake(on) {
    try {
      if (on && 'wakeLock' in navigator && !this.lock && document.visibilityState === 'visible') {
        this.lock = await navigator.wakeLock.request('screen');
        this.lock.addEventListener('release', () => { this.lock = null; });
      } else if (!on && this.lock) { await this.lock.release(); this.lock = null; }
    } catch { /* not allowed here */ }
  }
  toggleFull() {
    const d = document;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
      const p = (this.requestFullscreen || this.webkitRequestFullscreen)?.call(this);
      if (p && p.catch) p.catch(() => {});
    } catch { /* full screen not allowed here */ }
  }

  // ---------- leaving ----------
  leave(kind) {
    this.stopRound();
    this.stopClass();
    if (this.getAttribute('exit-label')) {
      // Kids mode answers "game-home" (closes the games layer); a host that doesn't gets "game-exit" (back to the grid)
      if (kind === 'home') {
        const ev = new CustomEvent('game-home', { bubbles: true, composed: true, cancelable: true });
        this.dispatchEvent(ev);
        if (ev.defaultPrevented) return;
      }
      this.dispatchEvent(new CustomEvent('game-exit', { bubbles: true, composed: true }));
      return;
    }
    const url = this.getAttribute('home-url') || '/kids';
    try { (window.top || window).location.href = new URL(url, location.href).href; } catch { location.href = url; }
  }

  // ---------- clicks (mouse, touch and keyboard) ----------
  onClick(e) {
    const veil = e.target.closest('.veil');
    if (veil && e.target === veil && veil.dataset.veil) { this.closeOverlay(); return; }
    const toy = e.target.closest('.toy');
    if (toy) {
      // pointer taps are handled on pointerup; this is the keyboard (Enter / Space)
      if (e.detail === 0 && this.g && !this.g.paused) { const it = this.g.items[Number(toy.dataset.toy)]; if (it && !it.done) this.togglePick(it); }
      return;
    }
    const bin = e.target.closest('.bin');
    if (bin) {
      if (this.g?.picked && !this.g.paused && performance.now() - (this.lastDragEnd || 0) > 300) {
        const it = this.g.picked;
        this.unpick();
        this.place(it, it.x, it.y - 14, 0, 1.12);
        this.drop(it, bin.dataset.bin, it.x, it.y - 14);
      }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) { if (this.g?.picked && !this.drag) this.unpick(); return; }
    const act = b.dataset.act;
    switch (act) {
      case 'play': this.startRound(); break;
      case 'again': this.startRound(); break;
      case 'level': this.openLevel(); break;
      case 'mess':
        this.settings.mess = b.dataset.mess; this.persist(); this.closeOverlay(); this.renderStart();
        this.shadow.querySelector('[data-act="level"]')?.focus({ preventScroll: true });
        break;
      case 'mess-set':
        this.settings.mess = b.dataset.mess; this.persist();
        b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
        break;
      case 'grownups': if (e.detail === 0) this.openGrownups(); break; // pointer: press and hold
      case 'set-counts': this.settings.counts = !this.settings.counts; this.persist(); b.setAttribute('aria-checked', this.settings.counts); break;
      case 'set-sound': this.settings.sound = !this.settings.sound; this.persist(); b.setAttribute('aria-checked', this.settings.sound); break;
      case 'reset':
        this.save.captain = null; this.save.streak = { count: 0, last: null }; this.save.best = 0; this.persist(); this.openGrownups(); break;
      case 'close': this.closeOverlay(); this.renderStart(); break;
      case 'pause': this.pause(); break;
      case 'resume': this.resume(); break;
      case 'restart': this.closeOverlay(); this.startRound(); break;
      case 'home': this.closeOverlay(); this.leave('home'); break;
      case 'exit':
        if (this.screen.querySelector('.cring')) { this.renderStart(); break; } // back from the classroom timer
        this.leave('exit');
        break;
      case 'classroom': this.renderClassroom(); break;
      case 'cl-toggle':
        if (this.cls?.running) this.classPause(); else this.classStart(false);
        break;
      case 'cl-again': if (this.cls) this.classStart(true); break;
      case 'cl-done': this.classDone(); break;
      case 'full': this.toggleFull(); break;
      default: break;
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('clean-up-crew')) customElements.define('clean-up-crew', CleanUpCrew);
})();

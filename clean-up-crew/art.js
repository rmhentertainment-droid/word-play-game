// Clean Up Crew stand-in art, drawn in code (SVG) so the game needs no image downloads.
// Real art replaces any piece by name: put the file in ./art and list it in ./art/art.json
// (for example { "robot-wave": "robot-wave.webp" }). Names are the keys of ART_NAMES below.
// Loaded by clean-up-crew.js; it sets window.CleanUpCrewArt.
(() => {
let n = 0;
const uid = (p) => `cuc${p}${++n}`;

// lighten (amt > 0) or darken (amt < 0) a #rrggbb colour
function shade(hex, amt) {
  const v = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const ch = (c) => Math.round(c + (t - c) * p);
  const r = ch(v >> 16), g = ch((v >> 8) & 255), b = ch(v & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const grad = (id, top, mid, bot) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`;
const STAR = (cx, cy, r, fill, stroke) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke || 'none'}" stroke-width="2.5" stroke-linejoin="round"/>`;
};
const capsule = (x1, y1, x2, y2, w, fill, edge) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${edge}" stroke-width="${w + 5}" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;

// ---------- toys ----------
function brick(c) {
  const a = uid('b');
  const studs = [14, 46, 78].map((x) =>
    `<rect x="${x}" y="10" width="28" height="22" rx="7" fill="url(#${a})" stroke="${shade(c, -0.35)}" stroke-width="2"/><ellipse cx="${x + 14}" cy="12" rx="13" ry="6" fill="${shade(c, 0.5)}"/>`).join('');
  return { vb: '0 0 120 96', body: `<defs>${grad(a, shade(c, 0.35), c, shade(c, -0.3))}</defs>${studs}
    <rect x="5" y="26" width="110" height="64" rx="14" fill="url(#${a})" stroke="${shade(c, -0.35)}" stroke-width="2.5"/>
    <rect x="5" y="70" width="110" height="20" rx="12" fill="${shade(c, -0.3)}" opacity=".45"/>
    <rect x="14" y="33" width="58" height="11" rx="5.5" fill="#fff" opacity=".5"/>` };
}
function starBlock(c, starFill = '#FFE46B') {
  const a = uid('s');
  return { vb: '0 0 110 110', body: `<defs>${grad(a, shade(c, 0.3), c, shade(c, -0.25))}</defs>
    <polygon points="10,32 30,10 102,10 82,32" fill="${shade(c, 0.4)}" stroke="${shade(c, -0.3)}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="82,32 102,10 102,84 82,104" fill="${shade(c, -0.25)}" stroke="${shade(c, -0.3)}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="10" y="32" width="72" height="72" rx="9" fill="url(#${a})" stroke="${shade(c, -0.3)}" stroke-width="2.5"/>
    ${STAR(46, 70, 24, starFill, '#F5B800')}
    <rect x="17" y="38" width="36" height="9" rx="4.5" fill="#fff" opacity=".5"/>` };
}
function teddy(c) {
  const a = uid('t');
  const lite = shade(c, 0.45);
  return { vb: '0 0 110 124', body: `<defs><radialGradient id="${a}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${shade(c, 0.3)}"/><stop offset="1" stop-color="${shade(c, -0.2)}"/></radialGradient></defs>
    <circle cx="26" cy="22" r="15" fill="url(#${a})"/><circle cx="84" cy="22" r="15" fill="url(#${a})"/>
    <circle cx="26" cy="22" r="7.5" fill="${lite}"/><circle cx="84" cy="22" r="7.5" fill="${lite}"/>
    <ellipse cx="20" cy="84" rx="12" ry="17" transform="rotate(25 20 84)" fill="url(#${a})"/>
    <ellipse cx="90" cy="84" rx="12" ry="17" transform="rotate(-25 90 84)" fill="url(#${a})"/>
    <ellipse cx="55" cy="90" rx="32" ry="28" fill="url(#${a})"/>
    <ellipse cx="55" cy="94" rx="17" ry="15" fill="${lite}"/>
    <ellipse cx="35" cy="114" rx="15" ry="9" fill="url(#${a})"/><ellipse cx="75" cy="114" rx="15" ry="9" fill="url(#${a})"/>
    <ellipse cx="35" cy="115" rx="8" ry="5" fill="${lite}"/><ellipse cx="75" cy="115" rx="8" ry="5" fill="${lite}"/>
    <circle cx="55" cy="46" r="31" fill="url(#${a})"/>
    <ellipse cx="55" cy="57" rx="15" ry="12" fill="${lite}"/>
    <circle cx="43" cy="42" r="4.5" fill="#0B2F57"/><circle cx="67" cy="42" r="4.5" fill="#0B2F57"/>
    <circle cx="44.5" cy="40.5" r="1.5" fill="#fff"/><circle cx="68.5" cy="40.5" r="1.5" fill="#fff"/>
    <ellipse cx="55" cy="52" rx="5.5" ry="4" fill="#0B2F57"/>
    <path d="M49 60q6 5 12 0" fill="none" stroke="#0B2F57" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="34" cy="54" r="5" fill="#FF8FB4" opacity=".55"/><circle cx="76" cy="54" r="5" fill="#FF8FB4" opacity=".55"/>
    <ellipse cx="44" cy="26" rx="10" ry="5" fill="#fff" opacity=".3"/>` };
}
function book(c, mark = 'star') {
  const a = uid('k');
  const emblem = mark === 'heart'
    ? `<path d="M68 56c-9-6-14-11-14-17a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 6-5 11-14 17z" fill="#fff"/>`
    : mark === 'moon'
      ? `<path d="M74 30a14 14 0 1 0 6 24 11 11 0 1 1-6-24z" fill="#fff"/>`
      : STAR(68, 44, 15, '#fff');
  return { vb: '0 0 124 100', body: `<defs>${grad(a, shade(c, 0.3), c, shade(c, -0.25))}</defs>
    <rect x="16" y="18" width="102" height="72" rx="8" fill="${shade(c, -0.35)}"/>
    <rect x="18" y="14" width="96" height="70" rx="6" fill="#FFF8EC" stroke="#E6D6BC" stroke-width="2"/>
    <path d="M24 80h88M24 75h88" stroke="#E6D6BC" stroke-width="1.5"/>
    <rect x="6" y="6" width="104" height="72" rx="9" fill="url(#${a})" stroke="${shade(c, -0.3)}" stroke-width="2.5"/>
    <rect x="6" y="6" width="20" height="72" rx="8" fill="${shade(c, -0.18)}"/>
    <rect x="44" y="20" width="48" height="48" rx="12" fill="${shade(c, -0.15)}" opacity=".55"/>
    ${emblem}
    <rect x="32" y="11" width="50" height="7" rx="3.5" fill="#fff" opacity=".45"/>` };
}
function shirt(c, starFill = '#FFE46B') {
  const a = uid('h');
  return { vb: '0 0 124 112', body: `<defs>${grad(a, shade(c, 0.3), c, shade(c, -0.25))}</defs>
    <path d="M40 8L18 18 3 46l22 11 8-12v57q0 5 5 5h48q5 0 5-5V45l8 12 22-11-15-28-22-10q-22 17-44 0z" fill="url(#${a})" stroke="${shade(c, -0.35)}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 8q22 22 44 0" fill="none" stroke="${shade(c, -0.25)}" stroke-width="5" stroke-linecap="round"/>
    ${STAR(62, 64, 17, starFill, shade(starFill, -0.25))}
    <path d="M24 26l-9 18" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".4"/>` };
}
function car() {
  const a = uid('c');
  return { vb: '0 0 130 88', body: `<defs>${grad(a, '#FF7A7A', '#E8383D', '#B21F27')}</defs>
    <path d="M30 30q6-18 24-18h22q16 0 24 18z" fill="url(#${a})" stroke="#9E1820" stroke-width="2.5"/>
    <path d="M40 30q4-11 15-11h8v11zM70 19h6q10 0 15 11H70z" fill="#BFEFFF"/>
    <rect x="6" y="28" width="118" height="34" rx="14" fill="url(#${a})" stroke="#9E1820" stroke-width="2.5"/>
    <rect x="16" y="34" width="44" height="7" rx="3.5" fill="#fff" opacity=".45"/>
    <circle cx="34" cy="64" r="15" fill="#2B3440"/><circle cx="34" cy="64" r="6.5" fill="#C9D3DD"/>
    <circle cx="96" cy="64" r="15" fill="#2B3440"/><circle cx="96" cy="64" r="6.5" fill="#C9D3DD"/>
    <rect x="114" y="38" width="8" height="8" rx="3" fill="#FFE46B"/>` };
}
function crayon(c = '#2E86F0') {
  return { vb: '0 0 150 40', body: `<path d="M118 8l30 12-30 12z" fill="#F6DEB3"/><path d="M136 15l12 5-12 5z" fill="${c}"/>
    <rect x="4" y="6" width="116" height="28" rx="8" fill="${c}"/>
    <rect x="22" y="6" width="10" height="28" fill="${shade(c, -0.3)}"/><rect x="92" y="6" width="10" height="28" fill="${shade(c, -0.3)}"/>
    <rect x="36" y="13" width="50" height="14" rx="7" fill="#fff" opacity=".85"/><rect x="8" y="10" width="100" height="5" rx="2.5" fill="#fff" opacity=".35"/>` };
}

// ---------- bins (back = inside of the tub, front = the tub with its icon plate) ----------
const BIN_COLORS = {
  blocks: ['#2CCBEA', '#8EEBFB', '#0E92B0'],
  stuffies: ['#F0558C', '#FF9CC0', '#A81E58'],
  books: ['#FFD12E', '#FFEA8E', '#D99A00'],
  clothes: ['#6CC644', '#AEE88E', '#3E9124'],
};
function binIcon(kind) {
  if (kind === 'blocks') return nest(brick('#1E6FE0'), 22, 20, 64, 52);
  if (kind === 'stuffies') {
    return `<g transform="translate(54 50)"><circle cx="-17" cy="-15" r="10" fill="#C98A4B"/><circle cx="17" cy="-15" r="10" fill="#C98A4B"/>
      <circle cx="-17" cy="-15" r="5" fill="#F1C79A"/><circle cx="17" cy="-15" r="5" fill="#F1C79A"/>
      <circle r="25" fill="#C98A4B"/><ellipse cy="8" rx="12" ry="9" fill="#F1C79A"/>
      <circle cx="-9" cy="-4" r="3.5" fill="#0B2F57"/><circle cx="9" cy="-4" r="3.5" fill="#0B2F57"/><ellipse cy="4" rx="4.5" ry="3.2" fill="#0B2F57"/></g>`;
  }
  if (kind === 'books') {
    return `<g transform="translate(54 52)"><path d="M0-14q-16-10-34-6v36q18-4 34 6z" fill="#FF8A3D" stroke="#C85A12" stroke-width="2"/>
      <path d="M0-14q16-10 34-6v36q-18-4-34 6z" fill="#2CCBEA" stroke="#0E92B0" stroke-width="2"/>
      <path d="M-28-12q12-2 24 4M-28-4q12-2 24 4M28-12q-12-2-24 4M28-4q-12-2-24 4" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>`;
  }
  return nest(shirt('#3CB54A', '#FFD12E'), 20, 14, 68, 62);
}
function nest(art, x, y, w, h) {
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${art.vb}">${art.body}</svg>`;
}
function binBack(kind) {
  const [, , dark] = BIN_COLORS[kind];
  const a = uid('i');
  return { vb: '0 0 272 218', body: `<defs>${grad(a, shade(dark, -0.35), shade(dark, -0.15), dark)}</defs>
    <rect x="12" y="4" width="248" height="60" rx="26" fill="url(#${a})"/>` };
}
function binFront(kind) {
  const [base, lite, dark] = BIN_COLORS[kind];
  const a = uid('f');
  const r = uid('r');
  return { vb: '0 0 272 218', body: `<defs>${grad(a, lite, base, dark)}${grad(r, '#fff', lite, base)}</defs>
    <path d="M16 44h240l-16 152q-2 16-18 16H50q-16 0-18-16z" fill="url(#${a})" stroke="${shade(dark, -0.15)}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M34 60l10 120" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".35"/>
    <rect x="5" y="26" width="262" height="36" rx="18" fill="url(#${r})" stroke="${shade(dark, -0.15)}" stroke-width="3"/>
    <rect x="22" y="31" width="150" height="8" rx="4" fill="#fff" opacity=".7"/>
    <rect x="82" y="82" width="108" height="96" rx="22" fill="#FFF4EC" stroke="#fff" stroke-width="4"/>
    <svg x="82" y="82" width="108" height="96" viewBox="0 0 108 96">${binIcon(kind)}</svg>` };
}

// ---------- robot buddy (wave, thumbs, cheer) ----------
function robot(pose = 'wave') {
  const w = uid('w');
  const v = uid('v');
  const y = uid('y');
  const W = '#FFFFFF', E = '#B8CBD8';
  let arms;
  if (pose === 'cheer') {
    arms = capsule(44, 130, 16, 88, 18, W, E) + capsule(116, 130, 144, 88, 18, W, E) +
      `<circle cx="14" cy="82" r="12" fill="${W}" stroke="${E}" stroke-width="2.5"/><circle cx="146" cy="82" r="12" fill="${W}" stroke="${E}" stroke-width="2.5"/>`;
  } else if (pose === 'thumbs') {
    arms = capsule(44, 132, 30, 160, 18, W, E) + capsule(116, 132, 146, 124, 18, W, E) +
      `<circle cx="28" cy="164" r="11" fill="${W}" stroke="${E}" stroke-width="2.5"/>
       <rect x="138" y="112" width="22" height="22" rx="8" fill="${W}" stroke="${E}" stroke-width="2.5"/>
       <rect x="143" y="94" width="10" height="22" rx="5" fill="${W}" stroke="${E}" stroke-width="2.5"/>`;
  } else {
    arms = capsule(44, 132, 30, 160, 18, W, E) + capsule(116, 130, 142, 90, 18, W, E) +
      `<circle cx="28" cy="164" r="11" fill="${W}" stroke="${E}" stroke-width="2.5"/>
       <circle cx="144" cy="82" r="13" fill="${W}" stroke="${E}" stroke-width="2.5"/>
       <path d="M154 62q8 6 6 16M160 54q12 10 8 26" fill="none" stroke="#FFD12E" stroke-width="4" stroke-linecap="round"/>`;
  }
  const mouth = pose === 'cheer'
    ? `<path d="M68 74h24q-2 13-12 13t-12-13z" fill="#3FE0F5"/>`
    : `<path d="M69 74q11 10 22 0" fill="none" stroke="#3FE0F5" stroke-width="5" stroke-linecap="round"/>`;
  return { vb: '0 0 160 194', body: `<defs>
      <linearGradient id="${w}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#DCE7EE"/></linearGradient>
      <linearGradient id="${v}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A5488"/><stop offset="1" stop-color="#0B2F57"/></linearGradient>
      <linearGradient id="${y}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE56E"/><stop offset="1" stop-color="#F5B000"/></linearGradient></defs>
    <path d="M80 22q-6-14 2-20 2 9 8 6-2 8-4 14zM80 22q-14-6-14-16 8 4 12 2z" fill="url(#${y})"/>
    ${arms}
    <rect x="60" y="102" width="40" height="14" rx="6" fill="#C7D6E0"/>
    <rect x="40" y="110" width="80" height="66" rx="28" fill="url(#${w})" stroke="${E}" stroke-width="2.5"/>
    <path d="M42 150h76v4q0 22-22 22H64q-22 0-22-22z" fill="#2CCBEA"/>
    <rect x="66" y="120" width="28" height="28" rx="9" fill="#fff" stroke="#E3EDF3" stroke-width="2"/>
    ${STAR(80, 134, 11, '#FFD12E', '#E8A400')}
    <rect x="52" y="172" width="20" height="18" rx="7" fill="#1EB7D8"/><rect x="88" y="172" width="20" height="18" rx="7" fill="#1EB7D8"/>
    <path d="M24 64q0-56 56-56t56 56" fill="none" stroke="url(#${y})" stroke-width="9" stroke-linecap="round"/>
    <rect x="24" y="22" width="112" height="86" rx="36" fill="url(#${w})" stroke="${E}" stroke-width="2.5"/>
    <rect x="36" y="36" width="88" height="58" rx="24" fill="url(#${v})"/>
    <path d="M52 62q8-11 16 0M92 62q8-11 16 0" fill="none" stroke="#3FE0F5" stroke-width="5" stroke-linecap="round"/>
    ${mouth}
    <rect x="44" y="41" width="30" height="7" rx="3.5" fill="#fff" opacity=".22"/>
    <rect x="8" y="46" width="22" height="36" rx="11" fill="url(#${y})" stroke="#D99A00" stroke-width="2"/>
    <rect x="130" y="46" width="22" height="36" rx="11" fill="url(#${y})" stroke="#D99A00" stroke-width="2"/>` };
}

// ---------- finish-screen friends ----------
function rhino() {
  const b = uid('rb');
  const C = '#93A9C0', D = '#6F87A1', L = '#D9E3EC';
  return { vb: '0 0 240 340', body: `<defs><radialGradient id="${b}" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#B7C8D9"/><stop offset="1" stop-color="${D}"/></radialGradient></defs>
    <rect x="70" y="262" width="42" height="66" rx="20" fill="url(#${b})"/><rect x="128" y="262" width="42" height="66" rx="20" fill="url(#${b})"/>
    <ellipse cx="91" cy="326" rx="24" ry="10" fill="${D}"/><ellipse cx="149" cy="326" rx="24" ry="10" fill="${D}"/>
    ${capsule(72, 214, 30, 150, 30, C, D)}${capsule(168, 214, 210, 150, 30, C, D)}
    <circle cx="28" cy="144" r="20" fill="url(#${b})"/><circle cx="212" cy="144" r="20" fill="url(#${b})"/>
    <ellipse cx="120" cy="230" rx="66" ry="66" fill="url(#${b})"/>
    <ellipse cx="120" cy="242" rx="42" ry="46" fill="${L}"/>
    <rect x="96" y="210" width="48" height="32" rx="10" fill="#2CCBEA"/>${STAR(120, 226, 11, '#FFD12E')}
    <ellipse cx="46" cy="78" rx="18" ry="26" transform="rotate(-30 46 78)" fill="url(#${b})"/><ellipse cx="194" cy="78" rx="18" ry="26" transform="rotate(30 194 78)" fill="url(#${b})"/>
    <ellipse cx="46" cy="80" rx="8" ry="14" transform="rotate(-30 46 80)" fill="#F4B9C8"/><ellipse cx="194" cy="80" rx="8" ry="14" transform="rotate(30 194 80)" fill="#F4B9C8"/>
    <ellipse cx="120" cy="124" rx="80" ry="66" fill="url(#${b})"/>
    <ellipse cx="120" cy="156" rx="52" ry="32" fill="#AFC1D3"/>
    <path d="M106 146q2-34 24-50-4 26-2 50z" fill="#F7EEDC" stroke="#D9C7A6" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="102" cy="160" rx="5" ry="4" fill="${D}"/><ellipse cx="138" cy="160" rx="5" ry="4" fill="${D}"/>
    <path d="M100 172q20 14 40 0" fill="none" stroke="#0B2F57" stroke-width="4" stroke-linecap="round"/>
    <circle cx="80" cy="116" r="9" fill="#0B2F57"/><circle cx="160" cy="116" r="9" fill="#0B2F57"/>
    <circle cx="83" cy="113" r="3" fill="#fff"/><circle cx="163" cy="113" r="3" fill="#fff"/>
    <path d="M52 84q4-62 68-62t68 62z" fill="#1EC0E2" stroke="#0E92B0" stroke-width="3"/>
    <path d="M120 22v62" stroke="#0E92B0" stroke-width="3"/><circle cx="120" cy="24" r="7" fill="#FFD12E"/>
    <path d="M150 80q40-4 64 8-30 8-64 4z" fill="#0E92B0"/>
    <path d="M70 50q16-18 40-20" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".45"/>` };
}
function leopard() {
  const b = uid('lb');
  const C = '#FFC24D', D = '#E09424', S = '#8A5A1F';
  const spots = [[84, 210], [150, 200], [104, 268], [160, 256], [70, 248], [80, 96], [156, 92], [120, 70], [96, 128], [146, 130]]
    .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${7 + (i % 3)}" ry="${5 + (i % 2)}" fill="none" stroke="${S}" stroke-width="4"/>`).join('');
  return { vb: '0 0 240 340', body: `<defs><radialGradient id="${b}" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#FFDB8A"/><stop offset="1" stop-color="${D}"/></radialGradient></defs>
    <path d="M176 280q50-10 44-60-4-22-22-20" fill="none" stroke="${D}" stroke-width="16" stroke-linecap="round"/>
    <path d="M206 214q10-10 4-22" stroke="${S}" stroke-width="16" stroke-linecap="round"/>
    <rect x="72" y="262" width="40" height="66" rx="20" fill="url(#${b})"/><rect x="128" y="262" width="40" height="66" rx="20" fill="url(#${b})"/>
    <ellipse cx="92" cy="326" rx="22" ry="10" fill="#FFF1D6"/><ellipse cx="148" cy="326" rx="22" ry="10" fill="#FFF1D6"/>
    ${capsule(74, 214, 32, 150, 28, C, D)}${capsule(166, 214, 208, 150, 28, C, D)}
    <circle cx="30" cy="144" r="19" fill="url(#${b})"/><circle cx="210" cy="144" r="19" fill="url(#${b})"/>
    <ellipse cx="120" cy="232" rx="62" ry="64" fill="url(#${b})"/>
    <ellipse cx="120" cy="246" rx="36" ry="42" fill="#FFF1D6"/>
    <circle cx="62" cy="58" r="22" fill="url(#${b})"/><circle cx="178" cy="58" r="22" fill="url(#${b})"/>
    <circle cx="62" cy="58" r="11" fill="#F4B9A0"/><circle cx="178" cy="58" r="11" fill="#F4B9A0"/>
    <ellipse cx="120" cy="114" rx="76" ry="64" fill="url(#${b})"/>
    ${spots}
    <ellipse cx="120" cy="144" rx="38" ry="28" fill="#FFF1D6"/>
    <path d="M110 134h20l-10 10z" fill="#B5523B" stroke="#B5523B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M120 144v8M120 152q-10 10-18 2M120 152q10 10 18 2" fill="none" stroke="#0B2F57" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M86 146h-30M86 154l-28 6M154 146h30M154 154l28 6" stroke="#B88A4A" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="90" cy="108" r="10" fill="#0B2F57"/><circle cx="150" cy="108" r="10" fill="#0B2F57"/>
    <circle cx="93" cy="104" r="3.5" fill="#fff"/><circle cx="153" cy="104" r="3.5" fill="#fff"/>
    <path d="M78 66q20-18 50-14" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".35"/>` };
}

const ART = {
  brick, starBlock, teddy, book, shirt, car, crayon, binBack, binFront, robot, rhino, leopard,
};
// The names real art files can replace (see art/art.json)
const ART_NAMES = ['robot-wave', 'robot-thumbs', 'robot-cheer', 'rhino', 'leopard', 'bin-blocks', 'bin-stuffies', 'bin-books',
  'bin-clothes', 'brick', 'star-block', 'teddy', 'book', 'shirt', 'car', 'crayon', 'logo'];
if (typeof window !== 'undefined') window.CleanUpCrewArt = { ART, ART_NAMES, STAR, nest };
})();

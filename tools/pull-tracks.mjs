// Builds data/levels.json from the Wix "Songs" collection so track titles are
// never typed by hand. Run from the tots-mots-app folder:
//   node word-play-game/tools/pull-tracks.mjs
// It keeps any backgrounds and score thresholds already in levels.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient, OAuthStrategy, media } from '@wix/sdk';
import { items } from '@wix/data';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1).trim()];
  }),
);
const ALBUM = process.argv[2] || 'The Word Play';
const client = createClient({ modules: { items }, auth: OAuthStrategy({ clientId: env.EXPO_PUBLIC_WIX_CLIENT_ID }) });

let res = await client.items.query(env.EXPO_PUBLIC_SONGS_COLLECTION_ID || 'Songs').eq('album', ALBUM).ascending('trackNumber').limit(100).find();
const all = [...res.items];
while (res.hasNext()) { res = await res.next(); all.push(...res.items); }
if (!all.length) { console.error(`No songs found with album = "${ALBUM}".`); process.exit(1); }

const audio = (v) => (typeof v === 'string' && v.startsWith('wix:audio://') ? media.getAudioUrl(v).url : v || null);
const out = 'word-play-game/data/levels.json';
const old = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : { cases: [] };
const cases = all.map((s, i) => {
  const prev = old.cases.find((c) => c.songId === s._id) || old.cases[i] || {};
  return {
    case: i + 1,
    songId: s._id,
    trackTitle: s.title,
    audio: audio(s.audioUrl),
    duration: typeof s.duration === 'number' ? s.duration : null,
    background: prev.background || null,
    thresholds: prev.thresholds || [50, 300, 600],
  };
});
writeFileSync(out, JSON.stringify({ album: ALBUM, source: 'Wix Songs collection', cases }, null, 2) + '\n');
console.log(`Wrote ${cases.length} cases to ${out}`);
for (const c of cases) console.log(String(c.case).padStart(2), c.trackTitle);

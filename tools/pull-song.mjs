// Writes a game's song.json from the Wix "Songs" collection, so the song title and audio link
// are never typed by hand. Run from the tots-mots-app folder:
//   node word-play-game/tools/pull-song.mjs                 (Clean Up Crew)
//   node word-play-game/tools/pull-song.mjs scrub-squad     (Scrub Squad)
//   node word-play-game/tools/pull-song.mjs --find germ     (list songs whose title contains a word, with their songKey)
// The songKeys below must match the Songs collection exactly (they are looked up, not changed).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient, OAuthStrategy, media } from '@wix/sdk';
import { items } from '@wix/data';

const GAMES = {
  'clean-up-crew': 'clean-up-crew-we-got-this',
  'scrub-squad': 'no-germs',
};

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1).trim()];
  }),
);
const client = createClient({ modules: { items }, auth: OAuthStrategy({ clientId: env.EXPO_PUBLIC_WIX_CLIENT_ID }) });
const COLLECTION = env.EXPO_PUBLIC_SONGS_COLLECTION_ID || 'Songs';

if (process.argv[2] === '--find') {
  const word = (process.argv[3] || '').toLowerCase();
  let res = await client.items.query(COLLECTION).limit(100).find();
  const all = [...res.items];
  while (res.hasNext()) { res = await res.next(); all.push(...res.items); }
  for (const s of all.filter((x) => String(x.title || '').toLowerCase().includes(word))) {
    console.log(`${s.songKey}\t${s.title}\t${s.album || ''}\t${s.duration ?? '?'}s`);
  }
  process.exit(0);
}

const game = process.argv[2] || 'clean-up-crew';
const SONG_KEY = GAMES[game];
if (!SONG_KEY) { console.error(`Unknown game "${game}". Known: ${Object.keys(GAMES).join(', ')}`); process.exit(1); }
const OUT = `word-play-game/${game}/song.json`;

const res = await client.items.query(COLLECTION).eq('songKey', SONG_KEY).limit(1).find();
const s = res.items[0];
if (!s) { console.error(`No song with songKey = "${SONG_KEY}". Try --find to look it up.`); process.exit(1); }
const audio = typeof s.audioUrl === 'string' && s.audioUrl.startsWith('wix:audio://') ? media.getAudioUrl(s.audioUrl).url : s.audioUrl;
const song = { songId: s._id, songKey: s.songKey, title: s.title, album: s.album, audio, duration: s.duration ?? null, source: 'Wix Songs collection' };
// keep anything else a game stores next to the record (e.g. Scrub Squad's section markers)
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
writeFileSync(OUT, JSON.stringify({ ...old, ...song }, null, 2) + '\n');
console.log(`Wrote ${OUT}: ${song.title} (${song.duration}s)`);

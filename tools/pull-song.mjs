// Writes clean-up-crew/song.json from the Wix "Songs" collection, so the song title and audio link
// are never typed by hand. Run from the tots-mots-app folder:
//   node word-play-game/tools/pull-song.mjs
// The title below must match the Songs collection exactly (it is looked up, not changed).
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient, OAuthStrategy, media } from '@wix/sdk';
import { items } from '@wix/data';

const SONG_KEY = 'clean-up-crew-we-got-this'; // songKey in the Songs collection
const OUT = 'word-play-game/clean-up-crew/song.json';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1).trim()];
  }),
);
const client = createClient({ modules: { items }, auth: OAuthStrategy({ clientId: env.EXPO_PUBLIC_WIX_CLIENT_ID }) });
const res = await client.items.query(env.EXPO_PUBLIC_SONGS_COLLECTION_ID || 'Songs').eq('songKey', SONG_KEY).limit(1).find();
const s = res.items[0];
if (!s) { console.error(`No song with songKey = "${SONG_KEY}".`); process.exit(1); }
const audio = typeof s.audioUrl === 'string' && s.audioUrl.startsWith('wix:audio://') ? media.getAudioUrl(s.audioUrl).url : s.audioUrl;
const song = { songId: s._id, songKey: s.songKey, title: s.title, album: s.album, audio, duration: s.duration ?? null, source: 'Wix Songs collection' };
writeFileSync(OUT, JSON.stringify(song, null, 2) + '\n');
console.log(`Wrote ${OUT}: ${song.title} (${song.duration}s)`);

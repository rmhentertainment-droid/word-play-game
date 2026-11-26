// Velo page code for a "Clean Up Crew" page on totsmots.com (URL /clean-up-crew, under the Kids Games section).
// Only needed for the standalone page: inside Kids mode > Games the game opens in place and reads song.json.
// Paste this into the page's code panel in the Wix Editor (replace what's there).
//
// The page holds one Custom Element:
//   Script URL: https://rmhentertainment-droid.github.io/word-play-game/clean-up-crew/clean-up-crew.js
//   Tag name:   clean-up-crew
// Check the two IDs below (click the element in the Editor; the ID shows in the Properties & Events panel):
//   GAME_ID   the Custom Element
//   PLAYER_ID the site's floating music player
import wixData from 'wix-data';

const GAME_ID = '#cleanUpCrew';
const PLAYER_ID = '#musicPlayer';
const SONG_KEY = 'clean-up-crew-we-got-this'; // songKey of "Clean Up Crew (We Got This)" in the Songs collection

$w.onReady(async function () {
  const game = $w(GAME_ID);

  // The song comes from the Songs collection, so its title is always the registered one.
  try {
    const res = await wixData.query('Songs').eq('songKey', SONG_KEY).limit(1).find();
    const song = res.items[0];
    if (song && song.audioUrl) {
      game.setAttribute('song-title', song.title);
      if (song.duration) game.setAttribute('song-duration', String(song.duration));
      game.setAttribute('song-src', song.audioUrl);
    }
  } catch (err) {
    console.log('Clean Up Crew: could not read the Songs collection; the game uses its own song.json.', err);
  }

  // The game pauses the site music player itself; this also hides it while the song plays.
  game.on('game-audio', (event) => {
    const playing = event.detail && event.detail.playing;
    try {
      const player = $w(PLAYER_ID);
      if (playing) player.hide();
      else player.show();
    } catch (err) {
      console.log('Clean Up Crew: music player not found. Check PLAYER_ID.', err);
    }
  });
});

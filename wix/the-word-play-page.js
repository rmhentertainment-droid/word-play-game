// Velo page code for the "The Word Play" page on totsmots.com.
// Paste this into the page's code panel in the Wix Editor (replace what's there).
//
// Before it works, check two IDs (click the element in the Editor, the ID shows in the
// Properties & Events panel, it starts with #):
//   GAME_ID   the Custom Element that holds <word-play-game>
//   PLAYER_ID the site's floating music player
const GAME_ID = '#wordPlayGame';
const PLAYER_ID = '#musicPlayer';

$w.onReady(function () {
  const game = $w(GAME_ID);

  // The game pauses the music player itself when a case starts.
  // This also hides the player while a case is playing, so no one taps it back on,
  // and brings it back when the case ends or is paused.
  game.on('game-audio', (event) => {
    const playing = event.detail && event.detail.playing;
    try {
      const player = $w(PLAYER_ID);
      if (playing) player.hide();
      else player.show();
    } catch (err) {
      console.log('Word Play: music player not found. Check PLAYER_ID.', err);
    }
  });
});

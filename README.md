# The Word Play (game)

The falling-letter word game for totsmots.com, built as one custom element: `<word-play-game>`.
It is plain JavaScript with no build step, so the folder can be copied into the Wix site's code as is.

## Try it on this PC

From the `tots-mots-app` folder in Command Prompt:

```
node word-play-game\tools\serve.mjs
```

Then open http://localhost:5178. Keyboard: arrows move, Up turns, Space drops, 1-3 switch letters, Tab picks a block in a group, C for a clue, Esc pauses.
To test endings quickly, add `song-seconds="30"` to the `<word-play-game>` tag in `index.html` (this skips the music).

## Files you can edit without touching code

| File | What it holds |
| --- | --- |
| `data/words.txt` | The kid-safe word list. Only these words clear. |
| `data/blocklist.txt` | Words that never clear, even if added to the list by mistake. |
| `data/config.json` | Speeds, minimum word length, case line height per mode, points, letter odds, detective tips. |
| `data/levels.json` | The 23 cases: track title, song link, length, background, magnifier score thresholds. |

`levels.json` is built from the Wix Songs collection (album "The Word Play"), so track titles are never typed by hand. To refresh it after changing songs in Wix:

```
node word-play-game\tools\pull-tracks.mjs
```

Word-rule checks: `node word-play-game\tools\test-logic.mjs`

## Live copy (GitHub Pages)

- Repository: https://github.com/rmhentertainment-droid/word-play-game (only this folder)
- Play it: https://rmhentertainment-droid.github.io/word-play-game/
- Game file for the Wix Custom Element: `https://rmhentertainment-droid.github.io/word-play-game/word-play-game.js`

After saving a change in this project, send the new version up (from the `tots-mots-app` folder). It goes live a minute later:

```
git subtree push --prefix=word-play-game game main
```

## Games section (Kids mode › Games)

`games/` holds `<tots-games>`: the games grid, search, category chips, Keep playing card and each game's details page. Edit `games/games.json` to add games, covers, badges, screenshots or to change `playUrl` (the Wix page that holds the game).
- Custom Element link: `https://rmhentertainment-droid.github.io/word-play-game/games/tots-games.js`, tag name `tots-games`
- Test page: https://rmhentertainment-droid.github.io/word-play-game/games/
- The game understands `?case=N` (open the case files on that case) and `?screen=cases`.

## Hooking it into Wix (phase 4)

- Music player: the game pauses any other audio on the page (including inside the floating music player) when a case starts, and keeps it paused. `wix/the-word-play-page.js` is the Velo page code that also hides the player during a case; check the two element IDs at its top.

- Velo sets attributes `member-id`, `logged-in` and `progress` (the member's saved progress as JSON).
- The game fires `progress-change` (save `detail.progress` to the WordPlayProgress collection for members; guests are saved on the device automatically) and `game-audio` (`detail.playing`: hide or pause the site music player while true).

## Clean Up Crew (game)

`clean-up-crew/` holds `<clean-up-crew>`, the song-timed sorting game: drag toys into the right bins before
"Clean Up Crew (We Got This)" ends. Plain JavaScript, no build step, same as The Word Play.

- Try it: `node word-play-game\tools\serve.mjs`, then http://localhost:5178/clean-up-crew/
  (`?seconds=30` = a 30-second round with no music, `?classroom` = open the Classroom timer).
- Live copy: https://rmhentertainment-droid.github.io/word-play-game/clean-up-crew/
  Custom Element: `https://rmhentertainment-droid.github.io/word-play-game/clean-up-crew/clean-up-crew.js`, tag `clean-up-crew`
- The song (title, audio link, length) is `clean-up-crew/song.json`, pulled from the Wix Songs collection:
  `node word-play-game\tools\pull-song.mjs`. Never type the title by hand.
- Art: the toys, bins, robot, rhino and leopard are drawn in code (`clean-up-crew/art.js`) as stand-ins. To use real art,
  put a transparent PNG/WebP in `clean-up-crew/art/` and list it in `clean-up-crew/art/art.json` by name
  (names are listed there). Games grid cover and banner: `clean-up-crew/promo/` (`cover.html` is their source).
- Saved on the device (localStorage `cleanupcrew-v1`): the Captain badge, best stars, the class streak, grown-up settings.
- Games grid: its entry in `games/games.json` has `"status": "review"`, so everyone still sees "Coming soon";
  add `?preview` to the page address to play it from the grid. Change it to `"live"` when Ryan signs off.
- Wix page (optional, for a standalone /clean-up-crew page): `wix/clean-up-crew-page.js`.

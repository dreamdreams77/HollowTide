# Roadmap

Chapter One is complete and playable end to end. Ideas for what could come next, roughly in order of payoff.

## Next up

- [ ] **Chapter Two: the Press.** The truth from chapter one points at the thing that made the thumbs. New scenes below the
      kiln, new clue set, a fourth party member.
- [x] ~~Ending-aware New Game+.~~ Done: the pier opens differently after each ending (more to come in later scenes).
- [x] ~~Settings panel~~ Done: sound, text speed, calm (no boil), wait/active battles. A 24 fps option is still open.
- [x] ~~Hint system~~ Done: the Almanac tab (what now, loose threads) plus a Hint button in the Lamp Lock.
- [ ] **More glazes** (a stun, a shield-all, a cure-slow) and one equippable per character that modifies a stat.
- [x] ~~Depth pass: conditions and combos, a telegraphed boss, glaze mastery, eight-note deduction board, bonds, banter, a fourth ending, walk-behind props, lamp-aware shadows, reflections, idle fidgets.~~ Done.
- [x] ~~Bestiary~~ Done, in the Almanac tab.
- [ ] More deductions than the five we ship: let two *deductions* combine into a third.

## Polish

- [x] ~~Idle animations for every NPC.~~ Done: breathing, blinking, weight shifts and a fidget every couple of seconds.
- [ ] Hit-stop and a camera shove on Fracture finishers.
- [ ] Per-speaker voice blips (today every speaker shares one randomized triangle-wave blip in `audio.js`).
- [x] ~~A proper portrait-mode layout instead of a "turn your phone" toast.~~ Done: camera, column UI, battle re-flow, rotation.
- [x] ~~Installable app.~~ Done: manifest, icons, offline service worker (not yet tried on physical phones).
- [ ] More calacas: voice blips for Hueso, a skeleton ferryman, the Guild as pinstriped skeletons.
- [ ] Gamepad support.

## Tech

- [ ] Try the installed app on real iOS and Android devices, and fix whatever turns up (safe areas, audio unlock, fullscreen).
- [ ] Wrap `dist/` for the stores (PWABuilder or Capacitor). Untested; the web app is the supported build.
- [ ] Self-host the two fonts so the very first load is fully offline.

- [ ] Save slots and export/import of a save as text.
- [ ] A scene editor page (`tools/`) to place hotspots by dragging.
- [ ] Optional sprite-sheet path for hand-sculpted assets (see `ART_PIPELINE.md`).
- [ ] Localization: all strings already live in scripts and data, so a string table is a mechanical refactor.

## Before a store release (found in the release pass)

- [ ] Real-device pass on iOS and Android (audio unlock, safe areas, performance; headless software rendering ran at about 8 fps, which says nothing about phones).
- [ ] Self-hosted fonts, gamepad, save slots / export, localization, and a flee command (battles cannot be run from today).
- [ ] Content: the chapter is roughly 30 to 45 minutes with four scenes. More rooms, a shop or crafting use for items, and a second chapter are the biggest gaps.
- [ ] Voice blips per speaker, a proper credits screen, and a title-screen "how to play" card.

## Non-goals (for now)

Online features, accounts, analytics, a store, and any dependency that would break `npm start` on a fresh checkout.

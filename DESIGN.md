# Design notes

## One-line pitch

A claymation conspiracy RPG: a ferry apprentice, a ferry captain and a pickled tide-spirit discover that their harbor town
is built on a sleeping god, and that every founder in town is the same pressed thumbprint.

## Pillars

1. **Everything is clay.** No flat vector shapes, no pure black, no hard edges. If it is on screen it is a lump with a
   fingerprint on it. The look *is* the feature.
2. **Paranoia with a wink.** Tone from *Drowned God*: old myths that all rhyme, a truth hiding in the margins. Delivery from
   *The Neverhood*: deadpan, gentle, a bit silly. The horror is quiet; the jokes are about pickles.
3. **Poke everything.** Point-and-click discovery is the main verb. Sparkles mark unseen hotspots so touch players are
   never stuck pixel-hunting on a phone.
4. **Light RPG, never a grind.** Battles are short (about 30 seconds), always optional to *think* about but never to
   *win by grinding*: the mandatory fights alone carry you to level 5, wandering ones to level 6.
5. **Noir with marigolds.** *Grim Fandango*'s afterlife look, as an accent and never a costume: cut-paper banners and
   marigold garlands over deadpan skeletons in suits, art-deco gilt on the clay, neon buzzing in the fog. The dead are
   friendly; the living institutions are the sinister part.
6. **Original.** The four inspirations are tone, structure and look only. No names, text or assets are borrowed.

## The look, in layers

| layer | what | where |
|---|---|---|
| clay | lumpy outlines that boil at 12 fps, hi-res fingerprint texture, thumb dents and modelling-tool drags, contact shadows, warm bounce light | `clay.js` |
| noir | a teal-ink / bruised-rose split tone, heavy vignette, per-frame exposure flicker, grain, a hair in the gate; long cast shadows from the key light; low fog and slatted light over the sets | `clay.js` `filmFinish`, `noir.js`, `stage.js` `paintAtmos` |
| Dia de Muertos | papel picado bunting, marigold garlands and petal trails, ofrenda candles, the moon whose craters are a sugar skull | `noir.js`, `stage.js` |
| deco | gilt double-line frames on every big panel, a sunburst behind the title, a neon subtitle and a neon FERRY sign with one tired letter | `noir.js`, `ui.js` |
| space | **walk-behind props** (`props.js`) sorted in with the actors by their feet, which turn half see-through when they hide the lead; shadows that lean away from the nearest registered lamp; faint upside-down **reflections** on the wet chapel floor; idle **fidgets** every couple of seconds | `props.js`, `noir.js` `castShadow`, `actors.js`, `game.js` `renderWorld` |
| people | **Archivist Hueso**, a skeleton clerk in the archive who files nothing, answers in deadpan, and quietly hints at the ledger, the lamps and the vault | `actors.js` (`calaca`), `scenes.js` |

## Story in eight notes

| note | found in | what it says |
|---|---|---|
| The Same Thumb | pier, Founders' Wall | 41 founders, one thumbprint: somebody pressed them all |
| Four Signs | archive, tablet rack | drowned-city stories all name Mouth, Hand, Eye, Tide, in that order |
| The Pressing Ledger | archive, desk | "Batch 1: 41 founders, pressed and fired." The accounts have been kept for 900 years |
| The Keeper's Log | pier, the lighthouse | Old Brine carried the Thumb out of the Kilnhouse in his coat. "Cobb stayed. Cobb always stays. Somebody has to keep it warm." His son's note in the margin: *He wasn't brave. He was tired.* |
| The 900-Year Tide | chapel, mural | the sea leaves every nine hundred years to let something cool. Today is the day |
| File Zero: The Unpressed | archive, after you fill in Hueso's forms | Batch Zero: one citizen shaped before the Press and never fired, no thumbprint, *Retained, as record-keeper. Reason: he asked.* Clipped beneath: COBB, first Stoker, *Retained, as kiln. Reason: he volunteered* |
| What Slip Remembers | chapel, the confessional (with Slip in the party) | the tide hums four phrases on its way out and never finishes them. It is the ferry lullaby |
| What the Warden Kept | kiln, after the boss | there was never a Founder: a god sleeps under the harbor and we are the clay it shed |

**Deductions.** Tapping one note and then another on the board ties them together when the pair has a meaning (otherwise
nothing happens). Five exist, each a pair of notes:

| deduction | from | what it changes |
|---|---|---|
| Nobody Founded Anything | Same Thumb + Ledger | Ochre admits she used to press her own thumb in the fourth tile; the wall reads differently |
| Batch Two Is Tonight | Tide + Ledger | the pale shape on the pier half-opens an eye; Ochre notices it breathing |
| Cobb Stayed | Keeper's Log + File Zero | the Warden was a man called Cobb; at the kiln you may say his name and fight a shorter, sadder fight that ends by *yielding* instead of by killing him |
| The Unfired Thumb | File Zero + Same Thumb | opens the fourth ending, if Hueso trusts you |
| The Four Beats | Four Signs + Slip's memory | the Long Sleep ending resolves the lullaby |

Four endings from one choice at the last door: **The Long Sleep** (let it rest), **The Waking** (wake it), **The
Forty-Second Thumb** (press Marl's thumb to the lock: someone must keep the tide) and, if you worked out the Unfired Thumb and
earned Hueso's trust, **The Retained** (send for the one man the Press never fired). An epilogue of up to four lines follows,
chosen from whether you spared the Warden, each companion's **bond**, and what Marl confessed he was afraid of
(`unmade`, `used` or `made`) at the chapel confessional.

## Flow

```
Pier ── Brine gives the Brass Thumb ── Ochre joins ── hatch (husk fight)
  └─> Archive ── tablet rack (four signs) ── desk (ledger) ── Lamp Lock ── Slip's jar (+ Guild ambush) ── vault
        └─> Chapel ── mural ── offering bowl ── glyphs in the right order (eel ambush at the first press) ── gate
              └─> Kiln ── the Warden ── the last choice ── ending
```

The sign order is a real puzzle: the tablet rack in the archive supplies it, and the chapel doesn't tell you. A wrong press
dims the glyphs and resets; the second failure makes Slip hint at the archive.

## Systems

**Exploration.** Walk areas with depth scaling; followers use a position trail; each scene lists hotspots with a
*stand point* so the character walks to a sensible spot before acting. Interactions are `async` scripts.

**Puzzles.**
- *Lamp Lock*: 3x3 "press a lamp, flip it and its neighbours". Seeded so it is always solvable (the scramble is built by
  pressing lamps), with a minimal-solution solver used by the tests.
- *Four signs*: an ordered sequence with reset-on-wrong.

**Battles (ATB).** Gauge rate is `8 + speed * 0.7` per second. The game runs in *wait* mode: while a command is pending,
time crawls at 12% speed. Damage:

```
physical = atk * 1.15 * power * roll - def * 0.5
magic    = mag * 1.45 * power * roll - def * 0.3
heal     = mag * 1.6  * power * roll
```

Elements double or halve damage (fire is strong against husks, weak against kilnwrights; water is the reverse). **Fracture**
(limit) fills as a party member takes damage; each character has one limit move. The Warden has a four-move pattern and enrages under 50% HP, changing the
pattern and speeding up by 30%.

**Conditions and combos.** Every combatant carries timed conditions (`fx` in `battle.js`):

| condition | how it arrives | what it does |
|---|---|---|
| soaked | any water hit (Brine, Deluge, a Brine Flask) and the eels' Slick | fire on a soaked target makes **steam**: x1.35 and the soak is spent. Water also douses a charging foe and removes scorch |
| brittle | Ember (unless the target is soaked or resists) and Crackle | a physical hit **shatters** it: x1.35 and the brittleness is spent |
| scorched | Cinder Toss, Soot Bellow, Inferno Press | a burn tick every 1.5 s of battle time; it never kills on its own |
| hushed | the Auditors | glazes are disabled (Fracture and items still work) |
| haste | Quicken | the gauge fills faster |

**Enemy intent.** Enemy AI checks `_sensible` before it chooses: the Vigil Moth's *Wick-Mend* only fires when
somebody is hurt, the Auditor's *Stamp: DENIED* (hush) doesn't re-hush the already hushed, and its *Audit* (an MP drain)
doesn't drain an empty tank. The Warden *stokes* (a visible charge) and then *blazes* (power 2.5); water or a
Brine Flask on the charging Warden puts it out. `yieldAt` lets an encounter end with `result.spared` when its HP falls below a
threshold (used when you know Cobb's name).

**Glazes** (our materia). Each member has two slots; glazes are found, not bought, and swapped in the Party tab.
Marl starts with Ember and finds Wedge in Brine's barrel on the pier. Ochre arrives with Mend and finds Slump tucked in
the ledger's spine. Slip's Brine comes with the jar, Deluge falls out of the chapel altar, Crackle is dropped through the
confessional grille, and Hueso's small "expedited processing" orb is Quicken (for filling in his forms honestly). **Mastery:** a glaze earns AP from every fight (`round(xp x 0.55)`)
and ranks up at 0, 50 and 150 AP; rank 2 adds power or duration, rank 3 widens the target or adds an effect (`GLAZE_PERKS` in
`data.js`). Pips under the glaze name in the Party tab show the rank.

**Bonds and banter.** `state.bond` counts how much each companion trusts you (raised by choices and by finding things
together). `banter.js` holds 23 one-shot lines keyed `scene/hotspot`, played after you poke something when the speaker is in
the party and any `needs` condition holds.

## Balance targets (enforced by tests)

A scripted bot fights each encounter 150 times per seed set (`test/battle.test.js`):

| fight | band asserted |
|---|---|
| pier tutorial (2 husks), Marl + Ochre at level 4 | wins at least 90% |
| archive Guild ambush, full party at level 4 | wins 80% to 100%: a real fight, rarely lost |
| chapel eels, full party at level 5 | wins at least 75% |
| the Warden at level 5 | wins 35% to 97%: beatable, not a pushover |
| the Warden at level 7 | wins at least 60%, and never does worse than level 5 |
| the Warden, attack-only bot | loses almost always: the conditions and the douse are the game |
| the named Warden (you know Cobb) | wins always: it is a conversation, not a siege |
| archive clerks (Auditors + moths), level 4 to 5 | smart bot always wins, attack-only wins about three times in four at level 4 |
| the chapel vigil, level 5 | smart bot always wins, attack-only about one time in five |

In tuning runs a naive bot beat the Warden about 60% of the time at level 5 and about 97% at level 6, and individual fights last
roughly 26 to 36 seconds. The tests assert *bands*, not exact numbers, so legitimate tuning doesn't break them, but a typo that
makes the boss unbeatable (or trivial) does.

## Mobile

The game assumes touch first: primary buttons are finger-sized, hover is a nice-to-have, and unseen hotspots sparkle.

**One world, two shapes.** The logical canvas is 960x540 sideways, and 540 wide by 720 to 1200 tall upright (it matches the
screen's aspect, so nothing is letterboxed). Every scene is still painted as a 960x540 diorama; upright, it is shown through a
follow-camera (a 0.85x to 1.6x zoom, smoothed, looking a little ahead of the way you face) clipped to a band under a 92 px
title marquee, and any spare height is more floor (`setStageExtend`) rather than empty space. Chevrons at the screen edges
say "more world this way" and glow when there is an unseen hotspot out of sight. Taps are converted back to world
coordinates (`toWorld`), so hotspots and walking work identically in both shapes.

**Upright UI.** Dialogue is a full-width box at the bottom, the menus (journal, party, items) are single tall columns, the
lamp puzzle scales up, the title stacks, and battles move the foes to the top, the party in the middle, and a 2x2 grid of
big commands (up to 84 px tall) at the bottom. Landscape battle buttons are 38 px tall. `battleLayout()` and `makeView()` hold the numbers.

**Rotation.** `main.js` re-measures on `resize` and `orientationchange`, resizes the canvas, and calls `Game.setViewport`,
which snaps the camera and re-lays a running battle out. State is untouched, so you can rotate mid-fight.

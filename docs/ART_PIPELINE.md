# Art pipeline

*Hollow Tide ships with no image files.* Every pixel is drawn at runtime by `src/engine/clay.js` and friends. That keeps
the repo tiny and hackable, and lets the game look consistently "claymation" at any resolution. This document explains how
the look is made, how to add to it, and how to move toward real sculpted assets later if you want to.

## How the clay look is built

| ingredient | where | effect |
|---|---|---|
| **Lumpy outlines** | `blobPoints`, `limbPoints` | superellipse outlines with low-frequency wobble so no shape is a perfect circle or rectangle |
| **Boil** | `frame` argument everywhere | outlines re-roll every stop-motion frame at **12 fps**, like a real animator nudging clay between shots |
| **Fingerprint texture** | `buildTexture`, tiled `createPattern` | whorls, embossed speckle, thumb dents and tool scratches, baked at 2x so it stays crisp on hi-dpi screens; offset per shape and per frame so it crawls slightly |
| **Hand marks** | `toolMarks` | on bigger lumps: one thumb dent and a couple of modelling-tool drags, stable per seed |
| **Contact shadow + bounce light** | `drawClay` | each lump drops a soft shadow on what is behind it (this is also the grout between bricks), and a warm line of table-bounce light creeps into its shadowed underside |
| **Warm key light / cool shadow** | gradients in `drawClay` | light from the top-left in warm cream; shadows are tinted violet (`#1b1038`), never black |
| **Rim light + inner shadow** | shifted, clipped strokes | makes lumps read as soft volumes rather than flat fills |
| **Wet glint** | tilted radial gradient | the little specular spot that sells plasticine |
| **Noir film finish** | `filmFinish` | teal-ink / bruised-rose split tone (soft-light), vignette, per-frame exposure flicker, grain, and the occasional hair in the gate |
| **Clay lettering** | `clayText` | titles are extruded letters in clay, with the same boil |

## Noir and Dia de Muertos dressing (`noir.js`)

All of it is still clay or cut paper, deterministic per stop-motion frame, and leaves the canvas exactly as it found it
(`test/noir.test.js` asserts balanced `save/restore` and `globalAlpha` for every primitive).

| primitive | use |
|---|---|
| `papelPicado(ctx, x0, y0, x1, y1, sag, fr, opts)` | a string of cut-paper flags with real even-odd holes, fluttering a little each frame |
| `marigold`, `garland`, `petals`, `petalPath` | flowers, hung garlands, falling petals, a trail dropped on the floor |
| `candle`, `ofrenda`, `sugarSkull`, `moonFace` | altar pieces; a clay calavera; the moon whose craters are a skull |
| `neonText`, `neonSign` | tube lettering with a stuttering letter (`dead:` index) |
| `fogBank`, `shafts`, `motes` | low fog, slatted light, floating dust; `stage.js` `paintAtmos` applies them per scene after the sprites |
| `decoFan`, `decoFrame`, `decoRule`, `castShadow` | art-deco sunburst, gilt panel frames, rules, long shadows from the key light |

The deco display face is **Limelight** (Google Fonts, falling back to Poppins); only names, signs and headings use it.

**Cost.** The richer shading is roughly a third more work per frame than the first version in a software-rendered headless
browser. Two things keep it in budget: tiny flat shapes (stars, petals, flames) take a `lite` path that skips the texture and
volume passes, and `main.js` lowers the backing-store resolution automatically when a frame takes too long (and raises it
again with headroom). If you add something drawn hundreds of times per frame, make it `lite`.

## Props, lamps and reflections (`props.js`)

Backdrops are flat paintings; **props** are things in the room. A scene's `props()` returns `{ prop, x, y }` entries (`y` is the
base line on the floor); `game.renderWorld` scales them by `depthScale(y)`, merges them with the actors and sorts by `y`, so
Marl walks behind a crate and in front of a stool. Each `PROPS` entry draws itself with `(0,0)` at the middle of its base, and
`PROP_W` says how wide it is on the floor: when the lead stands just behind a prop inside that width, the prop draws at half
alpha so you never lose him.

- **Lamps.** Painters call `lamp(x, y, color, r, a)`; after `sc.paint`, `game.js` hands the list to `setKeyLights` and
  `castShadow` points every shadow away from the nearest lamp (short and dark under it, long and faint far away). With no lamp
  registered (battle backdrops) it falls back to the old fixed angle; battle registers one light in the middle of the floor.
- **Reflections.** A scene with `wet: true` draws each figure again, flipped about its feet at 15% alpha, with `noShadow`.
  It costs about a fifth more per frame in that one scene.
- **Fidgets.** `drawFigure` opens a 16-frame window every 108 to 148 frames per figure (offset by its seed) when the figure
  is idle and not talking, and lerps the front hand to a target (head, hat brim) or lifts the lamp, taps the cane, or hops.
- **Adding a prop.** Add a function to `PROPS`, give it a width in `PROP_W`, and place it in a scene's `props()`. Keep the
  prop's footprint away from hotspot `stand` points that sit behind its base line, or the person using the hotspot will be
  hidden by it (the confessional's base is at `y = 452` so the fourth glyph tile's stand point at `y = 456` is in front).

## Rendering cost and the render loop

Rendering cost is managed in `main.js`: the world and UI are drawn to an offscreen layer **only when the stop-motion
frame changes (12 per second) or something was clicked**, then blitted at 60 fps with a smooth clay-thumb cursor on top.
Anything that would mark the layer dirty every frame (walking, fades, pointer moves) is deliberately *not* doing so.

## Adding a character

Characters and monsters are sculpted in code in `src/engine/actors.js`.

1. Add a kind to `FIGURES` (colors, hat, hair, build) or write a new `drawX` for something non-humanoid.
2. Use only `blob`, `slab` and `limb`; give each part a stable `seed` so its lump shape is stable across frames, and pass
   `frame` so it boils.
3. Add its bounds to `ENEMY_BOUNDS` (monsters) or let `figureBounds` compute them (figures) so hit-testing works.
4. Register stats in `src/game/data.js` (`CHARACTERS` or `ENEMIES`).
5. Look at it: `python3 tools/shots.py gallery monsters` renders the engine gallery page headlessly.

Rules of thumb that took trial and error:
- Check portraits and battle sprites at small size: early versions had hats covering eyes and eels too small to read.
- Every blob is re-rolled each stop-motion frame, so keep figures to as few parts as read well.
- Wrap anything that changes `globalAlpha` in `ctx.save()/restore()`. A leaked alpha silently fades everything after it.

## Adding a scene

1. Write a `paintX(ctx, frame, opts)` in `src/engine/stage.js` and add its walkable rectangle to `LAYOUT`.
2. Add the scene in `src/game/scenes.js`: `paint`, `walk`, `scale` (depth scaling range), `hotspots()`, `enter()`.
3. If it has fights, give it an entry in `ENCOUNTERS` and optionally a `danger` function for wandering monsters.
4. Run `npm test`: the playthrough test fails loudly if your scene breaks the story path.

## Color

Palette is deliberately dusk-violet with warm accents: a violet-to-rose sky, teal sea, brick ochre, kiln orange. Each scene has
a *theme*, and battles inherit the theme of the place they started in.

## Going further: real clay

If you want sculpted assets later, the code is already shaped for it:

- Replace a figure's `drawFigure` call with `ctx.drawImage` from a sprite sheet (sculpt, photograph on a turntable, cut out,
  12 fps loops). `figureBounds` stays the same.
- Backdrops can become painted or photographed miniature sets; keep the vignette and grain from `filmFinish` on top so
  procedural UI and real clay still sit in the same world.
- Keep painting scenes as 960x540 dioramas; portrait phones view them through the camera (and `setStageExtend` tells the
  floor painters how much extra to draw underneath). Ship 2x assets and let `devicePixelRatio` do the rest.

## App icons

`python3 tools/icons.py` draws the icons with the game's own renderer (`tools/icon.html`: a calavera moon over clay waves
under bunting and marigolds) and writes the rounded 192 and 512 icons, full-bleed maskable 192 and 512 (art kept inside the
safe zone), the 180 px Apple touch icon and a favicon into `icons/`. It needs Playwright and Pillow; the PNGs are committed,
so nobody else has to run it.

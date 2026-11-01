"""Scripted screenshots of the *real* game (not the engine gallery).

Used by `python3 tools/shots.py game [names...]`. Drives the running page through `window.__game`, so every PNG is
exactly what a player sees: UI, dialogue, battle panels, film grain and all.
"""
import pathlib

SETUP_JS = """
async () => {
  const d = await import('/src/game/data.js');
  window.__d = d;
  return true;
}
"""


def run(pg, base, out, names, portrait=False):
    if not portrait:
        pg.set_viewport_size({"width": 960, "height": 540})
    prefix = "p-" if portrait else ""
    pg.goto(f"{base}/index.html")
    pg.wait_for_function("window.__game !== undefined", timeout=20000)
    pg.evaluate(SETUP_JS)
    canvas = pg.locator("#game")

    def ev(js, *a):
        return pg.evaluate(js, *a) if a else pg.evaluate(js)

    def snap(name):
        path = pathlib.Path(out) / f"game-{prefix}{name}.jpg"
        canvas.screenshot(path=str(path), type="jpeg", quality=88)
        print("wrote", path)

    def settle(ms=700):
        pg.wait_for_timeout(ms)

    def party(levels):
        """Replace the party: [(id, level, [glazes])...] and give everyone full HP/MP."""
        ev(
            """(spec) => {
              const g = window.__game, d = window.__d;
              g.state.party = spec.map(([id, lv, gl]) => d.newMember(id, lv, gl));
              g.state.glazes = ['ember', 'brine', 'mend', 'wedge', 'slump', 'deluge'];
              g.state.inv.wetclay = 3; g.state.inv.slipdraught = 1;
            }""",
            levels,
        )

    def clues(ids):
        ev("(ids) => { const g = window.__game; g.state.clues = ids; }", ids)

    def finish_script(max_steps=60):
        for _ in range(max_steps):
            busy = ev("() => { const g = window.__game; return g.script || !!g.dialogue || !!g.choice; }")
            if not busy:
                return
            ev("() => { const g = window.__game; if (g.choice) g.pick(0); else if (g.dialogue) g.advance(); }")
            pg.wait_for_timeout(120)

    def wait_ready():
        pg.wait_for_function(
            "() => { const bv = window.__game.bv; return bv && bv.b.current && !bv.b.result && !bv.banner; }",
            timeout=40000,
        )

    wanted = set(names)

    def want(n):
        return not wanted or n in wanted

    # ---- title
    if want("title"):
        settle(900)
        snap("title")

    # ---- intro dialogue on the pier (real "new game" path)
    ev("() => window.__game.newGame()")
    if want("intro"):
        pg.wait_for_function("() => !!window.__game.dialogue", timeout=10000)
        settle(1500)
        snap("intro")
    finish_script()

    # ---- pier, exploring, with a hover label and sparkles
    if want("pier"):
        party([["marl", 4, ["ember", None]], ["ochre", 4, ["mend", "wedge"]]])
        ev("() => { const g = window.__game; g.debugJump('pier', { intro_done: true, met_brine: true, has_thumb: true, ochre_joined: true }, { px: 150, py: 480 }); g.walkTo(560, 470); }")
        pg.wait_for_function("() => !window.__game.walk", timeout=15000)
        settle(900)
        ev("() => { const g = window.__game; g.pointerMove(...g.toScreen(410, 365)); }")  # hover over the Founders' Wall
        settle(800)
        snap("pier")

    # ---- journal string board + party tab
    if want("journal"):
        party([["marl", 5, ["ember", None]], ["ochre", 5, ["mend", "wedge"]], ["slip", 5, ["brine", None]]])
        clues(["same_thumb", "four_signs", "ledger", "tide_chart"])
        ev("() => { const g = window.__game; g.debugJump('chapel', { chapel_seen: true }); g.openMenu('journal'); }")
        settle(800)
        snap("journal")
    if want("party"):
        ev("() => { const g = window.__game; if (!g.menu) g.openMenu('party'); g.setTab('party'); }")
        settle(800)
        snap("party")
        ev("() => window.__game.closeMenu()")

    # ---- battle UI
    if want("battle") or want("battle-glaze"):
        party([["marl", 4, ["ember", None]], ["ochre", 4, ["mend", "wedge"]], ["slip", 4, ["brine", None]]])
        ev("() => { const g = window.__game; g.debugJump('archive', { intro_done: true, battle_tutorial: true }); g.run(() => g.battle('archive_guild')); }")
        wait_ready()
        settle(300)
        snap("battle")
        if want("battle-glaze"):
            ev("() => window.__game.bv.choose('glaze')")
            settle(500)
            snap("battle-glaze")
        # drop this fight; the next debugJump puts the game back in explore mode
        ev("() => { const g = window.__game; g.bv = null; g.mode = 'explore'; }")

    # ---- boss
    if want("boss"):
        party([["marl", 6, ["ember", "wedge"]], ["ochre", 6, ["mend", "slump"]], ["slip", 6, ["brine", "deluge"]]])
        ev("() => { const g = window.__game; g.state.party.forEach((m) => { m.hp = 9999; }); g.debugJump('kiln', { warden_met: true, battle_tutorial: true }); g.run(() => g.battle('kiln_warden')); }")
        wait_ready()
        settle(300)
        snap("boss")
        ev("() => { const g = window.__game; g.bv.b.foes.forEach((f) => { f.hp = Math.floor(f.maxHp * 0.3); }); }")
        settle(2200)
        snap("boss-enraged")
        ev("() => { const g = window.__game; g.bv = null; g.mode = 'explore'; }")

    # ---- lamp puzzle overlay
    if want("lamps"):
        ev("() => { const g = window.__game; g.debugJump('archive', { intro_done: true }); g.state.lamps = [1,0,1, 0,0,0, 1,0,0]; g.run(() => g.openLampPuzzle()); }")
        settle(900)
        snap("lamps")
        ev("() => window.__game.closePuzzle()")
        settle(300)

    # ---- the rest of the places
    place = {
        "archive": ("archive", {"intro_done": True, "husks_beaten": True, "hatch_open": True}),
        "chapel": ("chapel", {"chapel_seen": True}),
        "kiln": ("kiln", {"warden_met": True}),
    }
    for key, (scene, flags) in place.items():
        if not want(key):
            continue
        party([["marl", 5, ["ember", None]], ["ochre", 5, ["mend", "wedge"]], ["slip", 5, ["brine", None]]])
        ev("(a) => { const g = window.__game; g.debugJump(a[0], a[1]); g.state.px = 520; g.state.py = 480; g.snapCamera(); }", [scene, flags])
        settle(700)
        ev("() => { const g = window.__game; g.pointerMove(...g.toScreen(700, 300)); }")
        settle(500)
        snap(key)

    # ---- an ending
    if want("ending"):
        ev(
            """() => { const g = window.__game; g.debugJump('kiln', { warden_met: true, boss_beaten: true, kiln_open: true }, { eyeT: 1 });
                       g.run(() => g.showEnding({ key: 'The Long Sleep', title: 'THE LONG SLEEP',
                         text: 'Marl lays a hand on the great cool lid and hums a ferry song. The eye closes. The tide comes home, gently, over everything.' })); }"""
        )
        settle(4200)
        snap("ending")

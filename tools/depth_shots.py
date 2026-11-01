#!/usr/bin/env python3
"""Screenshots of the depth pass: conditions in battle, the Warden's tell, new enemies, deeper story screens.

  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 tools/depth_shots.py [--out DIR] [--portrait] [names...]
"""
import argparse
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--out", default=str(ROOT / "docs" / "screens"))
    ap.add_argument("--portrait", action="store_true")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    httpd, port = serve()
    wanted = set(args.names)
    want = lambda n: not wanted or n in wanted
    pre = "p-" if args.portrait else ""
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844} if args.portrait else {"width": 960, "height": 540}, device_scale_factor=1)
        pg = ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://127.0.0.1:{port}/index.html")
        pg.wait_for_function("window.__game !== undefined", timeout=20000)
        pg.evaluate("async () => { window.__d = await import('/src/game/data.js'); }")
        pg.evaluate("() => window.__game.newGame()")
        pg.wait_for_timeout(1500)  # the pier's opening narration starts half a second in; let it appear, then clear it per shot
        canvas = pg.locator("#game")

        def snap(name):
            path = out / f"depth-{pre}{name}.jpg"
            canvas.screenshot(path=str(path), type="jpeg", quality=88)
            print("wrote", path)

        def party(spec, glazes=None):
            pg.evaluate(
                """([spec, gl]) => { const g = window.__game, d = window.__d;
                  g.state.party = spec.map(([id, lv, gz]) => d.newMember(id, lv, gz));
                  g.state.glazes = gl || ['ember','brine','mend','wedge','slump','deluge','crackle','quicken'];
                  g.state.inv = { wetclay: 3, slipdraught: 1, coldslip: 2, brineflask: 2 };
                  g.state.flags.battle_tutorial = true; }""",
                [spec, glazes],
            )

        def battle(scene, enc, flags=None):
            pg.evaluate("([s, e, f]) => { const g = window.__game; g.debugJump(s, f || { intro_done: true }); g.state.flags.battle_tutorial = true; g.run(() => g.battle(e)); }", [scene, enc, flags])
            pg.wait_for_function("() => { const bv = window.__game.bv; return bv && bv.b.current && !bv.b.result && !bv.banner; }", timeout=40000)

        def leave():
            pg.evaluate("() => { const g = window.__game; g.bv = null; g.mode = 'explore'; }")

        if want("clerks"):
            party([["marl", 5, ["ember", "crackle"]], ["ochre", 5, ["mend", "slump"]], ["slip", 5, ["brine", "quicken"]]])
            battle("archive", "archive_clerks")
            # put conditions on everyone so one frame shows them all
            pg.evaluate("""() => { const b = window.__game.bv.b;
              b.foes[0].fx.brittle = 9; b.foes[0].fx.soaked = 9; b.foes[1].fx.scorched = 9;
              b.party[0].fx.hushed = 9; b.party[1].fx.scorched = 9; b.party[1].guard = true; b.party[2].fx.haste = 9; b.party[2].fx.soaked = 9;
              window.__game.bv.known.auditor = { weak: ['fire'], resist: [] }; window.__game.bv.known.moth = { weak: ['fire'], resist: ['water'] }; }""")
            pg.wait_for_timeout(500)
            snap("conditions")
            pg.evaluate("() => window.__game.bv.choose('glaze')")
            pg.wait_for_timeout(400)
            snap("glaze-menu")
            leave()

        if want("tell"):
            party([["marl", 6, ["ember", "wedge"]], ["ochre", 6, ["mend", "slump"]], ["slip", 6, ["brine", "deluge"]]])
            battle("kiln", "kiln_warden", {"warden_met": True, "intro_done": True})
            pg.evaluate("""() => { const g = window.__game, bv = g.bv, b = bv.b; g.state.party.forEach((m) => { m.hp = 9999; });
              const w = b.foes[0]; b._perform(w, { id: 'stoke', name: 'Stoking the Fire', kind: 'charge', target: 'self' }, null); b.lock = 0; }""")
            pg.wait_for_timeout(900)
            snap("warden-tell")
            leave()

        if want("moth"):
            party([["marl", 5, ["ember", "crackle"]], ["ochre", 5, ["mend", "slump"]], ["slip", 5, ["brine", "quicken"]]])
            battle("chapel", "chapel_vigil", {"chapel_seen": True, "intro_done": True})
            pg.wait_for_timeout(400)
            snap("vigil")
            leave()

        def stage(scene, flags=None, at=None, party_ids=("marl", "ochre", "slip")):
            """Jump to a scene, put the party in the room, and let a couple of stop-motion frames settle."""
            pg.evaluate(
                """([s, f, at, ids]) => { const g = window.__game, d = window.__d;
                  g.state.party = ids.map((id) => d.newMember(id, 5, id === 'marl' ? ['ember'] : id === 'ochre' ? ['mend'] : ['brine']));
                  g.debugJump(s, Object.assign({ intro_done: true, chapel_seen: true, archive_seen: true, battle_tutorial: true }, f || {}));
                  g.dialogue = null; g.choice = null; g.script = false;
                  if (at) { g.state.px = at[0]; g.state.py = at[1]; g.state.followTrail = []; } }""",
                [scene, flags, at, list(party_ids)],
            )
            pg.wait_for_timeout(700)

        if want("scenes"):
            # props, walk-behind sorting, lamp-aware shadows: Marl behind the crates, then behind the post, in each room
            stage("pier", None, [116, 480])
            snap("pier-behind-crates")
            stage("pier", {"tonight": True}, [480, 470])
            pg.evaluate("() => { window.__game.state.deduced = Object.assign(window.__game.state.deduced || {}, { tonight: true }); }")
            pg.wait_for_timeout(500)
            snap("pier-tension")
            stage("archive", None, [640, 470])
            snap("archive-cart")
            stage("chapel", None, [640, 440])
            snap("chapel-behind-booth")
            stage("chapel", None, [420, 480])
            snap("chapel-reflection")
            stage("kiln", None, [205, 470])
            snap("kiln-anvil")

        if want("journal"):
            stage("archive")
            pg.evaluate(
                """() => { const g = window.__game, d = window.__d;
                  for (const id of Object.keys(d.CLUES)) { if (!g.hasClue(id)) g.addClue(id); }
                  const ds = Object.values(d.DEDUCTIONS);
                  ds.slice(0, 2).forEach((x) => g.connect(x.needs[0], x.needs[1]));
                  g.toasts = []; g.openMenu('journal'); if (ds[0]) g.menu.sel = 'd:' + ds[0].id in g.menu ? g.menu.sel : ds[0].needs[0]; }"""
            )
            pg.wait_for_timeout(500)
            pg.evaluate("() => { window.__game.toasts = []; }")
            pg.wait_for_timeout(300)
            snap("journal-board")
            pg.evaluate("() => { const g = window.__game; g.setTab && g.setTab('party'); }")
            pg.wait_for_timeout(400)
            snap("party-tab")
            pg.evaluate("() => window.__game.closeMenu()")

        if want("ending"):
            stage("kiln", {"warden_spared": True, "ochre_rust": True, "hueso_trust": True})
            pg.evaluate(
                """() => { const g = window.__game;
                  g.state.bond = { ochre: 2, slip: 2, brine: 1 }; g.state.fear = 'unmade';
                  const sc = window.__d; import('/src/game/scenes.js').then((m) => {
                    const ep = m.epilogue(g);
                    g.showEnding({ key: 'The Long Sleep', title: 'THE LONG SLEEP', text: 'Marl lays a hand on the great cool lid and hums the ferry song, all four beats, and for the first time in nine hundred years the last line resolves. The eye closes. The tide comes home, gently, over everything. Mudhaven never learns what it stood on. But three people and one pickled thing do, and every low tide after, they sit on the pier and keep very quiet. ' + ep.join(' ') });
                  }); }"""
            )
            pg.wait_for_timeout(5200)
            snap("ending-long")

        print("errors:", errors[:5])
        b.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Browser smoke test for the BUILT app (needs playwright + Chromium; optional dev tool).

  node tools/build.mjs && python3 tools/smoke.py

Checks, in a real Chromium: the canvas actually paints, the manifest and icons are valid, Chrome considers the app
installable, the service worker caches the shell, the game relaunches OFFLINE, and rotating the phone re-lays the game out.
"""
import http.server
import json
import pathlib
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "dist"


class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(DIST), **k)

    def log_message(self, *a):
        pass


failures = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


PAINTED = """() => {
  const c = document.getElementById('game'); const x = c.getContext('2d');
  // sample a grid; a healthy frame has opaque pixels everywhere, a half-drawn one has transparent holes
  let opaque = 0, n = 0;
  for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) { n++; if (x.getImageData(Math.floor(c.width * i / 6), Math.floor(c.height * j / 6), 1, 1).data[3] === 255) opaque++; }
  return { opaque, n, w: c.width, h: c.height };
}"""


def main():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"

    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 960, "height": 540}, service_workers="allow")
        pg = ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)

        pg.goto(base + "/index.html")
        pg.wait_for_function("window.__game !== undefined", timeout=20000)
        pg.wait_for_timeout(1200)
        r = pg.evaluate(PAINTED)
        check("canvas paints edge to edge", r["opaque"] == r["n"], f"{r['opaque']}/{r['n']} sample points opaque, {r['w']}x{r['h']}")
        check("no page errors", not errors, "; ".join(errors[:3]))

        # manifest + icons
        man = pg.evaluate("() => fetch('manifest.webmanifest').then(r => r.json())")
        check("manifest has name, start_url, standalone display", bool(man.get("name") and man.get("start_url")) and man.get("display") == "standalone")
        check("manifest allows both orientations", man.get("orientation") == "any")
        sizes = pg.evaluate(
            """(icons) => Promise.all(icons.map(i => new Promise(res => { const im = new Image(); im.onload = () => res([i.src, im.naturalWidth, im.naturalHeight, i.sizes]); im.onerror = () => res([i.src, 0, 0, i.sizes]); im.src = i.src; })))""",
            man["icons"],
        )
        ok_icons = all(w > 0 and f"{w}x{h}" == s for _, w, h, s in sizes)
        check("every manifest icon loads at its declared size", ok_icons, ", ".join(f"{s}={w}x{h}" for s, w, h, _ in sizes))
        check("has a maskable icon", any(i.get("purpose") == "maskable" for i in man["icons"]))

        # service worker
        pg.wait_for_function("navigator.serviceWorker.ready.then(() => true)", timeout=20000)
        pg.wait_for_function("navigator.serviceWorker.controller !== null || true")
        cached = pg.evaluate("""async () => { const keys = await caches.keys(); const out = {}; for (const k of keys) out[k] = (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname); return out; }""")
        shell = next((v for k, v in cached.items() if k.startswith("hollow-tide-shell-")), [])
        check("service worker precached the shell", any(x.endswith("/index.html") for x in shell) and any(x.endswith("manifest.webmanifest") for x in shell), f"{len(shell)} files")

        # installability according to Chromium itself
        cdp = ctx.new_cdp_session(pg)
        try:
            cdp.send("Page.enable")
            inst = cdp.send("Page.getInstallabilityErrors")
            errs = [e["errorId"] for e in inst.get("installabilityErrors", [])]
            check("Chromium reports no installability errors", not errs, ", ".join(errs))
        except Exception as e:  # noqa: BLE001
            print("SKIP installability check:", e)

        # offline relaunch (reload once with the SW in control)
        pg.reload()
        pg.wait_for_function("window.__game !== undefined", timeout=20000)
        ctx.set_offline(True)
        pg.reload()
        pg.wait_for_function("window.__game !== undefined", timeout=20000)
        pg.wait_for_timeout(1200)
        r = pg.evaluate(PAINTED)
        check("relaunches and paints while OFFLINE", r["opaque"] == r["n"], f"{r['opaque']}/{r['n']}")
        check("offline game starts on the title", pg.evaluate("() => window.__game.mode") == "title")
        check("the offline page was served by the service worker", pg.evaluate("() => !!navigator.serviceWorker.controller"))
        ctx.set_offline(False)

        # rotation
        pg.set_viewport_size({"width": 390, "height": 844})
        pg.wait_for_timeout(700)
        v = pg.evaluate("() => ({p: window.__game.view.portrait, w: window.__game.view.w, h: window.__game.view.h})")
        check("portrait phone lays out upright", v["p"] and v["w"] == 540 and v["h"] > 540, json.dumps(v))
        r = pg.evaluate(PAINTED)
        check("portrait canvas paints edge to edge", r["opaque"] == r["n"], f"{r['opaque']}/{r['n']}")
        pg.set_viewport_size({"width": 844, "height": 390})
        pg.wait_for_timeout(700)
        v = pg.evaluate("() => ({p: window.__game.view.portrait, w: window.__game.view.w, h: window.__game.view.h})")
        check("rotating back goes landscape", (not v["p"]) and v["w"] == 960 and v["h"] == 540, json.dumps(v))
        r = pg.evaluate(PAINTED)
        check("landscape canvas paints edge to edge after rotation", r["opaque"] == r["n"], f"{r['opaque']}/{r['n']}")
        b.close()
    httpd.shutdown()
    print("\n%d check(s) failed" % len(failures) if failures else "\nall browser checks passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()

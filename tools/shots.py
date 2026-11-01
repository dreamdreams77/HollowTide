#!/usr/bin/env python3
"""Screenshot helper (optional dev tool; needs `pip install playwright` + a Chromium).

Usage:
  python3 tools/shots.py gallery pier archive chapel      # engine gallery pages
  python3 tools/shots.py game                              # scripted shots of the real game

Writes JPEGs to docs/screens/ (or --out DIR).
"""
import argparse
import http.server
import pathlib
import socketserver
import sys
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
    ap.add_argument("mode", choices=["gallery", "game"])
    ap.add_argument("names", nargs="*")
    ap.add_argument("--out", default=str(ROOT / "docs" / "screens"))
    ap.add_argument("--frame", type=int, default=7)
    ap.add_argument("--portrait", action="store_true", help="phone held upright (390x844 @2x) instead of 960x540")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    httpd, port = serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as p:
        b = p.chromium.launch()
        if args.portrait:
            pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        else:
            pg = b.new_page(viewport={"width": 960, "height": 540})
        logs = []
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        if args.mode == "gallery":
            for n in args.names or ["pier"]:
                pg.goto(f"{base}/tools/gallery.html?what={n}&frame={args.frame}")
                pg.wait_for_function("document.title === 'ready'", timeout=20000)
                pg.locator("#c").screenshot(path=str(out / f"gallery-{n}.jpg"), type="jpeg", quality=88)
                print("wrote", out / f"gallery-{n}.jpg")
        else:
            sys.path.insert(0, str(ROOT / "tools"))
            import game_shots  # noqa: WPS433

            game_shots.run(pg, base, out, args.names, portrait=args.portrait)
        for l in logs:
            print(l)
        b.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()

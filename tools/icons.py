#!/usr/bin/env python3
"""Regenerate the PWA icons in icons/ from the game's own renderer (needs playwright + Pillow).

  python3 tools/icons.py

Writes icon-192/512 (rounded, transparent corners), icon-maskable-192/512 and apple-touch-icon (full-bleed,
art kept inside the safe zone) and favicon-64.
"""
import pathlib
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import shots  # noqa: E402  (reuses the tiny static server)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"


def main():
    OUT.mkdir(exist_ok=True)
    httpd, port = shots.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1024, "height": 1024})
        for kind in ("any", "full"):
            pg.goto(f"http://127.0.0.1:{port}/tools/icon.html?kind={kind}")
            pg.wait_for_function("document.title === 'ready'", timeout=20000)
            raw = OUT / f"_{kind}.png"
            pg.locator("#c").screenshot(path=str(raw), omit_background=True)
        b.close()
    httpd.shutdown()

    def out(src, name, size, flatten=False):
        im = Image.open(OUT / src).convert("RGBA").resize((size, size), Image.LANCZOS)
        if flatten:
            bg = Image.new("RGB", im.size, (18, 10, 46))
            bg.paste(im, mask=im.split()[3])
            im = bg
        im.save(OUT / name, optimize=True)
        print("wrote", OUT / name)

    out("_any.png", "icon-512.png", 512)
    out("_any.png", "icon-192.png", 192)
    out("_full.png", "icon-maskable-512.png", 512, flatten=True)
    out("_full.png", "icon-maskable-192.png", 192, flatten=True)
    out("_full.png", "apple-touch-icon.png", 180, flatten=True)
    out("_any.png", "favicon-64.png", 64)
    for kind in ("any", "full"):
        (OUT / f"_{kind}.png").unlink()


if __name__ == "__main__":
    main()

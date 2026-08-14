#!/usr/bin/env python3
"""Cuts the pasta emoji out of their glowing backgrounds into assets/emoji/.

The source art lives outside the repo, in the shared brand folder. Re-run this
only when new emoji are added there:

    python3 scripts/build-emoji.py [source-dir]

The background is a smooth gradient and the figures have hard outlines, so the
mask is a flood fill inward from the frame edge that stops wherever the colour
changes faster than TOL between neighbouring pixels. Detached accessories (the
angle brackets, the constellation dots) survive because every blob above a
fraction of the biggest one is kept.
"""

import glob
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

DEFAULT_SRC = os.path.expanduser('~/Documents/Columbia/Pasta-Lab/emojis')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets/emoji')
WORK = 384       # resolution the mask is computed at
FINAL = 256      # exported size
TOL = 4          # per-step colour tolerance of the flood fill
KEEP = 0.01      # keep blobs at least this fraction of the largest one


def flood_from_border(a, tol):
    h, w, _ = a.shape
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        cy, cx = q.popleft()
        cur = a[cy, cx]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx]:
                if np.abs(a[ny, nx] - cur).max() <= tol:
                    bg[ny, nx] = True
                    q.append((ny, nx))
    return bg


def blobs(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    found = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)])
                seen[y, x] = True
                px = []
                while q:
                    cy, cx = q.popleft()
                    px.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
                found.append(px)
    return found


def keep_significant(mask, keep=KEEP):
    found = blobs(mask)
    if not found:
        return mask
    biggest = max(len(b) for b in found)
    out = np.zeros_like(mask)
    for b in found:
        if len(b) >= biggest * keep:
            for (y, x) in b:
                out[y, x] = True
    return out


def fill_holes(mask):
    h, w = mask.shape
    outside = np.zeros_like(mask)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not mask[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not mask[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
    return ~outside


def cut(path):
    im = Image.open(path).convert('RGB')
    im.thumbnail((WORK, WORK), Image.LANCZOS)
    a = np.asarray(im).astype(np.int16)
    figure = fill_holes(keep_significant(~flood_from_border(a, TOL)))
    alpha = Image.fromarray((figure * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    rgba = im.convert('RGBA')
    rgba.putalpha(alpha)
    rgba = rgba.crop(rgba.getbbox())
    side = max(rgba.size)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(rgba, ((side - rgba.size[0]) // 2, (side - rgba.size[1]) // 2), rgba)
    return canvas.resize((FINAL, FINAL), Image.LANCZOS)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.isdir(src):
        sys.exit(f'source folder not found: {src}')
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, '*.webp')):
        os.remove(old)
    count = 0
    for path in sorted(glob.glob(os.path.join(src, '*.png'))):
        name = os.path.basename(path)[:-4]
        out = os.path.join(OUT, name + '.webp')
        cut(path).save(out, 'WEBP', quality=90, method=6)
        print(f'{name:22s} {os.path.getsize(out) // 1024:3d}KB')
        count += 1
    print(f'\nWrote {count} emoji to assets/emoji/.')


if __name__ == '__main__':
    main()

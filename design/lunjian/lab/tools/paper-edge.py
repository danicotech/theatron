"""Shared top edge for the battle papers (red, black, blue) as an alpha mask.

The edge follows the line the user drew on 2026-10-31: high at red's outer corner, down to the black
paper, level across it, and up to blue's outer corner. The torn fibres are not drawn: they are lifted
from the approved wing artwork's own torn tops, at the scale the wings are shown on a 1920px screen, and
laid along that line. Output: lab/art/battle-paper-edge.webp, copied to /lunjian/art by to-theatron.py.

Geometry (mask pixels, used at 100% width and 1:1 height on a 1920px screen):
  W x H = 2000 x 200; outer corners at y=OUTER, the black paper's top at y=INNER, corners at LEFT/RIGHT.
battle-embed.css sizes the mask from these numbers (--paper-drop is INNER - OUTER).
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)
ART = os.path.abspath(os.path.join(LAB, '../../../web/public/battle-preview/assets/battle-produced'))
OUT = os.path.join(LAB, 'art', 'battle-paper-edge.webp')

W, H = 2000, 200
OUTER, INNER = 24, 134
LEFT, RIGHT = 0.39, 0.59
SHOWN = 0.64     # wings are drawn at ~64% of their source size on a 1920px screen
BAND = 26        # fibres reach this far above and below the smoothed edge
SMOOTH = 81      # columns averaged to find the edge's own trend


def edge_strip(name, mirror=False):
    """Alpha of the sheet's torn top, flattened: one column per output pixel, the trend removed."""
    im = Image.open(os.path.join(ART, name)).convert('RGBA')
    im = im.resize((round(im.width * SHOWN), round(im.height * SHOWN)), Image.LANCZOS)
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    alpha = im.split()[3]
    px, w, h = alpha.load(), alpha.width, alpha.height
    top = []
    for x in range(w):
        y = next((y for y in range(h) if px[x, y] > 128), None)
        top.append(y)
    cols = [x for x in range(w) if top[x] is not None and top[x] < h * 0.4]
    # Keep only the columns of the sheet's top edge (not its torn inner side).
    cols = cols[: int(len(cols) * 0.9)]
    trend = []
    for i, x in enumerate(cols):
        win = [top[c] for c in cols[max(0, i - SMOOTH // 2): i + SMOOTH // 2 + 1]]
        trend.append(sum(win) / len(win))
    strip = []
    for x, t in zip(cols, trend):
        t = round(t)
        strip.append([px[x, y] if 0 <= y < h else (255 if y >= h else 0) for y in range(t - BAND, t + BAND)])
    return strip


def line(x):
    """The drawn line, with softened corners."""
    l, r = LEFT * W, RIGHT * W
    if x <= l:
        y = OUTER + (INNER - OUTER) * x / l
    elif x >= r:
        y = INNER - (INNER - OUTER) * (x - r) / (W - r)
    else:
        y = INNER
    return y


def softened():
    raw = [line(x) for x in range(W)]
    k = 30
    return [sum(raw[max(0, x - k): x + k + 1]) / len(raw[max(0, x - k): x + k + 1]) for x in range(W)]


red = edge_strip('wing-red-v1.webp')
blue = edge_strip('wing-blue-v1.webp', mirror=True)
blue.reverse()   # blue's outer corner is on the right
centre = red[60:] + blue[: len(blue) // 2]

ys = softened()
mask = Image.new('L', (W, H), 0)
out = mask.load()
for x in range(W):
    if x < LEFT * W:
        col = red[x % len(red)]
    elif x >= RIGHT * W:
        col = blue[(x - round(RIGHT * W)) % len(blue)]
    else:
        col = centre[(x - round(LEFT * W)) % len(centre)]
    y0 = round(ys[x]) - BAND
    for y in range(H):
        i = y - y0
        out[x, y] = 0 if i < 0 else (255 if i >= len(col) else col[i])

rgba = Image.new('RGBA', (W, H), (0, 0, 0, 0))
rgba.putalpha(mask)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
rgba.save(OUT, 'WEBP', lossless=True)
print(OUT, os.path.getsize(OUT), 'bytes')

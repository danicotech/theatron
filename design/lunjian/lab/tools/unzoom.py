# Large screens draw a chapter or the nav bar bigger with zoom (web/src/app/large-screen.css), and zoom scales
# viewport units as well, so every one of them is divided by --zoom-local: 1 outside a zoomed block, the zoom inside.
# Conditions of @media/@container/@supports measure the real viewport and are left alone.
import re

VIEWPORT_UNIT = re.compile(r'(?<![\w.#-])(-?\d*\.?\d+(?:s|d|l)?v(?:h|w|min|max|i|b))\b')


def unzoom(text):
    parts = re.split(r'(@(?:media|container|supports)[^{]*\{)', text)
    return ''.join(part if i % 2 else VIEWPORT_UNIT.sub(r'calc(\1 / var(--zoom-local, 1))', part) for i, part in enumerate(parts))

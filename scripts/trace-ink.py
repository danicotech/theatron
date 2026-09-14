"""把手寫毛筆題字的點陣圖描成 SVG 向量。

為什麼要向量化而不是直接用 PNG:
  · 題字要當章節標題,會放到很大 —— 點陣放大就糊,而毛筆的飛白邊緣一糊就死。
  · 填色交給 CSS(fill="currentColor"),朱紅/骨白換色不必重出圖。
  · 一張 700KB 的 PNG 描完只剩幾十 KB。

流程:alpha → 二值 → marching squares 取等值線 → 平滑 → RDP 簡化 → SVG。
marching squares 而不是邊界追蹤:它天生處理「字裡面的洞」(口、日、田),
輸出一律是閉合環,交給 fill-rule="evenodd" 就對了。

用法:python trace_ink.py <來源資料夾> <輸出資料夾> [工作寬度] [簡化容差]
"""

import os
import sys
from PIL import Image

DEFAULT_MAX_W = 900
DEFAULT_EPS = 0.9

# 輸出檔名沿用來源檔名(ink-war-letter.svg),不另取別名 ——
# 素材的權威名字是 world.json 的 id,多一套對照表就多一處會走鐘。

# ── marching squares 的方向表 ────────────────────────────────────────────
# 格子四角的位元(左上=1 右上=2 右下=4 左下=8),邊中點:
#   T 上邊 (x+0.5, y)   R 右邊 (x+1, y+0.5)   B 下邊 (x+0.5, y+1)   L 左邊 (x, y+0.5)
#
# 每段都是**有向**的,方向一致是能不能串成環的關鍵 —— 這正是上一版壞掉的地方:
# 方向不一致的話,相鄰格子的段接不起來,整條輪廓會碎成兩三點的殘段。
# 一致性怎麼來的:先定 code=1(只有左上有墨)為 L→T,其餘三個單角由順時針旋轉
# 得到;三角(單角的補集)方向相反;兩角相鄰的由兩個單角合併;對角兩段各走各的。
T, R, B, L = 0, 1, 2, 3
OFFSET = ((0.5, 0.0), (1.0, 0.5), (0.5, 1.0), (0.0, 0.5))
CASES = {
    1: ((L, T),),
    2: ((T, R),),
    4: ((R, B),),
    8: ((B, L),),
    14: ((T, L),),
    13: ((R, T),),
    11: ((B, R),),
    7: ((L, B),),
    3: ((L, R),),
    6: ((T, B),),
    12: ((R, L),),
    9: ((B, T),),
    5: ((L, T), (R, B)),
    10: ((T, R), (B, L)),
}


def mask_of(im, threshold=128):
    """回傳 (w, h, bits),bits 是**四周各補一圈 0** 的 (w+2)×(h+2) 位元圖。

    補邊有兩個好處:走格子時不必做邊界檢查(內圈迴圈快很多),
    而且裁切到 bbox 後貼著邊緣的筆畫也會被外圈的 0 包起來,環一定閉合。
    """
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    alpha = im.split()[-1]
    # 墨可能畫在 alpha 上(去背 PNG),也可能畫在亮度上(黑字白底)。
    # 看 alpha 有多少不是全不透明:幾乎全滿 → 這張圖靠亮度表達,改用反相亮度。
    transparent = sum(1 for v in alpha.tobytes() if v < 250)
    src = alpha if transparent > im.width * im.height * 0.02 else \
        im.convert("L").point(lambda v: 255 - v)

    w, h = src.size
    raw = src.tobytes()
    pw = w + 2
    bits = bytearray(pw * (h + 2))
    for y in range(h):
        row = raw[y * w:(y + 1) * w]
        out = (y + 1) * pw + 1
        for x in range(w):
            if row[x] >= threshold:
                bits[out + x] = 1
    return w, h, bits


def contours(w, h, bits):
    """Marching squares。回傳一串閉合環,每環是 [(x, y), …],座標已扣掉補邊。

    頂點取在邊的中點,所以輸出落在半格上 —— 對毛筆這種軟邊來說,
    比直接走像素角點平滑一階。
    """
    pw = w + 2
    cases = CASES
    offset = OFFSET

    # 有向段:起點 → 終點。每個邊中點恰好被兩個格子共用,
    # 一個把它當起點、一個當終點,所以出度入度都是 1,天然是乾淨的環。
    nxt = {}
    for y in range(h + 1):
        base = y * pw
        below = base + pw
        for x in range(w + 1):
            code = bits[base + x] | (bits[base + x + 1] << 1) | \
                (bits[below + x + 1] << 2) | (bits[below + x] << 3)
            segs = cases.get(code)
            if segs is None:
                continue
            for a, b in segs:
                oa = offset[a]
                ob = offset[b]
                nxt[(x + oa[0], y + oa[1])] = (x + ob[0], y + ob[1])

    loops = []
    while nxt:
        start = next(iter(nxt))
        loop = [start]
        cur = nxt.pop(start)
        while cur != start:
            loop.append(cur)
            step = nxt.pop(cur, None)
            if step is None:      # 不該發生;真的發生就丟掉這條殘鏈
                break
            cur = step
        if len(loop) >= 12:
            loops.append([(px - 1.0, py - 1.0) for px, py in loop])
    return loops


def smooth(loop, passes=2):
    """相鄰三點加權平均。把 marching squares 的階梯磨掉,毛筆邊才不會鋸。"""
    pts = loop
    n = len(pts)
    for _ in range(passes):
        out = [None] * n
        prev = pts[-1]
        cur = pts[0]
        for i in range(n):
            nx = pts[(i + 1) % n]
            out[i] = ((prev[0] + 2.0 * cur[0] + nx[0]) * 0.25,
                      (prev[1] + 2.0 * cur[1] + nx[1]) * 0.25)
            prev = cur
            cur = nx
        pts = out
    return pts


def area(pts):
    """鞋帶公式的絕對值。用來丟掉掃描雜訊留下的針孔。"""
    s = 0.0
    x0, y0 = pts[-1]
    for x1, y1 in pts:
        s += x0 * y1 - x1 * y0
        x0, y0 = x1, y1
    return abs(s) * 0.5


def rdp(points, eps):
    """Ramer–Douglas–Peucker。毛筆邊緣的轉折留著,直線段收掉。"""
    n = len(points)
    if n < 4:
        return points
    keep = bytearray(n)
    keep[0] = keep[n - 1] = 1
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        ax, ay = points[i]
        bx, by = points[j]
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5 or 1.0
        best, bi = eps, -1
        c = bx * ay - by * ax
        for k in range(i + 1, j):
            px, py = points[k]
            d = abs(dy * px - dx * py + c) / norm
            if d > best:
                best, bi = d, k
        if bi >= 0:
            keep[bi] = 1
            stack.append((i, bi))
            stack.append((bi, j))
    return [p for p, k in zip(points, keep) if k]


def to_svg(loops, w, h, eps, min_area):
    parts = []
    for loop in loops:
        if area(loop) < min_area:
            continue
        pts = rdp(smooth(loop), eps)
        if len(pts) < 3:
            continue
        head = pts[0]
        d = ["M%.1f %.1f" % head]
        d += ["L%.1f %.1f" % p for p in pts[1:]]
        d.append("Z")
        parts.append("".join(d))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
        'fill="currentColor" fill-rule="evenodd" aria-hidden="true">'
        '<path d="%s"/></svg>'
    ) % (w, h, "".join(parts))


def trace_image(im, max_w=DEFAULT_MAX_W, eps=DEFAULT_EPS, crop=True):
    """一張已開啟的 RGBA 圖 → SVG 字串。

    抽出來是為了讓別的腳本(拆皮影關節那支)共用同一套描邊,
    而不是複製一份幾何程式碼 —— 兩份遲早會漂。
    """
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    if crop:
        bbox = im.split()[-1].getbbox()
        if bbox and bbox[2] - bbox[0] > 8 and bbox[3] - bbox[1] > 8:
            im = im.crop(bbox)
    if im.width > max_w:
        im = im.resize((max_w, max(1, round(im.height * max_w / im.width))),
                       Image.LANCZOS)
    w, h, bits = mask_of(im)
    loops = contours(w, h, bits)
    return to_svg(loops, w, h, eps, min_area=(w * h) * 0.00002), w, h, len(loops)


def main():
    SRC = sys.argv[1]
    DST = sys.argv[2]
    MAX_W = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_MAX_W
    EPS = float(sys.argv[4]) if len(sys.argv) > 4 else DEFAULT_EPS

    os.makedirs(DST, exist_ok=True)
    total = 0
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith(".png"):
            continue
        stem = f[:-4]
        out_name = stem + ".svg"

        # 先裁掉四周空白,再縮到工作寬度 —— 描邊成本與像素數成正比,
        # 而且裁掉留白後 viewBox 才貼著字,排版時不必再猜邊距。
        svg, w, h, nloops = trace_image(Image.open(os.path.join(SRC, f)), MAX_W, EPS)

        path = os.path.join(DST, out_name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(svg)
        size = os.path.getsize(path)
        total += size
        print("%-26s -> %-16s %dx%d loops=%-4d %5.1fKB"
              % (f, out_name, w, h, nloops, size / 1024))
    print("total %.1fKB" % (total / 1024))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""把「平底色上的一個物件」鍵成去背 PNG／WebP。

素材庫裡有一批是直接放在灰底或白底上的（透明度 0%），
當前景用會看到一塊方形色塊。這支把底色鍵掉。

做法不是「顏色接近就刪」—— 那會把物件身上同色的部分一起挖穿
（雪松的雪、白旗的布，跟灰底幾乎同色）。
改成從四邊往內**漫延**：只有從畫布邊緣連得過去的像素才算背景，
被物件包住的同色區塊碰不到邊，就留下來。

用法：
    python tools/cutout.py <來源> <輸出> [--tol 26] [--feather 1.2]
"""
import argparse
import os
import sys
from collections import deque

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('需要 Pillow：pip install pillow')


def cut(src, tol=26, feather=1.2, shrink=1, holes=0.0005):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()

    # 背景色取四角的中位數 —— 取平均會被某一角壓到的物件帶偏
    corners = [px[1, 1], px[w - 2, 1], px[1, h - 2], px[w - 2, h - 2]]
    bg = tuple(sorted(c[i] for c in corners)[len(corners) // 2] for i in range(3))

    near = lambda p: abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) <= tol * 3

    # 從四邊灌進去。只有連得到邊緣的同色像素才是背景。
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near(px[x, y]): seen[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if near(px[x, y]) and not seen[y * w + x]: seen[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and near(px[nx, ny]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))

    # 第二趟：被物件包住的空隙（枝椏之間、旗與桿之間）碰不到邊緣，漫延進不去。
    # 把剩下的同色像素做連通區，夠大的就一起清掉 —— 那是背景的洞。
    # 小斑點留著：那多半是物件邊緣的反鋸齒，清掉會把邊咬出缺口。
    if holes:
        minA = max(64, int(w * h * holes))
        for y0 in range(h):
            for x0 in range(w):
                i0 = y0 * w + x0
                if seen[i0] or not near(px[x0, y0]):
                    continue
                comp, q2 = [], deque([(x0, y0)])
                seen[i0] = 2
                while q2:
                    x, y = q2.popleft(); comp.append(y * w + x)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and near(px[nx, ny]):
                            seen[ny * w + nx] = 2
                            q2.append((nx, ny))
                if len(comp) < minA:
                    for i in comp:
                        seen[i] = 0

    mask = Image.frombytes('L', (w, h), bytes(255 if v else 0 for v in seen))
    # 往物件方向收一點：去背邊緣通常還沾著一圈底色
    if shrink:
        mask = mask.filter(ImageFilter.MaxFilter(1 + 2 * shrink))
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    alpha = mask.point(lambda v: 255 - v)
    im.putalpha(alpha)
    return im, bg


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--tol', type=int, default=26)
    ap.add_argument('--feather', type=float, default=1.2)
    ap.add_argument('--shrink', type=int, default=1)
    ap.add_argument('--holes', type=float, default=0.0005,
                    help='補洞門檻，佔全圖的比例。0 = 只做邊緣漫延')
    ap.add_argument('--max', type=int, default=0, help='最長邊上限，0 = 不縮')
    ap.add_argument('--q', type=int, default=84)
    a = ap.parse_args()

    im, bg = cut(a.src, a.tol, a.feather, a.shrink, a.holes)
    if a.max:
        im.thumbnail((a.max, a.max), Image.LANCZOS)
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    if a.out.lower().endswith('.webp'):
        im.save(a.out, 'WEBP', quality=a.q, method=6)
    else:
        im.save(a.out)
    clear = sum(1 for v in im.getchannel('A').resize((48, 48)).getdata() if v < 16) / 2304
    print('%-34s 底色 rgb%s  %s  透明 %.0f%%  %.0fKB'
          % (os.path.basename(a.out), bg, im.size, clear * 100, os.path.getsize(a.out) / 1024))

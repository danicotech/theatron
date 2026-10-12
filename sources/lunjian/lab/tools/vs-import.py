# -*- coding: utf-8 -*-
"""把一張「黑墨白紙」的 VS 真跡轉成頁面能直接用的 art/vs-ink.png。

為什麼要轉：頁面的底是暗的，真跡的底是亮的。
執行期沒辦法把紙去掉 —— invert + mix-blend-mode 那條路走不通，因為
.chapter-sticky 是 position:sticky，自成一個堆疊脈絡，混色模式碰不到底下
#stage 那層場景，結果就是一塊黑方塊蓋在畫面上。
所以透明度要先寫進檔案裡：紙 → 全透明，墨 → 不透明，中間的淡墨照比例留。

用法：
    python tools/vs-import.py "../../../../ChatGPT Image09_16_02.png"
    python tools/vs-import.py <圖> --cx .465 --cy .44 --half .20 --floor .30

轉完會另外存一張 shots/_vs-import.png 預覽（壓在暗底上），先看過再說。
"""
import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('需要 Pillow：pip install pillow')

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('src', help='真跡圖檔')
ap.add_argument('--cx', type=float, default=0.465, help='VS 中心 x（佔全寬的比例）')
ap.add_argument('--cy', type=float, default=0.44, help='VS 中心 y（佔全高的比例）')
ap.add_argument('--half', type=float, default=0.20,
                help='方框半邊長，以全寬為單位。調大裁得鬆，調小裁得緊')
ap.add_argument('--floor', type=float, default=0.30,
                help='紙的門檻。亮度高於 1−floor 的一律當成紙，直接透明')
ap.add_argument('--gamma', type=float, default=0.80,
                help='<1 讓筆畫更實，>1 讓淡墨更淡')
ap.add_argument('--ink', default='#f1e9d8', help='墨在暗底上要呈現的顏色')
ap.add_argument('--feather', type=float, default=0.80,
                help='從框邊往內羽化的起點（0–1）。'
                     '不做的話，殘留的淡墨會沿著裁框連成一個看得見的方塊')
ap.add_argument('--out', default=os.path.join(LAB, 'art/vs-ink.png'))
a = ap.parse_args()

im = Image.open(a.src).convert('RGB')
W, H = im.size

half = a.half * W
box = (round(a.cx * W - half), round(a.cy * H - half),
       round(a.cx * W + half), round(a.cy * H + half))
# 框可能超出邊界，往內夾回來，寧可裁小也不要補黑邊
box = (max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3]))
crop = im.crop(box)

lum = crop.convert('L')
ink = tuple(int(a.ink.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))

# alpha：亮度反過來當不透明度，再減掉紙的門檻重新拉滿
lut = []
for v in range(256):
    t = 1.0 - v / 255.0                       # 0 = 紙，1 = 濃墨
    t = (t - a.floor) / (1.0 - a.floor)
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    lut.append(round((t ** a.gamma) * 255))
alpha = lum.point(lut)

# 羽化：裁框一定會從畫面中間切一刀，切口上殘留的淡墨會連成一條直邊，
# 在暗底上就是一個方塊。所以靠近框邊的 alpha 要自己收掉。
# 用方框距離（max(|x|,|y|)）而不是半徑，圓形會把 S 的尾巴切掉。
if a.feather < 1.0:
    cw, ch = crop.size
    fade = Image.new('L', crop.size)
    px = fade.load()
    f0, span = a.feather, max(1e-6, 1.0 - a.feather)
    for y in range(ch):
        ny = abs(y / (ch - 1) * 2 - 1)
        for x in range(cw):
            nx = abs(x / (cw - 1) * 2 - 1)
            d = nx if nx > ny else ny
            t = 1.0 if d <= f0 else max(0.0, 1.0 - (d - f0) / span)
            px[x, y] = round(t * t * (3 - 2 * t) * 255)      # smoothstep
    from PIL import ImageChops
    alpha = ImageChops.multiply(alpha, fade)

out = Image.new('RGBA', crop.size, ink + (255,))
out.putalpha(alpha)
os.makedirs(os.path.dirname(a.out), exist_ok=True)
out.save(a.out)

prev = Image.new('RGBA', crop.size, (17, 25, 37, 255))
prev.alpha_composite(out)
prev_path = os.path.join(LAB, 'shots/_vs-import.png')
prev.convert('RGB').save(prev_path)

print(f'來源  {os.path.basename(a.src)}  {W}×{H}')
print(f'裁框  {box}  →  {crop.size[0]}×{crop.size[1]}')
print(f'輸出  {os.path.relpath(a.out, LAB)}')
print(f'預覽  {os.path.relpath(prev_path, LAB)}')

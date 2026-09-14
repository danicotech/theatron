"""把 duel-shadows.png 拆成左右兩個皮影剪影,各自描成 SVG。

為什麼要拆:第一幕是漫畫分鏡,五格各有一組取景與位移。兩人黏在一張圖上就只能
整張移動,做不出「靠攏 = 交鋒、拉開 = 劍離」。

為什麼不能用連通區域拆:兩人的 alpha 是**連通的** —— 劍鋒相交處把他們接在一起。
改量每一欄的墨量,中段會出現乾淨的雙峰,谷底(佔畫面 40–62%,墨量只有峰值的 2%)
就是切的地方。切在那裡,兩半各自留著自己的劍尖指向中間。

**兩件共用同一個 viewBox。** 各自裁到自己的 bbox 會丟掉原始座標,之後就無從知道
「原位」在哪,位移也失去基準。所以兩個 SVG 尺寸完全相同,偏移 0 疊起來等於原圖 ——
這是可驗證的,`--check` 會逐像素比對。

用法:
    python theatron/scripts/split-duel.py <來源 png> <輸出資料夾> [工作寬度]
"""

import importlib.util
import json
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_WORK_W = 760

# 共用同目錄的描邊器,不複製一份幾何程式碼 —— 兩份遲早會漂。
_spec = importlib.util.spec_from_file_location(
    "trace_ink", os.path.join(HERE, "trace-ink.py"))
trace_ink = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(trace_ink)


def ink_profile(alpha, threshold=40):
    """每一欄的墨量。"""
    w, h = alpha.size
    px = alpha.load()
    return [sum(1 for y in range(h) if px[x, y] >= threshold) for x in range(w)]


def find_seam(profile, lo=0.38, hi=0.62):
    """中段墨量最低的一欄:兩人之間、只剩相交劍身的地方。

    搜尋範圍限在中段,是因為畫面最左與最右本來就沒有墨,
    不限範圍的話最小值會落在畫布邊緣。
    """
    n = len(profile)
    return min(range(int(n * lo), int(n * hi)), key=lambda x: profile[x])


def split(src, dst, work_w=DEFAULT_WORK_W):
    os.makedirs(dst, exist_ok=True)
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.split()[-1].getbbox())
    # 先縮到工作尺寸再拆,兩半就一定同尺度
    im = im.resize((work_w, max(1, round(im.height * work_w / im.width))),
                   Image.LANCZOS)
    w, h = im.size

    prof = ink_profile(im.split()[-1])
    seam = find_seam(prof)
    peak = max(prof)
    # 切在谷底正中會把相交的劍身剖開,兩邊各多帶一點,兩把劍才都保有劍尖。
    overlap = round(w * 0.02)

    manifest = {
        "source": str(src).replace("\\", "/"),
        "viewBox": [w, h],
        "seam": seam,
        "seamInkRatio": round(prof[seam] / peak, 4),
        "overlap": overlap,
        "parts": {},
    }

    for name, (x0, x1) in (("duel-left", (0, seam + overlap)),
                           ("duel-right", (seam - overlap, w))):
        # 在原尺寸畫布上遮掉另一半,而不是裁切 —— 保住共用座標系
        part = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        part.paste(im.crop((x0, 0, x1, h)), (x0, 0))
        svg, sw, sh, nloops = trace_ink.trace_image(part, max_w=w, eps=0.8, crop=False)
        path = os.path.join(dst, name + ".svg")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(svg)
        manifest["parts"][name] = {
            "file": "/shadow/" + name + ".svg",
            "bbox": list(part.split()[-1].getbbox()),
            "loops": nloops,
            "bytes": os.path.getsize(path),
        }
        print("%-11s viewBox %dx%d 環=%-3d %5.1fKB"
              % (name, sw, sh, nloops, os.path.getsize(path) / 1024))

    print("谷底 x=%d(%.1f%%),墨量是峰值的 %.0f%%"
          % (seam, seam / w * 100, manifest["seamInkRatio"] * 100))
    with open(os.path.join(dst, "duel.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return manifest


if __name__ == "__main__":
    split(sys.argv[1], sys.argv[2],
          int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_WORK_W)

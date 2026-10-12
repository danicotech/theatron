# -*- coding: utf-8 -*-
"""從心法卡的底色推出品階。

來源網站的資料表把 quality 全寫成 0，等於沒有這一欄。
但卡面本身帶著品階：底色是金、紫或藍。所以不是去猜，是去量 ——
取卡面下半部一塊避開圖示與文字的區域，算平均色相。

金 ≈ 45°、紫 ≈ 265°、藍 ≈ 225°（HSV 色相，0–360）。
"""
import colorsys, io, json, os
from PIL import Image

def tier_of(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    # 下半部、左右各留 18%：避開中央的名稱與上方的圖示
    box = (int(w * .18), int(h * .60), int(w * .82), int(h * .80))
    px = im.crop(box).resize((24, 10), Image.LANCZOS)
    hs, ss, vs = [], [], []
    for r, g, b in px.getdata():
        hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if v < .05: continue          # 純黑沒有色相可言
        hs.append(hh * 360); ss.append(s); vs.append(v)
    if not hs: return None, None
    # 色相要用向量平均，直接算術平均會在 0°／360° 交界處出錯
    import math
    x = sum(math.cos(math.radians(a)) for a in hs) / len(hs)
    y = sum(math.sin(math.radians(a)) for a in hs) / len(hs)
    hue = (math.degrees(math.atan2(y, x)) + 360) % 360
    sat = sum(ss) / len(ss)
    return hue, sat

def classify(hue, sat):
    if hue is None: return 'unknown'
    if sat < .12: return '藍'                 # 幾乎沒有彩度的都是最低階
    if 20 <= hue <= 70: return '金'
    if 240 <= hue <= 300: return '紫'
    if 190 <= hue < 240: return '藍'
    return '藍'

if __name__ == '__main__':
    man = json.load(io.open('manifest.json', encoding='utf-8'))
    from collections import Counter
    cnt = Counter()
    for m in man['minds']:
        if not m.get('img'):
            m['tier'] = None; continue
        hue, sat = tier_of(m['img'].replace('/', os.sep))
        m['tier'] = classify(hue, sat)
        m['tierHue'] = None if hue is None else round(hue)
        m['tierSat'] = None if sat is None else round(sat, 3)
        cnt[m['tier']] += 1
    io.open('manifest.json', 'w', encoding='utf-8').write(json.dumps(man, ensure_ascii=False, indent=1))
    print('品階分布:', dict(cnt))
    for t in ('金', '紫', '藍'):
        names = [m['name'] for m in man['minds'] if m.get('tier') == t]
        print(' %s(%d): %s' % (t, len(names), '、'.join(names[:14])))

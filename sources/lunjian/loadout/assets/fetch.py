# -*- coding: utf-8 -*-
"""把 yysls-assistant CDN 上的武學／心法／兵器譜圖示抓下來。

素材著作權屬網易，這裡只是把公開 CDN 上的檔案取回本地。
正式對外發布前要自己確認授權，這支腳本不處理那件事。
"""
import io, json, os, time, urllib.request

BASE = 'https://cos.yysls-assistant.cn'
OUT = os.path.abspath('../../Documents/code/designhtml/desginhtml/scrollcraft/builds/lunjian/assets-yysls')
OUT = r'C:\Users\User\Documents\code\designhtml\desginhtml\scrollcraft\builds\lunjian\assets-yysls'
d = json.load(io.open('data.json', encoding='utf-8'))

jobs = []
for m in d['minds']:    jobs.append(('mind',    m['key']))
for m in d['martials']: jobs.append(('martial', m['key']))
for b in d['builds']:   jobs.append(('martial', b['key']))
for fam in sorted({b['key'].split('_')[0] for b in d['builds']}):
    jobs.append(('arsenal', fam))

ok = bad = skip = 0
for folder, key in jobs:
    dst = os.path.join(OUT, folder, key + '.png')
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        skip += 1; continue
    url = f'{BASE}/{folder}/{key}.png'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://yysls-assistant.cn/'})
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read()
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        io.open(dst, 'wb').write(body)
        ok += 1
    except Exception as e:
        bad += 1
        print('  缺 %-9s %-22s %s' % (folder, key, getattr(e, 'code', e)))
    time.sleep(0.05)
print('取得 %d　已有 %d　抓不到 %d' % (ok, skip, bad))

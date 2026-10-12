# -*- coding: utf-8 -*-
"""從 yysls-assistant 的前端 bundle 抽出武學／心法／流派的資料表。

為什麼從 bundle 抽而不是爬畫面：那是一個 Vue SPA，畫面上的東西是這份表算出來的。
直接拿表，一次就齊，而且帶著畫面上看不到的欄位 —— 心法的 quality（品質）
就是其中之一，那正是排序要用的。
"""
import io, json, re

s = io.open('all.txt', encoding='utf-8', errors='replace').read()

def grab(pattern):
    """把 {key:"X",...} 這種物件字面量一筆一筆撈出來，用括號配對找結尾。"""
    out = []
    for m in re.finditer(pattern, s):
        i = m.start()
        depth, j = 0, i
        while j < len(s):
            if s[j] == '{': depth += 1
            elif s[j] == '}':
                depth -= 1
                if depth == 0: break
            j += 1
        out.append(s[i:j+1])
    return out

def fields(txt):
    d = {}
    for k, v in re.findall(r'([A-Za-z]+):"([^"]*)"', txt):
        d[k] = v
    for k, v in re.findall(r'([A-Za-z]+):(\d+)', txt):
        d.setdefault(k, int(v))
    return d

minds, martials = {}, {}
# 同一個 key 會在不同 chunk 各出現一次，欄位不一定一樣多。
# 合併而不是覆蓋 —— 直接覆蓋會被欄位少的那一筆蓋掉（quality 就是這樣不見的）。
def merge(store, f):
    if 'key' not in f: return
    store.setdefault(f['key'], {}).update({k: v for k, v in f.items() if v != ''})

for t in grab(r'\{key:"XF_[A-Z0-9_]+"'):
    merge(minds, fields(t))
for t in grab(r'\{key:"[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"'):
    f = fields(t)
    if f.get('key','').startswith('XF_'): continue
    if 'buildKey' in f or 'equipmentKey' in f: merge(martials, f)

builds = {}
for m in re.finditer(r'([A-Z][A-Z_]+):\{label:"([^"]+)",requiredMindKeys:\[([^\]]*)\],optionalMindKeys:\[([^\]]*)\]', s):
    k, label, req, opt = m.groups()
    ids = lambda x: re.findall(r'"([^"]+)"', x)
    builds[k] = {'key': k, 'label': label, 'requiredMindKeys': ids(req), 'optionalMindKeys': ids(opt)}

data = {'minds': list(minds.values()), 'martials': list(martials.values()), 'builds': list(builds.values())}
io.open('data.json','w',encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=1))
print('心法 %d　武學 %d　流派 %d' % (len(minds), len(martials), len(builds)))
from collections import Counter
print('心法品質分布:', dict(sorted(Counter(m.get('quality',-1) for m in minds.values()).items())))
print('武學武器分布:', dict(Counter(m.get('equipmentKey','?').replace('EQUIPMENT_WEAPON_','') for m in martials.values()).most_common()))

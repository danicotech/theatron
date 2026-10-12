# -*- coding: utf-8 -*-
"""把備戰方案配置器從 lab 生成進 theatron。

跟 `to-theatron.py` 同一個道理，也同一條規矩：**lab 是唯一來源**。
`lab/loadout.html` 是版面與視覺的正本，theatron 那一份是生成物。
手抄一份到 React 只會立刻分岔 —— 改了一邊忘了另一邊，
兩個月後沒人知道哪一份才算數。改版面請改 lab 再重跑這支。

（`lab/loadout.html` 檔頭原本寫著「定案後搬成 features/loadout/*.tsx
並把這個檔刪掉」。那句話比 MERGE.md 早，MERGE.md 訂的規矩蓋過它。）

生成四樣：

    theatron/web/public/loadout/loadout.css        ← <style> 整段
    theatron/web/public/loadout/loadout.js         ← 原樣複製，只改兩個路徑常數
    theatron/web/public/loadout/build-note.js      ← 原樣複製
    theatron/web/src/app/loadout/loadoutMarkup.ts  ← <body> 標記，一個字串常數

外加素材與資料：

    public/loadout/assets/    161 檔
    public/loadout/data/      catalog.json

路徑要改寫。lab 裡寫的是 `../loadout/assets/`，相對的是 lab 那個目錄；
搬到 theatron 之後頁面在 `/loadout`，那串會解析到 `/loadout/../loadout/assets/`。
CSS 與 JS 兩邊各有一組要前綴。

`loadout.js` 是 ES module，裡面 `import './build-note.js?v=…'` 是相對於
**它自己**（`/loadout/loadout.js`），會解析成 `/loadout/build-note.js`，
所以那一行不用動。

用法：python tools/loadout-to-theatron.py
"""
import hashlib
import io
import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)
SRC = os.path.abspath(os.path.join(LAB, '../loadout'))          # 素材與資料的家
TH = os.path.abspath(os.path.join(LAB, '../../../../theatron/web'))
PUB = os.path.join(TH, 'public/loadout')
APP = os.path.join(TH, 'src/app/loadout')

# lab 裡的相對路徑 → 搬進 theatron 之後的絕對路徑
OLD, NEW = '../loadout/', '/loadout/'

html = io.open(os.path.join(LAB, 'loadout.html'), encoding='utf-8').read()

# ── 拆兩塊 ────────────────────────────────────────────────────────────────
m = re.search(r'<style>(.*?)</style>', html, re.S)
assert m, '找不到 <style>'
css = m.group(1).replace('url(' + OLD, 'url(' + NEW)

m = re.search(r'<body[^>]*>(.*?)</body>', html, re.S)
assert m, '找不到 <body>'
markup = m.group(1)
# 標記裡不留 <script>／<style>：那兩樣由 LoadoutRuntime 與 page.tsx 自己掛。
# innerHTML 塞進去的 <script> 本來就不會執行（HTML 規範明訂），留著只是誤導。
markup = re.sub(r'<script[\s\S]*?</script>\s*', '', markup)
markup = re.sub(r'<style[\s\S]*?</style>\s*', '', markup)
markup = markup.replace('"' + OLD, '"' + NEW).replace("'" + OLD, "'" + NEW)

os.makedirs(PUB, exist_ok=True)
os.makedirs(APP, exist_ok=True)
io.open(os.path.join(PUB, 'loadout.css'), 'w', encoding='utf-8', newline='\n').write(css)

# ── 兩支 JS ───────────────────────────────────────────────────────────────
# 只改資產與資料那兩個路徑常數。改到別的地方就代表 lab 與這份會有行為差異，
# 那正是生成腳本要避免的事，所以兩處都斷言一定要命中。
js = io.open(os.path.join(LAB, 'loadout.js'), encoding='utf-8').read()
for a, b in [("'" + OLD + "assets/'", "'" + NEW + "assets/'"),
             ("fetch('" + OLD + "data/catalog.json', {signal:lifetime.signal})", "fetch('" + NEW + "data/catalog.json', {signal:lifetime.signal})")]:
    assert js.count(a) == 1, '路徑常數找不到或不只一處：%s' % a
    js = js.replace(a, b)
io.open(os.path.join(PUB, 'loadout.js'), 'w', encoding='utf-8', newline='\n').write(js)
shutil.copy2(os.path.join(LAB, 'build-note.js'), os.path.join(PUB, 'build-note.js'))
# Registration reads the same role format and projection as the standalone editor.
feature = os.path.join(TH, 'src/features/sportsbook')
for source, target in [('build-note.js', 'loadoutNoteRuntime.js'), ('registration-roles.js', 'registrationRolesRuntime.js')]:
    content = io.open(os.path.join(LAB, source), encoding='utf-8').read()
    content = content.replace("'./build-note.js'", "'./loadoutNoteRuntime.js'")
    io.open(os.path.join(feature, target), 'w', encoding='utf-8', newline='\n').write('// Generated from lab/' + source + '; do not edit.\n' + content)


# ── 標記 ──────────────────────────────────────────────────────────────────
# 破快取用的版本。lab 那一份靠 <script src="./loadout.js?v=…">，
# theatron 這邊的網址是固定的 —— 沒有這個，重新生成之後瀏覽器可能
# 繼續跑舊的那支 js／css，畫面看起來就是「按了沒反應」。
# 用內容的雜湊不用時間戳：內容沒變就不換版本，不必每次重跑都讓所有人重載 5 MB。
stamp = hashlib.sha256((css + js + markup).encode('utf-8')).hexdigest()[:10]

ts = (
    '// 由 scrollcraft/builds/lunjian/lab/tools/loadout-to-theatron.py 生成，不要手改。\n'
    '// 來源是 lab/loadout.html 的 <body>；改版面請改那一份再重跑腳本。\n'
    'export const LOADOUT_MARKUP = String.raw`'
    + markup.replace('`', '\`').replace('${', '$\{') + '`;\n'
    + '\n// 內容雜湊，給 <link> 與 <script> 當 ?v= 破快取用。\n'
    + 'export const LOADOUT_VERSION = "' + stamp + '";\n'
)
io.open(os.path.join(APP, 'loadoutMarkup.ts'), 'w', encoding='utf-8', newline='\n').write(ts)

# ── 素材與資料 ────────────────────────────────────────────────────────────
copied = 0
for rel in ['assets', 'data']:
    s0, d0 = os.path.join(SRC, rel), os.path.join(PUB, rel)
    assert os.path.isdir(s0), '找不到 %s' % s0
    if os.path.isdir(d0):
        shutil.rmtree(d0)
    # _src 是轉檔前的原圖，不上線
    shutil.copytree(s0, d0, ignore=shutil.ignore_patterns('_src'))
    copied += sum(len(f) for _, _, f in os.walk(d0))

size = sum(os.path.getsize(os.path.join(r, f))
           for r, _, fs in os.walk(PUB) for f in fs)
print('版本   %s' % stamp)
print('CSS    %6.0f KB' % (len(css.encode()) / 1024))
print('JS     %6.0f KB' % (len(js.encode()) / 1024))
print('標記   %6.0f KB' % (len(markup.encode()) / 1024))
print('素材   %d 檔' % copied)
print('合計   %.1f MB → %s' % (size / 1048576, os.path.relpath(PUB, TH)))

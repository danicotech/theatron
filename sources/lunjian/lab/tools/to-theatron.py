# -*- coding: utf-8 -*-
"""把 lab 的單檔版面移植進 theatron。

lab（`lunjian-layout.html`）是版面與視覺的**唯一來源**。手動把它抄進 React
只會立刻分岔：改了一邊忘了另一邊，兩個月後沒人知道哪一份才算數。
所以這裡用腳本生成，改完 lab 就重跑一次。

生成三樣東西：

    theatron/web/public/lunjian/lunjian.css   ← <style> 整段
    theatron/web/public/lunjian/lunjian.js    ← 主驅動 <script> 整段
    theatron/web/src/app/lunjianMarkup.ts     ← <body> 的標記，一個字串常數

外加把 lab 的執行期素材（art/、type/、glyphs.json、vendor/、四支 js）
複製到 `public/lunjian/`。

路徑要改寫：lab 裡寫的是 `art/bg/x.webp` 這種相對路徑，相對的是那一頁自己；
搬到 theatron 之後頁面在 `/`，相對路徑會解析到 `/art/bg/x.webp` 而不是
`/lunjian/art/bg/x.webp`。所以 HTML、CSS、JS 三邊的資產路徑都要前綴。

用法：python tools/to-theatron.py
"""
import io
import hashlib
import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)
TH = os.path.abspath(os.path.join(LAB, '../../../../theatron/web'))
PUB = os.path.join(TH, 'public/lunjian')
BASE = '/lunjian/'

src = io.open(os.path.join(LAB, 'lunjian-layout.html'), encoding='utf-8').read()

# ── 拆三塊 ────────────────────────────────────────────────────────────────
css = re.search(r'<style>(.*?)</style>', src, re.S)
assert css, '找不到 <style>'
css = css.group(1)
for extra_css in ['bracket-tree.css', 'arena-ticket.css', 'bracket-editor.css']:
    css += '\n' + io.open(os.path.join(LAB, extra_css), encoding='utf-8').read()

# 主驅動是最長的那個內聯 <script>（沒有 src、沒有 type）
inline = [m for m in re.finditer(r'<script>(.*?)</script>', src, re.S)]
assert inline, '找不到內聯 <script>'
driver = max(inline, key=lambda m: len(m.group(1)))
js = driver.group(1)

body = re.search(r'<body[^>]*>(.*?)</body>', src, re.S)
assert body, '找不到 <body>'
markup = body.group(1)
# 標記裡不留任何 <script>／<style>：那兩樣由 theatron 自己掛
markup = re.sub(r'<script[\s\S]*?</script>\s*', '', markup)
markup = re.sub(r'<style[\s\S]*?</style>\s*', '', markup)

# ── 路徑前綴 ──────────────────────────────────────────────────────────────
# 只改資產，不改錨點（#id）、不改絕對路徑（/jz 那一套已經在 public 根）
ASSETS = ('art/', 'type/', 'vendor/')
GLYPH_REVISION = hashlib.sha256(open(os.path.join(LAB, 'glyphs.json'), 'rb').read()).hexdigest()[:12]
TITLE_REVISION = hashlib.sha256(open(os.path.join(LAB, 'chapter-titles.js'), 'rb').read()).hexdigest()[:12]


def prefix(text, quote_chars='"\'()'):
    out = text
    for a in ASSETS:
        for q in quote_chars:
            out = out.replace(q + a, q + BASE + a)
    for q in quote_chars:
        out = out.replace(q + 'glyphs.json', q + BASE + 'glyphs.json?v=' + GLYPH_REVISION)
    out = out.replace("'./chapter-titles.js'", "'" + BASE + 'chapter-titles.js?v=' + TITLE_REVISION + "'")
    for module in ['bracket-tree.js', 'arena-ticket.js', 'bracket-editor.js', 'boot-symbol.js']:
        module_revision = hashlib.sha256(open(os.path.join(LAB, module), 'rb').read()).hexdigest()[:12]
        out = out.replace("'./" + module + "'", "'" + BASE + module + '?v=' + module_revision + "'")
    # JS 裡的 './ink-wave.js' 動態 import
    for module in ['ink-wave.js', 'ink-transitions.js']:
        out = out.replace("'./" + module + "'", "'" + BASE + module + "'")
    return out


css = prefix(css)
js = prefix(js)
markup = prefix(markup)

os.makedirs(PUB, exist_ok=True)
io.open(os.path.join(PUB, 'lunjian.css'), 'w', encoding='utf-8', newline='\n').write(css)
io.open(os.path.join(PUB, 'lunjian.js'), 'w', encoding='utf-8', newline='\n').write(js)

revision = hashlib.sha256((css + js + markup + io.open(os.path.join(LAB, 'stage3d.js'), encoding='utf-8').read()).encode('utf-8')).hexdigest()[:12]

ts = (
    '// 由 scrollcraft/builds/lunjian/lab/tools/to-theatron.py 生成，不要手改。\n'
    '// 來源是 lab/lunjian-layout.html 的 <body>；改版面請改那一份再重跑腳本。\n'
    'export const LUNJIAN_REVISION = \"' + revision + '\";\n'
    'export const LUNJIAN_MARKUP = String.raw`' + markup.replace('`', '\\`').replace('${', '$\\{') + '`;\n'
)
io.open(os.path.join(TH, 'src/app/lunjianMarkup.ts'), 'w', encoding='utf-8', newline='\n').write(ts)

# Static public landing page shares the lab source and asset pipeline.
home = io.open(os.path.join(LAB, 'home.html'), encoding='utf-8').read()
header = re.search(r'<header class="site-header">.*?</header>', src, re.S).group(0)
header = re.sub(r'<a data-manager-only.*?</a>', '', header)
header = re.sub(r'<div data-manager-only class="phase-pick".*?</div>', '', header, flags=re.S)
header = re.sub(r'<button[^>]*data-reading-toggle[^>]*>.*?</button>', '<a href="/?view=reading">靜態閱讀</a>', header)
header = header.replace('href="#', 'href="/#')
home = home.replace('<!-- SHARED_HEADER -->', header)
boot = re.search(r'<div id="boot".*?(?=<div id="scene-shade")', src, re.S).group(0)
home = home.replace('<!-- SHARED_BOOT -->', boot)
home_css = prefix(re.search(r'<style>(.*?)</style>', home, re.S).group(1))
home_markup = prefix(re.search(r'<body>(.*?)</body>', home, re.S).group(1))
home_rev = hashlib.sha256((home_css + home_markup + io.open(os.path.join(LAB, 'home-return.js'), encoding='utf-8').read() + io.open(os.path.join(LAB, 'home-intro.js'), encoding='utf-8').read() + io.open(os.path.join(LAB, 'boot-symbol.js'), encoding='utf-8').read() + io.open(os.path.join(LAB, 'stage3d.js'), encoding='utf-8').read() + io.open(os.path.join(LAB, 'home-stage.js'), encoding='utf-8').read()).encode('utf-8')).hexdigest()[:12]
home_dir = os.path.join(TH, 'src/app/home')
os.makedirs(home_dir, exist_ok=True)
io.open(os.path.join(PUB, 'home.css'), 'w', encoding='utf-8').write(home_css)
io.open(os.path.join(home_dir, 'homeMarkup.ts'), 'w', encoding='utf-8').write('// Generated from lab/home.html; do not edit.\nexport const HOME_REVISION = "' + home_rev + '";\nexport const HOME_MARKUP = ' + __import__('json').dumps(home_markup, ensure_ascii=False) + ';\n')

# Shared source for the React judge tree; generated files are never edited by hand.
bracket_js = prefix(io.open(os.path.join(LAB, 'bracket-tree.js'), encoding='utf-8').read())
io.open(os.path.join(TH, 'src/features/bracket/bracketTreeRuntime.js'), 'w', encoding='utf-8', newline='\n').write('// Generated from lab/bracket-tree.js; do not edit.\n' + bracket_js)
io.open(os.path.join(PUB, 'bracket-tree.css'), 'w', encoding='utf-8', newline='\n').write(prefix(io.open(os.path.join(LAB, 'bracket-tree.css'), encoding='utf-8').read()))

# ── 素材 ─────────────────────────────────────────────────────────────────
copied = 0
for rel in ['art', 'type', 'vendor']:
    s0, d0 = os.path.join(LAB, rel), os.path.join(PUB, rel)
    if not os.path.isdir(s0):
        continue
    if os.path.isdir(d0):
        shutil.rmtree(d0)
    # _src 是轉檔前的原圖，不上線
    shutil.copytree(s0, d0, ignore=shutil.ignore_patterns('_src'))
    copied += sum(len(f) for _, _, f in os.walk(d0))
for f in ['boot-symbol.js', 'dossier-demo.json', 'home-stage.js', 'home-intro.js', 'home-return.js', 'glyphs.json', 'brush.js', 'ink-title.js', 'ink-wave.js', 'ink-transitions.js', 'motion-study.html', 'chapter-titles.js', 'bracket-tree.js', 'arena-ticket.js', 'bracket-editor.js', 'stage3d.js']:
    p = os.path.join(LAB, f)
    if os.path.exists(p):
        if f == 'home-intro.js':
            io.open(os.path.join(PUB, f), 'w', encoding='utf-8').write(prefix(io.open(p, encoding='utf-8').read()))
        else:
            shutil.copy2(p, os.path.join(PUB, f))
        copied += 1

# 受維護的布幕覆寫：只同步這支 lab 模組，不重拷整套凍結的 3D 引擎。
cloth_src = io.open(os.path.join(LAB, 'jz/js/cloth.js'), encoding='utf-8-sig').read()
cloth_dst = os.path.realpath(os.path.join(TH, 'public/jz/js/cloth.js'))
public_root = os.path.realpath(os.path.join(TH, 'public'))
assert os.path.commonpath([cloth_dst, public_root]) == public_root
os.makedirs(os.path.dirname(cloth_dst), exist_ok=True)
cloth_src = cloth_src.replace('../../art/curtain-figures.webp', '../../lunjian/art/curtain-figures.webp')
io.open(cloth_dst, 'w', encoding='utf-8', newline='\n').write(cloth_src)

print('CSS    %6.0f KB' % (len(css.encode()) / 1024))
print('JS     %6.0f KB' % (len(js.encode()) / 1024))
print('標記   %6.0f KB' % (len(markup.encode()) / 1024))
print('素材   %d 檔 → %s' % (copied, os.path.relpath(PUB, TH)))

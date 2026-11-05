"""Package the approved battle studies without coupling their page CSS to the live app.

Sources
  * CSS: the approved study (`nav-schedule-preview`) is snapshotted into
    `design/lunjian/battle-study/` so the repository builds without the external
    workspace. When the study is reachable the snapshot is refreshed first.
  * Art: PNG studies are converted to WebP on the way into `web/public/battle-preview/`
    (the originals are 2–3 MB each; the page would otherwise ship ~90 MB of PNG).
    When the study is unreachable the already packaged WebP files are reused.

Set BATTLE_STUDY_ROOT to point at the study explicitly.
"""
from pathlib import Path
import os
import re
import runpy
import shutil

LAB = Path(__file__).resolve().parent.parent
SNAPSHOT = LAB.parent / 'battle-study'
PUBLIC = LAB.parents[2] / 'web' / 'public'
TARGET = PUBLIC / 'battle-preview'
STYLES = ['style.css', 'nav-theme.css', 'battle-layout-frame.css', 'battle-type-mobile.css',
          'battle-production.css', 'battle-preview-layouts.css', 'champion-reference.css',
          'champion-team-reference.css', 'champion-solo-reference.css', 'champion-profile.css']
# Filenames the view module composes at runtime; CSS alone cannot reveal them.
DYNAMIC = (['assets/battle-produced/rank-%s-v1.png' % r for r in ['kaishan', 'duanshui', 'feihua', 'wuwo']]
           + ['assets/battle-produced/%s-paper-desktop-v1.png' % l for l in 'abcdefgh']
           + ['assets/battle-produced/' + n for n in ['moon-mountain-v2.png', 'crown-v1.png', 'team-emblem-red-v1.png', 'team-emblem-blue-v1.png', 'wing-red-v1.png', 'wing-blue-v1.png', 'center-strip-v1.png', 'portrait-empty-v1.png', 'bye-plaque-v1.png', 'mobile-red-panel-v1.png', 'mobile-blue-panel-v1.png', 'action-paper-v1.png', 'pending-unified-ink-v2.png']]
           + ['assets/champion-reference-v2/' + n for n in ['i-wings-v3.png', 'i-moon-ink-v2.png', 'i-laurel-plaque-v2.png',
                                                           'j-wings-v3.png', 'j-champion-backdrop-v4.png', 'j-team-panel-v5.png']])
CONVERT = ('assets/battle-produced/', 'assets/champion-reference-v2/', 'assets/battle-mountain-candidate.png')


def study_root():
    env = os.environ.get('BATTLE_STUDY_ROOT')
    candidates = [Path(env)] if env else []
    candidates += [p / 'nav-schedule-preview' for p in LAB.parents]
    candidates.append(Path.home() / '.codex/.chatgpt-projects/g-p-6accc9140ad881918ef6aa0576d0076c/nav-schedule-preview')
    return next((c for c in candidates if (c / 'battle-layout-frame.css').is_file()), None)


def published(rel):
    """Public path for a study asset: converted folders switch to WebP."""
    return rel[:-4] + '.webp' if rel.endswith('.png') and rel.startswith(CONVERT) else rel


def to_webp(source, target):
    from PIL import Image
    with Image.open(source) as image:
        image.save(target, 'WEBP', quality=82, method=6)


def package_battle():
    study = study_root()
    if study:
        for name in STYLES:
            (SNAPSHOT / name).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(study / name, SNAPSHOT / name)
    chunks, assets = [], set()
    for name in STYLES:
        source = SNAPSHOT / name
        text = source.read_text(encoding='utf-8')

        def url(match):
            value = match[1].strip('"\' ')
            if value.startswith(('data:', 'https:', 'http:', '#')):
                return match[0]
            relative = (Path(name).parent / value.split('?')[0]).as_posix()
            if relative.startswith('..'):
                raise ValueError('Asset outside the approved study: ' + value)
            assets.add(relative)
            return 'url("/battle-preview/' + published(relative) + '")'
        text = re.sub(r'url\(([^)]+)\)', url, text)
        # The host carries data-battle-theme: the page's own [data-theme] rules must never paint it.
        text = re.sub(r'(?:html|:root)\[data-theme=([^\]]+)\]', r':host([data-battle-theme=\1])', text)
        text = text.replace(':root', ':host')
        text = re.sub(r'\bbody\b', '.battle-surface', text)
        chunks.append('/* Approved source: ' + name + ' */\n' + text)
    chunks.append((LAB / 'battle-embed.css').read_text(encoding='utf-8'))
    (PUBLIC / 'lunjian').mkdir(parents=True, exist_ok=True)
    # The scene's shadow root sits inside a zoomed chapter on large screens; --zoom-local still inherits into it.
    unzoom = runpy.run_path(str(Path(__file__).with_name('unzoom.py')))['unzoom']
    (PUBLIC / 'lunjian/battle-art.css').write_text(unzoom('\n'.join(chunks)), encoding='utf-8', newline='\n')
    assets.update(DYNAMIC)
    # Live navigation and chapter shells reference artwork outside the isolated stylesheet.
    live = (LAB / 'battle-live.css').read_text(encoding='utf-8')
    for ref in re.findall(r'/battle-preview/(assets/[^\s\)\'\"]+)', live):
        assets.add(ref[:-5] + '.png' if ref.endswith('.webp') and ref.startswith(CONVERT) else ref)
    # The study subset fonts only cover preview glyphs; the live site keeps its own font stack.
    assets = {a for a in assets if not a.startswith('assets/fonts/')}
    copied = 0
    for relative in sorted(assets):
        target = TARGET / published(relative)
        source = study / relative if study else None
        if source is None or not source.is_file():
            if target.is_file():
                continue
            raise FileNotFoundError('Missing packaged asset and no study to build it from: ' + relative)
        if target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if published(relative) != relative:
            to_webp(source, target)
        else:
            shutil.copy2(source, target)
        copied += 1
    return copied


if __name__ == '__main__':
    print('Packaged battle assets:', package_battle())

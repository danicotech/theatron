"""Save the external canonical runtime source for a standalone checkout; no deletes."""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'scrollcraft/builds/lunjian'
DEST = ROOT / 'sources/lunjian'

if not (SOURCE / 'lab/lunjian-layout.html').is_file():
    raise SystemExit('Canonical lab is missing; keep and use the existing sources/lunjian snapshot.')

files = [SOURCE / 'MERGE.md']
files += [p for p in (SOURCE / 'lab').iterdir()
          if p.is_file() and p.suffix in {'.html', '.js', '.css', '.json', '.md'}
          and '.before-' not in p.name]
for folder in ['lab/art', 'lab/type', 'lab/vendor', 'lab/font', 'lab/jz',
               'lab/preview', 'lab/tools', 'loadout/assets', 'loadout/data']:
    files += [p for p in (SOURCE / folder).rglob('*') if p.is_file()
              and not {'_src', '__pycache__'}.intersection(p.relative_to(SOURCE).parts)]

manifest = {}
for path in sorted(set(files)):
    relative = path.relative_to(SOURCE)
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
    manifest[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
(DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Saved {len(manifest)} source files. No existing files deleted.')

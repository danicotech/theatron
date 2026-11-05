# Derives art/plaque-frame.webp and art/plaque-paper.webp from web/public/navigation-02/plaque.webp.
# The slice values (65 top/bottom, 100 sides) must match the border-image in paper-theme.css. Run from anywhere.
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageStat
TH = 'C:/Users/daniel/Desktop/discordBot/theatron/'
src = Image.open(TH + 'web/public/navigation-02/plaque.webp').convert('RGBA')
W, H = src.size
TOP, BOT, SIDE = 65, 65, 100

# Paper = the bright region connected to the centre; everything else is wood.
lum = src.convert('L')
m = lum.point(lambda v: 255 if v > 150 else 0)
ImageDraw.floodfill(m, (W // 2, H // 2), 128)
paper = m.point(lambda v: 255 if v == 128 else 0)
paper = paper.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))

# Grow the wood outward over the transparent outer margin so the frame is a solid rectangle
# (otherwise the card's paper background would show around the planks).
filled = src.copy()
for _ in range(14):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        filled = Image.alpha_composite(ImageChops.offset(filled, dx, dy), filled)
frame = filled.copy()
frame.putalpha(ImageChops.invert(paper))

# Long, seamlessly tiling side band: B + mirrored B, so repeated tiles join on equal rows.
top = frame.crop((0, 0, W, TOP))
band = frame.crop((0, TOP, W, H - BOT))
bottom = frame.crop((0, H - BOT, W, H))
bh = band.size[1]
flip = band.transpose(Image.FLIP_TOP_BOTTOM)
# The tiles end on band row 0, so ease the bottom cap's first rows in from that row.
cap = bottom.copy()
N = 24
for r in range(N):
    t = r / (N - 1)
    a = band.crop((0, r, W, r + 1))
    b = bottom.crop((0, r, W, r + 1))
    cap.paste(Image.blend(a, b, t), (0, r))
out = Image.new('RGBA', (W, TOP + 2 * bh + BOT))
out.paste(top, (0, 0))
out.paste(band, (0, TOP))
out.paste(flip, (0, TOP + bh))
out.paste(cap, (0, TOP + 2 * bh))
out.save(TH + 'design/lunjian/lab/art/plaque-frame.webp', quality=88, method=6)
print('frame', out.size, 'band', bh)

# Seamless paper: the plaque's own paper, mirrored 2x2, contrast softened so the repeat does not read.
p = src.convert('RGB').crop((150, 78, 890, 242))
mean = tuple(int(v) for v in ImageStat.Stat(p).mean)
p = Image.blend(p, Image.new('RGB', p.size, mean), 0.35)
w, h = p.size
tile = Image.new('RGB', (2 * w, 2 * h))
tile.paste(p, (0, 0)); tile.paste(p.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
v = tile.crop((0, 0, 2 * w, h)).transpose(Image.FLIP_TOP_BOTTOM)
tile.paste(v, (0, h))
tile.save(TH + 'design/lunjian/lab/art/plaque-paper.webp', quality=82, method=6)
print('paper', tile.size, 'mean', mean)

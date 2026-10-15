import sys
from PIL import Image, ImageDraw
src, out, x0, y0, x1, y1 = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1)); s = 2; im = im.resize((im.width * s, im.height * s)); d = ImageDraw.Draw(im)
for x in range((x0 // 25 + 1) * 25, x1, 25): d.line([((x - x0) * s, 0), ((x - x0) * s, im.height)], fill=(255, 0, 0) if x % 100 == 0 else (255, 160, 160), width=1); d.text(((x - x0) * s + 2, 2), str(x), fill=(255, 0, 0)) if x % 50 == 0 else None
for y in range((y0 // 25 + 1) * 25, y1, 25): d.line([(0, (y - y0) * s), (im.width, (y - y0) * s)], fill=(0, 0, 255) if y % 100 == 0 else (160, 160, 255), width=1); d.text((2, (y - y0) * s + 2), str(y), fill=(0, 0, 255)) if y % 50 == 0 else None
im.save(out)

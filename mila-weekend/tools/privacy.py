"""Privacy pass: strong gaussian blur (radius 30) inside polygons shaped to each screen / card / flyer, feathered edges.
Writes clean/<name>.jpg and review/blur_<name>_<i>.png (before | after close-ups at 2x)."""
from PIL import Image, ImageDraw, ImageFilter
import os
os.makedirs('clean', exist_ok=True)
RADIUS = 30
AREAS = {
    'kitchen-setup': [
        ('laptop screen (sign-in sheet)', [(116, 576), (394, 550), (478, 760), (174, 868)]),
        ('flyer stack, bottom right (agent name + headshot)', [(566, 892), (684, 784), (952, 794), (952, 1040), (598, 976)]),
        ('business cards in front of the laptop', [(470, 950), (560, 948), (664, 990), (664, 1082), (466, 1082)]),
        ('second card stack by the candy jar', [(612, 738), (735, 738), (735, 795), (612, 795)]),
    ],
    'dining-setup': [
        ('laptop screen (sign-in sheet)', [(336, 636), (562, 666), (510, 838), (278, 788)]),
    ],
}
for name, areas in AREAS.items():
    im = Image.open(f'src/{name}.jpg').convert('RGB'); orig = im.copy()
    for i, (label, poly) in enumerate(areas):
        mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).polygon(poly, fill=255); mask = mask.filter(ImageFilter.GaussianBlur(3))
        # blur twice: the second pass removes any structure (table lines, letters) the first leaves behind
        bl = im.filter(ImageFilter.GaussianBlur(RADIUS)).filter(ImageFilter.GaussianBlur(RADIUS))
        im = Image.composite(bl, im, mask)
    im.save(f'clean/{name}.jpg', quality=95)
    for i, (label, poly) in enumerate(areas):
        xs, ys = [p[0] for p in poly], [p[1] for p in poly]; pad = 30
        box = (max(0, min(xs) - pad), max(0, min(ys) - pad), min(im.width, max(xs) + pad), min(im.height, max(ys) + pad))
        a, b = orig.crop(box), im.crop(box); s = 2; w, h = a.width * s, a.height * s
        sheet = Image.new('RGB', (w * 2 + 20, h + 50), 'white'); sheet.paste(a.resize((w, h)), (0, 50)); sheet.paste(b.resize((w, h)), (w + 20, 50))
        d = ImageDraw.Draw(sheet); d.text((8, 15), f'{name}: {label}  |  left: original   right: blurred', fill='black')
        sheet.save(f'review/blur_{name}_{i}.png'); print(f'review/blur_{name}_{i}.png', label)

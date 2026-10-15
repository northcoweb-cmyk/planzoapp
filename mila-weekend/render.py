"""Mila "weekend" TikTok: 5.6 s, 1080x1920, 30 fps, no audio. Pillow + numpy frames -> ffmpeg.

Order (hard cuts): kitchen "your weekend:" 1.1 s · dining "2 open houses." 0.9 s · listing laptop "3 showings." 0.9 s ·
living room "monday:\\nall the follow-ups." 1.2 s · aura end frame 1.5 s.
Photos come from clean/ (privacy-blurred by tools/privacy.py).
"""
import os, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
FONT = 'fonts/InstrumentSerif-Regular.ttf'
CLIPS = [
    ('clean/kitchen-setup.jpg', 1.1, 'your weekend:'),
    ('clean/dining-setup.jpg', 0.9, '2 open houses.'),
    ('clean/listing-laptop.jpg', 0.9, '3 showings.'),
    ('src/living-room.jpg', 1.2, 'monday:\nall the follow-ups.'),     # nothing private in this one
    (None, 1.5, None),
]
FADE_IN, FADE_OUT = 0.12, 0.08
PAN = 14.0                                     # px per second, camera pans right -> left (linear)
NAVY, LAV_PHOTO, LAV_AURA = (0x1A, 0x1A, 0x2E), (0xEB, 0xE6, 0xFF), (0xA9, 0x9B, 0xEA)

font = lambda s: ImageFont.truetype(FONT, s)

# ---------------------------------------------------------------- photo plates
def plate(path, dur):
    im = Image.open(path).convert('RGB')
    k = max(W / im.width, H / im.height) * 1.04          # fill 9:16 at ~1.04x
    big = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    travel = PAN * dur
    x_start = (big.width - W) / 2 + travel / 2            # starts right of center, ends left of center: stays centered overall
    y0 = (big.height - H) / 2
    return big, x_start, y0

y = np.arange(H, dtype=np.float32)
SHADE = (0.40 * np.exp(-0.5 * ((y - H / 2) / 330) ** 2))[:, None, None]        # soft dark band behind the center text

def text_layer(lines, size, color, cy, shadow=True, spacing=0.12):
    """RGBA layer with centered (multi-line) text whose block is centered on cy; optional soft blurred drop shadow."""
    f = font(size); lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    asc, desc = f.getmetrics(); lh = int((asc + desc) * (1 + spacing)); tot = lh * (len(lines) - 1) + asc + desc
    top = cy - tot / 2
    pos = []
    for i, ln in enumerate(lines):
        w = d.textlength(ln, font=f); pos.append(((W - w) / 2, top + i * lh, ln))
    if shadow:
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
        for x, yy, ln in pos: sd.text((x, yy + 6), ln, font=f, fill=(0, 0, 0, 150))
        lay = Image.alpha_composite(lay, sh.filter(ImageFilter.GaussianBlur(16)))
        d = ImageDraw.Draw(lay)
    for x, yy, ln in pos: d.text((x, yy), ln, font=f, fill=color + (255,))
    return lay

def wordmark(color):
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay); f = font(58)
    bb = d.textbbox((0, 0), 'Mila', font=f); d.text((64 - bb[0], 64 - bb[1]), 'Mila', font=f, fill=color + (255,)); return lay

def with_alpha(layer, a):
    if a >= 1: return layer
    l = layer.copy(); al = np.asarray(l.getchannel('A'), np.float32) * a; l.putalpha(Image.fromarray(al.astype(np.uint8))); return l

def text_alpha(tl, dur):
    a_in = min(1.0, tl / FADE_IN)
    a_out = min(1.0, max(0.0, (dur - tl) / FADE_OUT))
    return a_in * a_out

# ---------------------------------------------------------------- aura end frame
STOPS = [(0.00, '#7A90F0'), (0.20, '#8C9BF2'), (0.42, '#B6A4F3'), (0.64, '#D9D2F7'), (0.84, '#EEF3FC'), (1.00, '#FFFFFF')]
SPOS = np.array([s[0] for s in STOPS], np.float32)
SCOL = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for _, c in STOPS], np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def aura(tl):
    breathe = 1 + 0.04 * np.sin(2 * np.pi * tl / 3.0)            # ±4%, one slow breath
    rx, ry = 0.62 * W * breathe, 0.40 * H * breathe
    cx, cy = W / 2, H * 0.44                                        # slightly above middle
    d = np.clip(np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2), 0, 1)
    i = np.clip(np.searchsorted(SPOS, d, side='right') - 1, 0, len(SPOS) - 2)
    t = (d - SPOS[i]) / (SPOS[i + 1] - SPOS[i]); t = t * t * (3 - 2 * t)          # smoothstep between stops
    col = SCOL[i] * (1 - t[..., None]) + SCOL[i + 1] * t[..., None]
    return Image.fromarray(np.clip(col + 0.5, 0, 255).astype(np.uint8))

# ---------------------------------------------------------------- render
if os.path.isdir('frames'): shutil.rmtree('frames')
os.makedirs('frames')
WM_PHOTO, WM_AURA = wordmark(LAV_PHOTO), wordmark(LAV_AURA)
AURA_TXT = [text_layer(['Mila sends them.'], 132, NAVY, H * 0.44 - 20, shadow=False),
            text_layer(["so monday's for clients."], 64, NAVY, H * 0.44 + 100, shadow=False),
            text_layer(['comment MILA for your 7-day free trial'], 46, NAVY, H - 230, shadow=False)]
n = 0; starts = []
for path, dur, txt in CLIPS:
    nf = round(dur * FPS); starts.append(n)
    if path:
        big, x0, y0 = plate(path, dur)
        lines = txt.split('\n'); tlay = text_layer(lines, 140 if len(lines) == 1 else 120, (255, 255, 255), H / 2)
    for k in range(nf):
        tl = k / FPS
        if path:
            x = x0 - PAN * tl                                                  # linear, sub-pixel
            fr = big.transform((W, H), Image.AFFINE, (1, 0, x, 0, 1, y0), resample=Image.BICUBIC)
            a = np.asarray(fr, np.float32) * (1 - SHADE); fr = Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)).convert('RGBA')
            fr = Image.alpha_composite(fr, with_alpha(tlay, text_alpha(tl, dur)))
            fr = Image.alpha_composite(fr, WM_PHOTO)
        else:
            fr = aura(tl).convert('RGBA'); a_in = min(1.0, tl / FADE_IN)
            for lay in AURA_TXT: fr = Image.alpha_composite(fr, with_alpha(lay, a_in))
            fr = Image.alpha_composite(fr, WM_AURA)
        fr.convert('RGB').save(f'frames/f{n:04d}.png'); n += 1
print('frames', n, 'clip starts', starts)

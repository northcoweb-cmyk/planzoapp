"""Cut product shots and the logo out of their white backgrounds.
Flood-fills near-white from the image border only (so white parts *inside*
the object - laces, the logo's white letters - stay), then feathers the edge.
Usage: python3 -I cutout.py SRC DST SCALE [tolerance]
"""
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src, dst, scale = sys.argv[1], sys.argv[2], float(sys.argv[3])
tol = float(sys.argv[4]) if len(sys.argv) > 4 else 26
im = Image.open(src).convert('RGBA')
if scale != 1:
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
a = np.asarray(im).astype(np.float32)
rgb, alpha0 = a[..., :3], a[..., 3]
white = (255 - rgb.min(-1)) < tol            # near-white / light-grey
white |= alpha0 < 10
lab, _ = ndimage.label(white)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bg = np.isin(lab, border[border > 0])
fg = ~bg
fg = ndimage.binary_opening(fg, iterations=2)
lab2, n2 = ndimage.label(fg)                       # keep the main object only: kills JPEG speckle
if n2 > 1:
    sizes = ndimage.sum(fg, lab2, range(1, n2 + 1)); keep = np.argmax(sizes) + 1
    fg = lab2 == keep
fg = ndimage.binary_closing(fg, iterations=2)
erode = int(sys.argv[5]) if len(sys.argv) > 5 else 0
if erode: fg = ndimage.binary_erosion(fg, iterations=erode)   # trim the light fringe
soft = ndimage.gaussian_filter(fg.astype(np.float32), 1.1)
alpha = np.clip(soft * 1.25 - 0.1, 0, 1) * (alpha0 / 255)
out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
ys, xs = np.where(alpha > 0.05)
pad = 8
crop = out[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]
Image.fromarray(crop).save(dst)
print(dst, crop.shape[1], 'x', crop.shape[0])

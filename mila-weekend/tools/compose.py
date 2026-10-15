"""Clean, graded photos for the TikTok: Mila UI replaces each laptop screen (perspective-matched), a depth-of-field blur
softens the foreground (business cards, flyers, printout addresses), then one warm premium grade. Works on up/ (EDSR x2)."""
import cv2, numpy as np
from PIL import Image
S = 2                                                         # up/ is 2x the original coordinates
SCREENS = {'kitchen-setup': ('oh', [(124, 594), (381, 568), (456, 751), (170, 860)]),
           'dining-setup': ('oh', [(351, 651), (548, 680), (498, 823), (291, 777)]),
           'listing-laptop': ('sh', [(330, 726), (686, 730), (682, 951), (316, 953)])}
DOF = {'kitchen-setup': (812, 940), 'dining-setup': (848, 905), 'listing-laptop': (975, 1035), 'living-room': None}   # foreground y0 -> y1 (full blur)
SPOTS = {'kitchen-setup': [(600, 728, 748, 805)], 'listing-laptop': [(134, 632, 244, 670), (84, 886, 270, 940)]}            # extra soft defocus patches
def screen(img, ui_name, quad, fern=False):
    ui = cv2.imread(f'ui/screen_{ui_name}.png')[:, :, ::-1].astype(np.float32)
    q = np.float32(quad) * S; w = int(max(np.linalg.norm(q[1] - q[0]), np.linalg.norm(q[2] - q[3]))) * 2
    ui = cv2.resize(ui, (w, int(w * 900 / 1440)), interpolation=cv2.INTER_AREA)
    h0, w0 = ui.shape[:2]
    # screen look: slightly lifted blacks, a soft top-down gloss
    g = np.linspace(1, 0, h0)[:, None, None] ** 2 * 18; ui = ui * 0.93 + 10 + g
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w0, 0], [w0, h0], [0, h0]]), q)
    warped = cv2.warpPerspective(ui, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR)
    mask = np.zeros(img.shape[:2], np.float32); cv2.fillConvexPoly(mask, np.int32(q), 1.0)
    if fern:                                                 # keep the fern leaves that sit in front of the screen
        r, gg, b = img[..., 0].astype(np.int16), img[..., 1].astype(np.int16), img[..., 2].astype(np.int16)
        leaf = ((gg > r + 8) & (gg > b + 4)).astype(np.uint8); leaf = cv2.morphologyEx(leaf, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        leaf = cv2.dilate(leaf, np.ones((3, 3), np.uint8)); mask *= 1 - leaf.astype(np.float32)
    mask = cv2.GaussianBlur(mask, (0, 0), 1.2)[..., None]
    warped = cv2.GaussianBlur(warped, (0, 0), 0.7)
    return img * (1 - mask) + warped * mask
def defocus(img, name):
    H, W = img.shape[:2]; R = np.zeros((H, W), np.float32)
    if DOF.get(name): y0, y1 = (v * S for v in DOF[name]); ys = np.clip((np.arange(H) - y0) / (y1 - y0), 0, 1); R[:] = (ys * ys * (3 - 2 * ys))[:, None]
    for (x0, y0, x1, y1) in SPOTS.get(name, []):
        m = np.zeros((H, W), np.float32); m[y0 * S:y1 * S, x0 * S:x1 * S] = 1; R = np.maximum(R, cv2.GaussianBlur(m, (0, 0), 14 * S) * 1.6)
    R = np.clip(R, 0, 1)
    levels = [0, 6, 14, 26, 44]; stack = [img] + [cv2.GaussianBlur(img, (0, 0), s * S / 2) for s in levels[1:]]
    pos = R * (len(levels) - 1); i = np.clip(pos.astype(int), 0, len(levels) - 2); f = (pos - i)[..., None]
    out = np.zeros_like(img)
    for k in range(len(levels) - 1):
        sel = (i == k)[..., None]; out += sel * (stack[k] * (1 - f) + stack[k + 1] * f)
    return out
def grade(img):
    x = img / 255.0
    x = x * 0.96 + 0.02                                                       # lifted blacks
    x = x + 0.10 * (x - 0.5) * (1 - np.abs(2 * x - 1))                         # gentle s-curve
    lum = x.mean(-1, keepdims=True); x = lum + (x - lum) * 1.08               # +8% saturation
    x = x * np.array([1.025, 1.0, 0.97]) + np.array([0.0, 0.0, 0.01]) * (1 - lum)   # warm highlights, cool-ish shadows
    return np.clip(x * 255, 0, 255)
for name in ['kitchen-setup', 'dining-setup', 'listing-laptop', 'living-room']:
    img = np.asarray(Image.open(f'up/{name}.png').convert('RGB')).astype(np.float32)
    if name in SCREENS: ui, q = SCREENS[name]; img = screen(img, ui, q, fern=(name == 'kitchen-setup'))
    img = defocus(img, name); img = grade(img)
    Image.fromarray(img.astype(np.uint8)).save(f'graded/{name}.jpg', quality=94); print('graded', name, img.shape)

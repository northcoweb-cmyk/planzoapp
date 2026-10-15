"""v2 screen replacement that sits IN the photo:
 * the real lit screen area is detected (bright, unsaturated pixels inside the hand-placed quad, holes closed, fern excluded)
   and its corners are fitted, so the UI lands exactly inside the bezel
 * a light Mila UI, exposure/tint-matched to the original screen, carrying its real light falloff (low-pass of the original)
 * matched softness + grain; specular reflections from the original are put back on top
 * then the same depth-of-field + grade as before."""
import cv2, numpy as np
from PIL import Image
import importlib.util
spec = importlib.util.spec_from_file_location('c1', 'tools/compose.py'); src = open('tools/compose.py').read().split('for name in [')[0]
c1 = {}; exec(compile(src, 'compose', 'exec'), c1)
S = 2
QUADS = {'kitchen-setup': ('oh', [(124, 594), (381, 568), (456, 751), (170, 860)], 'detect'),
         'dining-setup': ('oh', [(351, 651), (548, 680), (498, 823), (291, 777)], 'detect'),
         'listing-laptop': ('sh_window', [(398, 744), (622, 752), (616, 946), (382, 936)], 'detect')}
def order(pts):
    pts = np.float32(pts); s = pts.sum(1); d = np.diff(pts, axis=1).ravel()
    return np.float32([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]])
def screen_mask(img, quad, mode):
    H, W = img.shape[:2]; q = np.float32(quad) * S
    poly = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(poly, np.int32(q), 1)
    if mode == 'quad': return poly.astype(np.float32), order(q)
    region = cv2.dilate(poly, np.ones((15, 15), np.uint8))
    hsv = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2HSV)
    bright = ((hsv[..., 2] > 135) & (hsv[..., 1] < 70)).astype(np.uint8) & region
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))    # fill the sheet's lines and text
    n, lab, st, _ = cv2.connectedComponentsWithStats(bright); k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); m = (lab == k).astype(np.uint8)
    cnt = max(cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
    hull = cv2.convexHull(cnt); eps = 0.02 * cv2.arcLength(hull, True); ap = cv2.approxPolyDP(hull, eps, True)
    while len(ap) > 4: eps *= 1.2; ap = cv2.approxPolyDP(hull, eps, True)
    corners = order(ap.reshape(-1, 2)) if len(ap) == 4 else order(q)
    filled = np.zeros_like(m); cv2.fillConvexPoly(filled, np.int32(corners), 1)
    # inside the fitted quad, anything that is NOT screen (the fern) stays in front
    hsvq = hsv; leaf = ((img[..., 1] > img[..., 0] + 8) & (img[..., 1] > img[..., 2] + 4)).astype(np.uint8)
    leaf = cv2.morphologyEx(leaf, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); leaf = cv2.dilate(leaf, np.ones((3, 3), np.uint8))
    if quad[0][0] > 380: leaf[:] = 0; leaf[int(925 * S):, :] = 1     # listing laptop: no plant, but the macOS dock sits in front of the window
    return (filled * (1 - leaf)).astype(np.float32), corners
def put_screen(img, name):
    ui_name, quad, mode = QUADS[name]; H, W = img.shape[:2]
    mask, C = screen_mask(img, quad, mode)
    C = C + np.float32([[1.5, 1.5], [-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5]])          # sit just inside the bezel
    ui = cv2.imread(f'ui/screen_{ui_name}_light.png' if ui_name != 'sh_window' else 'ui/screen_sh_window.png')[:, :, ::-1].astype(np.float32)
    w = int(max(np.linalg.norm(C[1] - C[0]), np.linalg.norm(C[2] - C[3]))) * 2
    ui = cv2.resize(ui, (w, int(w * ui.shape[0] / ui.shape[1])), interpolation=cv2.INTER_AREA); h0, w0 = ui.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w0, 0], [w0, h0], [0, h0]]), C)
    warped = cv2.warpPerspective(ui, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    inside = np.zeros((H, W), np.float32); cv2.fillConvexPoly(inside, np.int32(C), 1); mask = mask * inside
    m3 = mask[..., None] > 0.5
    orig = img.copy()
    if mode == 'detect':
        # exposure + tint of the real screen, and its light falloff across the panel
        white = np.percentile(orig[m3[..., 0]], 92, axis=0)                              # the screen's "white"
        lum = orig.mean(-1); lum_f = cv2.GaussianBlur(np.where(mask > 0.5, lum, 0), (0, 0), 60) / (cv2.GaussianBlur(mask, (0, 0), 60) + 1e-6)
        fall = np.clip(lum_f / (np.percentile(lum_f[m3[..., 0]], 95) + 1e-6), 0.55, 1.05)[..., None]
        warped = warped / 255.0 * white[None, None, :] * fall
    else:
        # the listing laptop: a gentle panel gradient, slightly dimmer than paper white, plus the original reflections on top
        yy = np.linspace(0, 1, H)[:, None, None]; warped = warped * (0.92 - 0.06 * yy) * np.array([0.97, 0.98, 1.0])
    warped = cv2.GaussianBlur(warped, (0, 0), 1.1)                                       # match the photo's softness
    warped += np.random.default_rng(3).normal(0, 3.0, warped.shape)                      # and its grain
    if name == 'listing-laptop':                 # any leftover white of the old page (above the dock) takes the window's own background
        q = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(q, np.int32(np.float32(quad) * S), 1); q = cv2.dilate(q, np.ones((21, 21), np.uint8)); q[int(925 * S):] = 0
        left = ((orig.mean(-1) > 140) & (q > 0)).astype(np.float32); left = cv2.dilate(left, np.ones((5, 5), np.uint8))
        pale = np.median(warped[mask > 0.5][-2000:], axis=0)
        warped = np.where((left > 0)[..., None] & (mask < 0.5)[..., None], pale, warped); mask = np.maximum(mask, left)
    a = cv2.GaussianBlur(mask, (0, 0), 1.0)[..., None]
    out = img * (1 - a) + warped * a
    if name == 'listing-laptop':                       # only the two real light reflections on this screen come back, nothing else from the original
        g = np.zeros((H, W), np.float32)
        for (x, y) in ((337, 866), (590, 868)): cv2.circle(g, (x * S, y * S), 15 * S, 1.0, -1)
        g = cv2.GaussianBlur(g, (0, 0), 4)[..., None]; out = out * (1 - g) + orig * g
    return out
if __name__ == '__main__':
    for name in ['kitchen-setup', 'dining-setup', 'listing-laptop', 'living-room']:
        img = np.asarray(Image.open(f'up/{name}.png').convert('RGB')).astype(np.float32)
        if name in QUADS: img = put_screen(img, name)
        img = c1['defocus'](img, name); img = c1['grade'](img)
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(f'graded/{name}.jpg', quality=94); print('graded', name)

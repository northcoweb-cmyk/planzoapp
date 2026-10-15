import cv2, numpy as np, sys
from PIL import Image
sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(sys.argv[1]); sr.setModel('edsr', 2)
for n in ['kitchen-setup', 'dining-setup', 'listing-laptop', 'living-room']:
    im = np.array(Image.open(f'src/{n}.jpg').convert('RGB'))[:, :, ::-1]
    Image.fromarray(sr.upsample(im)[:, :, ::-1]).save(f'up/{n}.png'); print(n, flush=True)

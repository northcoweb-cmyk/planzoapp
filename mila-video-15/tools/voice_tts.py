import sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
P = ["And I'll tell you what.", "Every agent needs to start paying attention,", "because there's something going on", "in real estate.", "Her name's Mila."]
for voice in sys.argv[1:]:
    durs = []
    for i, t in enumerate(P):
        s, sr = k.create(t, voice=voice, speed=1.05, lang="en-us")
        a = np.abs(s); nz = np.where(a > a.max() * 0.02)[0]; s = s[max(0, nz[0] - int(0.01 * sr)): nz[-1] + int(0.05 * sr)]
        sf.write(f"v15/{voice}_p{i}.wav", s, sr); durs.append(round(len(s) / sr, 2))
    print(voice, durs)

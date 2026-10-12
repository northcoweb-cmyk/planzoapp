import sys, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
voice, speed = sys.argv[1], float(sys.argv[2])
P = ["Hey Mila,", "I'm running late.", "Book my two o'clock showing on Sea Grape,", "and text the Ellises I'll be five minutes late.", "My closing ran long."]
out = {}
for i, t in enumerate(P):
    s, sr = k.create(t, voice=voice, speed=speed, lang="en-us")
    a = np.abs(s); thr = a.max() * 0.02; nz = np.where(a > thr)[0]
    s = s[max(0, nz[0] - int(0.01 * sr)): nz[-1] + int(0.04 * sr)]          # trim silence
    sf.write(f"p{i}.wav", s, sr); out[i] = [t, round(len(s) / sr, 3)]
print(json.dumps(out, indent=1))

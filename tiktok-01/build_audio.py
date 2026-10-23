"""TikTok #1 audio: original UI sound design only, no music (add a Commercial Music Library track in TikTok if wanted).
Writes audio/mix.wav (48 kHz, -16 LUFS so it sits under any CML track you add, <= -1 dBTP)."""
import json, re, subprocess
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; tl = json.load(open("timeline.json")); LEN = int(tl["duration"] * SR); rng = np.random.default_rng(3)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def env(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def sine(f, d): N = int(d * SR); f = np.broadcast_to(np.asarray(f, float), (N,)); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def st(m, pan=0.0): return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
def whoosh(d=0.3, lo=800, hi=7000, a=0.12):
    N = int(d * SR); nz = rng.standard_normal(N); o = np.zeros(N)
    for i in range(0, N, 512): c = lo * (hi / lo) ** (i / N); o[i:i + 512] = bp(nz[i:i + 512], max(60, c * 0.6), min(SR / 2 - 100, c * 1.6))
    return st(o * np.sin(np.pi * np.linspace(0, 1, N) ** 0.7) ** 2 * a, rng.uniform(-0.4, 0.4))
def pop(): N = int(0.12 * SR); return st(sine(np.geomspace(1100, 320, N), 0.12) * env(N, 0.002, 0.035) * 0.6, rng.uniform(-0.3, 0.3))
def tap(): N = int(0.05 * SR); return st((sine(1800, 0.05) * env(N, 0.0008, 0.01) + bp(rng.standard_normal(N), 2000, 8000) * env(N, 0.0003, 0.004) * 0.4) * 0.35, rng.uniform(-0.2, 0.2))
def send(): return whoosh(0.4, 600, 7000, 0.2)
def scribble():
    N = int(0.45 * SR); x = bp(rng.standard_normal(N), 2500, 9000) * (0.5 + 0.5 * np.abs(np.sin(np.linspace(0, 14 * np.pi, N)))) * env(N, 0.01, 0.25) * 0.12
    return st(x, 0.2)
BANK = {"whip": whoosh, "pop": pop, "tap": tap, "send": send, "scribble": scribble}
PRE = {"whip": 0.12, "send": 0.1}
mix = np.zeros((LEN + SR, 2))
for t, k in tl["sfx"]:
    s = BANK[k](); i = max(0, int((t - PRE.get(k, 0)) * SR)); j = min(len(mix), i + len(s)); mix[i:j] += s[: j - i]
over = mix[LEN:]; mix = mix[:LEN]; mix[: len(over)] += over
# a small room so it feels finished
n = int(0.6 * SR); ir = rng.standard_normal((n, 2)) * np.exp(-6.9 * np.arange(n) / SR / 0.6)[:, None]; ir /= np.sqrt((ir ** 2).sum(0).mean())
wet = np.stack([fftconvolve(mix[:, c], ir[:, c])[:LEN] for c in range(2)], 1); mix = mix + wet * 0.12
sf.write("audio/pre.wav", mix.astype(np.float32), SR, subtype="FLOAT")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/pre.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-ar", "48000", "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("ok")

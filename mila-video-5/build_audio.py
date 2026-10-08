"""Video #5 audio: cut "Kavkaz" on the grid, automate the arc, add UI sound design, master.

Usage:  python3 build_audio.py path/to/Kavkaz.mp3
The song is never sped up or pitch-shifted. The arc comes from volume + filter automation:
  maze full -> real silence on the freeze (u24-26) -> muffled calm under the typing (u26-40)
  -> full on the COLLAPSE downbeat (u40) -> half-beat drop-out (u55) -> full on the drop (u56)
  -> fade to zero for a seamless loop back into the intro.
Writes audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP).
"""
import json, re, subprocess, sys
import numpy as np, librosa, soundfile as sf
from scipy.signal import butter, sosfilt, sosfilt_zi

SR = 48000
tl = json.load(open("timeline.json")); U = tl["unit"]
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
t = np.arange(LEN) / SR; u = t / U
rng = np.random.default_rng(5)

y, _ = librosa.load(sys.argv[1], sr=SR, mono=False)
s0 = int(round(tl["songStart"] * SR)); song = y[:, s0:s0 + LEN].T.copy()

# --- low-pass under the calm section (u26-40), opens instantly on the collapse downbeat
def cutoff(x):
    if 26 <= x < 40: return 650.0 if x < 38.5 else 650.0 * (6000 / 650) ** ((x - 38.5) / 1.5)
    return 20000.0
blk, zi, out = 256, None, np.zeros_like(song)
for i in range(0, LEN, blk):
    fc = cutoff((i + blk / 2) / SR / U); seg = song[i:i + blk]
    if fc >= 19999: out[i:i + blk] = seg; zi = None; continue
    sos = butter(2, fc, "lowpass", fs=SR, output="sos")
    if zi is None: zi = np.stack([sosfilt_zi(sos) * seg[0, c] for c in range(2)], -1)
    for c in range(2): out[i:i + blk, c], zi[..., c] = sosfilt(sos, seg[:, c], zi=zi[..., c])
song = out

# --- gain automation (dB) ; short ramps so nothing clicks
pts_u = [0, 0.15, 23.97, 24.0, 25.97, 26.0, 26.6, 39.95, 40.0, 54.97, 55.0, 55.97, 56.0, 66.0, 71.6, 72.0]
pts_db = [-40, 0, 0, -90, -90, -24, -7, -7, 0, 0, -26, -26, 0, 0, -60, -90]
g = 10 ** (np.interp(u, pts_u, pts_db) / 20)
song *= g[:, None]

# --- sound design (tuned to G minor)
def env(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, "lowpass", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "highpass", fs=SR, output="sos"), x)
def sine(f, d): N = int(d * SR); f = np.broadcast_to(np.asarray(f, float), (N,)); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def st(m, pan=0.0): return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
def chime(f0, d=1.1, a=0.42):
    N = int(d * SR); m = sum(k * sine(f0 * r, d) * env(N, 0.002, dd) for r, k, dd in ((1, 1, 0.5), (2, 0.35, 0.28), (2.76, 0.22, 0.18), (5.4, 0.08, 0.08)))
    return st(m * a, 0.1)
def whoosh(d, lo, hi, a, pan=(-0.6, 0.6)):
    N = int(d * SR); nz = rng.standard_normal(N); o = np.zeros(N)
    for i in range(0, N, 1024):
        c = lo * (hi / lo) ** (i / N); o[i:i + 1024] = bp(nz[i:i + 1024], max(60, c * 0.6), min(SR / 2 - 100, c * 1.6), 1)
    m = o * np.sin(np.pi * np.linspace(0, 1, N) ** 0.7) ** 2 * a; p = np.linspace(*pan, N)
    return np.stack([m * np.cos((p + 1) * np.pi / 4), m * np.sin((p + 1) * np.pi / 4)], 1) * np.sqrt(2)
def tick(): N = int(0.06 * SR); return st((sine(2400, 0.06) * env(N, 0.0008, 0.012) + bp(rng.standard_normal(N), 3000, 9000) * env(N, 0.0003, 0.004) * 0.6) * 0.55, rng.uniform(-0.3, 0.3))
def key(): N = int(0.05 * SR); return st((bp(rng.standard_normal(N), 2500, 7000) * env(N, 0.0005, 0.006) + sine(rng.uniform(380, 520), 0.05) * env(N, 0.001, 0.012) * 0.4) * 0.5, rng.uniform(-0.25, 0.25))
def tap(): N = int(0.09 * SR); return st(sine(np.linspace(1500, 700, N), 0.09) * env(N, 0.001, 0.02) + lp(rng.standard_normal(N), 2000) * env(N, 0.0005, 0.01) * 0.5)
def pop(): N = int(0.12 * SR); return st(sine(np.geomspace(1100, 320, N), 0.12) * env(N, 0.002, 0.035) * 0.7, rng.uniform(-0.2, 0.2))
def win():   # generic window pop: dull click, slightly random
    N = int(0.08 * SR); return st((sine(np.geomspace(rng.uniform(700, 1100), 300, N), 0.08) * env(N, 0.001, 0.02) + bp(rng.standard_normal(N), 1500, 5000) * env(N, 0.0003, 0.004)) * 0.5, rng.uniform(-0.7, 0.7))
def ding(): return chime(rng.choice([1318.5, 1479.98, 1661.2]), 0.4, 0.2)   # off-key on purpose: stress
def err():   # flat two-tone error buzz
    N = int(0.28 * SR); m = np.sign(sine(220, 0.28)) * 0.25 + np.sign(sine(233.1, 0.28)) * 0.25
    return st(lp(m, 2500) * np.minimum(1, np.arange(N) / (0.005 * SR)) * np.exp(-np.arange(N) / (0.2 * SR)) * 0.5)
def buzz(): N = int(0.35 * SR); m = np.sign(sine(170, 0.35)) * 0.3 + sine(170, 0.35) * 0.5; return st(lp(m, 900) * env(N, 0.01, 0.2) * 0.6)
def spin():
    N = int(1.2 * SR); out = np.zeros((N, 2))
    for k in range(14): s2 = tick() * 0.25; o = int(k * 0.08 * SR); out[o:o + len(s2)] += s2[: N - o]
    return out
def freeze(): return whoosh(0.5, 6000, 300, 0.16)[::-1] * 1.2
def air(): return whoosh(1.4, 2000, 9000, 0.06, (0, 0))
def suck(): return whoosh(int(1.0 * U * SR) / SR, 300, 9000, 0.28)[::-1]     # everything pulled in
def thunk():
    d = 0.9; N = int(d * SR)
    m = sine(np.geomspace(150, 45, N), d) * env(N, 0.002, 0.16) * 1.3 + bp(rng.standard_normal(N), 1500, 6000) * env(N, 0.0004, 0.005) * 0.6
    return st(np.tanh(m * 1.4))
def card():
    N = int(0.3 * SR); return st(sine(np.geomspace(220, 80, N), 0.3) * env(N, 0.002, 0.06) * 0.8 + bp(rng.standard_normal(N), 2500, 8000) * env(N, 0.0004, 0.004) * 0.5)
def sparkle():
    N = int(0.9 * SR); out = np.zeros((N, 2))
    for _ in range(26):
        o = int(rng.uniform(0, 0.45) * SR); d = rng.uniform(0.08, 0.25); f = rng.choice([1567.98, 1864.66, 2349.32, 3135.96, 3729.31])
        s2 = st(sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14), rng.uniform(-0.8, 0.8)); out[o:o + len(s2)] += s2[: N - o]
    return out
def bloom(): return whoosh(0.9, 200, 3000, 0.16)
def boom():
    d = 2.4; N = int(d * SR); return st(sine(np.geomspace(98, 49, N), d) * env(N, 0.004, 0.6) + sine(196, d) * env(N, 0.004, 0.25) * 0.12)

BANK = {"buzz": buzz, "ding": ding, "win": win, "err": err, "spin": spin, "freeze": freeze, "air": air, "suck": suck, "thunk": thunk,
        "bloom": bloom, "card": card, "tap": tap, "tick": tick, "pop": pop, "sparkle": sparkle, "boom": boom,
        "send": lambda: whoosh(0.45, 600, 7000, 0.2), "through": lambda: whoosh(0.4, 200, 7000, 0.18), "swish": lambda: whoosh(0.22, 1200, 7000, 0.09),
        "whip": lambda: whoosh(0.3, 600, 8000, 0.2),
        "chime_g": lambda: chime(783.99), "chime_bb": lambda: chime(932.33), "chime_d": lambda: chime(1174.66), "chime_g_hi": lambda: chime(1567.98, 1.6, 0.5)}
PRE = {"suck": 1.0 * U, "through": 0.15, "send": 0.12, "whip": 0.12, "swish": 0.1, "freeze": 0.5}

sfx = np.zeros((LEN, 2))
def place(sig, sec):
    i = int(round(sec * SR))
    if i < 0: sig, i = sig[-i:], 0
    j = min(LEN, i + len(sig))
    if j > i: sfx[i:j] += sig[: j - i]
for k in tl["keyUnits"]: place(key(), k * U)
for k in np.arange(tl["emailType"][0], tl["emailType"][1], 0.18): place(tick() * 0.25, k * U)
for k, kind in tl["sfx"]: place(BANK[kind](), k * U - PRE.get(kind, 0.0))

# UI bus sits under the song; louder in the quiet section so typing reads
sfx = np.tanh(sfx * 1.2) / 1.2
ref = np.sqrt(np.mean(song[int(14 * SR):int(17 * SR)] ** 2))
sfx *= (ref * 10 ** (-15 / 20)) / (np.sqrt(np.mean(sfx[sfx.any(1)] ** 2)) + 1e-9)
quiet = ((u >= 24) & (u < 40)).astype(float); sfx *= (1 + 0.6 * quiet)[:, None]
sfx *= np.interp(u, [0, 70, 71.6, 72], [1, 1, 0, 0])[:, None]       # loop tail stays clean
mix = song + sfx
sf.write("audio/mix_premaster.wav", mix.astype(np.float32), SR, subtype="FLOAT")
def ln(x=""): return f"loudnorm=I=-14:TP=-1.0:LRA=11{x}"
p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", "audio/mix_premaster.wav", "-af", ln(":print_format=json"), "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S).group(0))
second = ln(f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix_premaster.wav", "-af", second + f",aresample={SR},alimiter=limit=0.79:level=false", "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("pass-1:", m["input_i"], "LUFS", m["input_tp"], "dBTP")

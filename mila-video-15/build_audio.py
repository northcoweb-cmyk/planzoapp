"""Video #15 audio: the reference edit's instrumental + a new Mila voice-over, reverb design, master.

Usage:  python3 build_audio.py            (reads audio/inst.wav, made with tools/mdx.py from the reference audio)
  * the instrumental is used as-is: no speed or pitch change; the original speech was removed by stem separation
  * the voice (assets/voice/p0-p4.wav, Kokoro am_fenrir) is high-passed, given presence, compressed and lightly saturated,
    and the instrumental ducks ~4 dB under it
  * reverb throws on "attention," / "in real estate." (washing into the drop, ducked when it lands) / "Mila." (a long hall in the break)
  * a reversed swell + sub boom into the final hit (22.33 s), whose hall tail carries the end card, then wraps onto the start
Writes audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP).
"""
import json, re, subprocess
import numpy as np, librosa, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
tl = json.load(open("timeline.json"))
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
rng = np.random.default_rng(15)
def at(s): return int(round(s * SR))
def lp(x, f, o=2): return sosfilt(butter(o, f, "lowpass", fs=SR, output="sos"), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, "highpass", fs=SR, output="sos"), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), x, axis=0)
def make_ir(rt60, predelay=0.025, bright=7000, dark=1800, seed=1):
    r = np.random.default_rng(seed); n = int(rt60 * 1.1 * SR); tt = np.arange(n) / SR
    env = np.exp(-6.9 * tt / rt60); nz = r.standard_normal((n, 2)); mix = np.clip(tt / (rt60 * 0.5), 0, 1)[:, None]
    ir = (lp(nz, bright) * (1 - mix) + lp(nz, dark) * mix) * env[:, None]
    ir[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir]); return ir / np.sqrt((ir ** 2).sum(0).mean())
def verb(x, ir, lo=180):
    x = hp(x, lo); return np.stack([fftconvolve(x[:, c], ir[:, c]) for c in range(2)], 1)
HALL = make_ir(2.6, seed=2); BIG = make_ir(4.5, predelay=0.03, bright=9000, dark=2200, seed=4); ROOM = make_ir(0.9, predelay=0.01, bright=8000, dark=3000, seed=3)

buf = lambda: np.zeros((LEN + 8 * SR, 2))
def place(b, sig, i):
    if i < 0: sig, i = sig[-i:], 0
    j = min(len(b), i + len(sig)); b[i:j] += sig[: j - i]

# ---------------------------------------------------------------- instrumental
y, _ = librosa.load("audio/inst.wav", sr=SR, mono=False); inst = np.zeros((LEN, 2)); n = min(LEN, y.shape[1]); inst[:n] = y[:, :n].T

# ---------------------------------------------------------------- voice
def env_follow(x, att=0.005, rel=0.12):
    a = np.abs(x).max(1) if x.ndim > 1 else np.abs(x); e = np.zeros_like(a); ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); v = 0.0
    for i, s in enumerate(a): v = ka * v + (1 - ka) * s if s > v else kr * v + (1 - kr) * s; e[i] = v
    return e
def voice_chain(m):
    m = hp(m, 110, 4)
    m = m + 0.55 * bp(m, 2500, 5000)                               # presence
    m = m + 0.25 * lp(m, 220)                                      # chest
    e = env_follow(m, 0.003, 0.08); thr = 0.1 * e.max()
    g = np.where(e > thr, (thr + (e - thr) / 4) / np.maximum(e, 1e-9), 1.0); m = m * g    # 4:1 compression
    m = np.tanh(2.2 * m / (np.abs(m).max() + 1e-9)) / np.tanh(2.2)  # warmth
    return m / (np.abs(m).max() + 1e-9)
vo = buf(); vsend = buf(); vbig = buf()
for t0, name, text, _ in tl["vo"]:
    m, _ = librosa.load(f"assets/voice/{name}.wav", sr=SR, mono=True); m = voice_chain(m)
    st = np.stack([m, m], 1); place(vo, st, at(t0)); place(vsend, st * 0.18, at(t0))
    tail = st[-int(0.45 * SR):] * np.linspace(0.3, 1, int(0.45 * SR))[:, None]        # the last word gets thrown
    place(vbig if name in ("p3", "p4") else vsend, tail * (1.0 if name in ("p3", "p4") else 0.8), at(t0) + len(st) - len(tail))
vo_env = env_follow(vo[:LEN], 0.01, 0.25)
wet_v = verb(vsend[:LEN], HALL)[:LEN + 6 * SR]; wet_big = verb(vbig[:LEN], BIG)[:LEN + 6 * SR]
duckd = np.ones(len(wet_big)); k0 = at(tl["drop"]); duckd[k0:k0 + at(0.12)] = np.linspace(1, 0.2, at(0.12)); duckd[k0 + at(0.12):at(19.0)] = 0.2   # the drop eats the throw
wet_big *= duckd[:, None]

# ---------------------------------------------------------------- sound design
def envl(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def sine(f, d): N = int(d * SR); f = np.broadcast_to(np.asarray(f, float), (N,)); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def stp(m, pan=0.0): return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
def whoosh(d, lo, hi, a, pan=(-0.6, 0.6)):
    N = int(d * SR); nz = rng.standard_normal(N); o = np.zeros(N)
    for i in range(0, N, 1024):
        c = lo * (hi / lo) ** (i / N); o[i:i + 1024] = bp(nz[i:i + 1024], max(60, c * 0.6), min(SR / 2 - 100, c * 1.6), 1)
    m = o * np.sin(np.pi * np.linspace(0, 1, N) ** 0.7) ** 2 * a; p = np.linspace(*pan, N)
    return np.stack([m * np.cos((p + 1) * np.pi / 4), m * np.sin((p + 1) * np.pi / 4)], 1) * np.sqrt(2)
def boom(f0=55): d = 2.4; N = int(d * SR); return stp(sine(np.geomspace(f0, f0 / 2, N), d) * envl(N, 0.004, 0.6))
def chime(f0, d=1.4, a=0.4):
    N = int(d * SR); return stp(sum(k * sine(f0 * r, d) * envl(N, 0.002, dd) for r, k, dd in ((1, 1, 0.55), (2, 0.3, 0.3), (2.76, 0.15, 0.18))) * a, 0.1)
def tap(): N = int(0.09 * SR); return stp(sine(np.linspace(1500, 700, N), 0.09) * envl(N, 0.001, 0.02))
sfx = buf(); fxs = buf()
for t in [1.8, 3.35, 4.75, 6.1]: place(sfx, whoosh(0.5, 400, 6000, 0.07), at(t - 0.25))
place(sfx, whoosh(1.7, 250, 9000, 0.06), at(tl["drop"] - 1.65))                        # riser into the drop
place(sfx, boom(55) * 0.8, at(tl["drop"]))
for s in tl["seq"]:
    if s[1] in ("ui",): place(sfx, whoosh(0.2, 1200, 8000, 0.06), at(s[0] - 0.08))
place(sfx, tap() * 0.6, at(tl["approveTap"])); c = chime(1567.98, 1.6, 0.35); place(sfx, c, at(tl["approveTap"])); place(fxs, c * 0.6, at(tl["approveTap"]))
# into the final hit: reversed hall swell of the hit itself, then sub boom + the hall tail that carries the end card
hit = inst[at(tl["hit"]) - at(0.02): at(tl["hit"]) + at(0.6)].copy()
rs = verb(hit, BIG)[: at(1.4)]; rs = rs[::-1] * np.linspace(0, 1, len(rs))[:, None] ** 2; place(sfx, rs * 0.35, at(tl["hit"]) - len(rs))
place(sfx, boom(49) * 0.6, at(tl["hit"]))
hit_tail = verb(hit, BIG) * 0.16; place(sfx, hit_tail, at(tl["hit"]))
sfx[:LEN] += verb(fxs[:LEN], ROOM)[:LEN] * 0.6

# ---------------------------------------------------------------- mix
duck = 10 ** (-4.5 * np.clip(vo_env / (vo_env.max() + 1e-9) * 3, 0, 1) / 20)
full = buf(); full[:LEN] += inst * duck[:, None]
ref = np.sqrt(np.mean(inst[at(8):at(19)] ** 2))
vlev = ref * 10 ** (-1 / 20) / (np.sqrt(np.mean(vo[vo.any(1)] ** 2)) + 1e-9)
full += vo * vlev; full[: len(wet_v)] += wet_v * vlev * 0.5; full[: len(wet_big)] += wet_big * vlev * 0.45
full += sfx * (ref / 0.25)
over = full[LEN:]; full = full[:LEN]; k = min(LEN, len(over)); full[:k] += over[:k]               # the tail wraps onto the start
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
for nm, sg in (("inst", inst * duck[:, None]), ("voice", vo[:LEN] * vlev), ("sfx", sfx[:LEN] * (ref / 0.25))): print(nm.ljust(6), " ".join(f"{a}-{b}:{db(sg[at(a):at(b)]):.1f}" for a, b in ((0, 1.8), (1.8, 4.7), (4.7, 7.3), (7.3, 19.6), (19.6, 22.3), (22.3, 25.5))))
print("sections:", " ".join(f"{a}-{b}:{db(full[at(a):at(b)]):.1f}" for a, b in ((0, 1.8), (1.8, 4.7), (4.7, 7.3), (7.3, 19.6), (19.6, 22.3), (22.3, 25.5))))
sf.write("audio/mix_premaster.wav", full.astype(np.float32), SR, subtype="FLOAT")
def ln(x=""): return f"loudnorm=I=-14:TP=-1.0:LRA=11{x}"
p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", "audio/mix_premaster.wav", "-af", ln(":print_format=json"), "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S).group(0))
second = ln(f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix_premaster.wav", "-af", second + f",aresample={SR},alimiter=limit=0.79:level=false:latency=true", "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("pass-1:", m["input_i"], "LUFS", m["input_tp"], "dBTP")

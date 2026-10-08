"""Video #6 audio: cut "Could Be Wrong" on the beat grid, add reverb design + UI sound, master.

Usage:  python3 build_audio.py path/to/COULD_BE_WRONG.mp3
The song is never sped up or pitch-shifted. Reverb is a convolution hall (synthetic, decaying, darkening IR):
  * a reverb THROW on the last beat of the hi-hat build that washes through the song's own gap (b6-12)
  * a REVERSE-REVERB swell made from the drop itself, rising into the drop (b12)
  * a hall send on every UI sound (chimes, taps, keys) so they bloom instead of click
  * an END TAIL: the song fades into reverb and the tail is wrapped to the start, so the loop has no seam
Writes audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP).
"""
import json, re, subprocess, sys
import numpy as np, librosa, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
tl = json.load(open("timeline.json")); B = tl["beat"]
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
t = np.arange(LEN) / SR; b = t / B
rng = np.random.default_rng(6)

y, _ = librosa.load(sys.argv[1], sr=SR, mono=False)
s0 = int(round(tl["songStart"] * SR))
EXTRA = int(1.0 * B * SR)                                   # one beat past the end, for the end throw
song_full = y[:, s0:s0 + LEN + EXTRA].T.copy()

# ---------------------------------------------------------------- reverb
def lp(x, f, o=2): return sosfilt(butter(o, f, "lowpass", fs=SR, output="sos"), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, "highpass", fs=SR, output="sos"), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), x, axis=0)

def make_ir(rt60, predelay=0.025, bright=7000, dark=1800, seed=1):
    r = np.random.default_rng(seed); n = int(rt60 * 1.1 * SR); tt = np.arange(n) / SR
    env = np.exp(-6.9 * tt / rt60)
    nz = r.standard_normal((n, 2))
    mix = np.clip(tt / (rt60 * 0.5), 0, 1)[:, None]          # the tail darkens as it decays
    ir = (lp(nz, bright) * (1 - mix) + lp(nz, dark) * mix) * env[:, None]
    ir[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    for d, g in ((0.011, 0.5), (0.019, 0.38), (0.029, 0.3), (0.041, 0.22)):          # early reflections
        k = int(d * SR); ir[k, 0] += g * r.uniform(0.8, 1.2); ir[k + int(0.0013 * SR), 1] += g * r.uniform(0.8, 1.2)
    ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum(0).mean())

def verb(x, ir, lo=180):
    x = hp(x, lo)
    return np.stack([fftconvolve(x[:, c], ir[:, c]) for c in range(2)], 1)

HALL = make_ir(3.2, seed=2)            # big, long: throws + end tail
ROOM = make_ir(1.6, predelay=0.012, bright=9000, dark=3000, seed=3)     # UI sounds

def at(beat): return int(round(beat * B * SR))

# ---------------------------------------------------------------- song: dry with automation
song = song_full[:LEN].copy()
pts_b = [0, 0.12, 5.97, 6.0, 11.9, 12.0, 26.4, 28.0]
pts_db = [-30, 0, 0, -3, -3, 0, 0, -48]
song *= (10 ** (np.interp(b, pts_b, pts_db) / 20))[:, None]

wet = np.zeros((LEN + 8 * SR, 2))
def addwet(sig, i):
    j = min(len(wet), i + len(sig)); wet[i:j] += sig[: j - i]

# 1) throw: last beat of the build (b5-6) into the hall; rings through the gap
send = song_full[at(5):at(6)].copy() * np.linspace(0.3, 1, at(6) - at(5))[:, None]
addwet(verb(send, HALL) * 0.9, at(5))

# 2) reverse-reverb swell: the drop's first beat, reverbed, reversed, ending exactly on b12
drop_src = song_full[at(12):at(13)].copy()
rv = verb(drop_src, HALL)[::-1]
rv *= np.linspace(0, 1, len(rv))[:, None] ** 2.2
addwet(rv * 0.32, at(12) - len(rv))

# 3) end: the last beat + the overrun beat go into the hall while the dry song fades
tail_src = song_full[at(26.5):at(28) + EXTRA].copy() * np.interp(np.arange(at(28) + EXTRA - at(26.5)) / SR / B + 26.5, [26.5, 27.4, 28.6], [0.2, 1, 0])[:, None]
addwet(verb(tail_src, HALL) * 0.42, at(26.5))

# ---------------------------------------------------------------- UI sound design (E minor)
def env(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def sine(f, d): N = int(d * SR); f = np.broadcast_to(np.asarray(f, float), (N,)); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def st(m, pan=0.0): return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
def chime(f0, d=1.2, a=0.42):
    N = int(d * SR); m = sum(k * sine(f0 * r, d) * env(N, 0.002, dd) for r, k, dd in ((1, 1, 0.55), (2, 0.3, 0.3), (2.76, 0.18, 0.18), (5.4, 0.06, 0.08)))
    return st(m * a, 0.1)
def whoosh(d, lo, hi, a, pan=(-0.6, 0.6)):
    N = int(d * SR); nz = rng.standard_normal(N); o = np.zeros(N)
    for i in range(0, N, 1024):
        c = lo * (hi / lo) ** (i / N); o[i:i + 1024] = bp(nz[i:i + 1024], max(60, c * 0.6), min(SR / 2 - 100, c * 1.6), 1)
    m = o * np.sin(np.pi * np.linspace(0, 1, N) ** 0.7) ** 2 * a; p = np.linspace(*pan, N)
    return np.stack([m * np.cos((p + 1) * np.pi / 4), m * np.sin((p + 1) * np.pi / 4)], 1) * np.sqrt(2)
def key(): N = int(0.05 * SR); return st((bp(rng.standard_normal(N), 2500, 7000) * env(N, 0.0005, 0.006) + sine(rng.uniform(380, 520), 0.05) * env(N, 0.001, 0.012) * 0.4) * 0.5, rng.uniform(-0.25, 0.25))
def tap(): N = int(0.09 * SR); return st(sine(np.linspace(1500, 700, N), 0.09) * env(N, 0.001, 0.02) + lp(rng.standard_normal(N), 2000) * env(N, 0.0005, 0.01) * 0.5)
def drop():   # a calendar block landing: soft wooden pop, random pan
    N = int(0.1 * SR); return st((sine(np.geomspace(rng.uniform(600, 900), 250, N), 0.1) * env(N, 0.001, 0.025) + bp(rng.standard_normal(N), 1500, 5000) * env(N, 0.0003, 0.004) * 0.6) * 0.45, rng.uniform(-0.7, 0.7))
def ding(): return chime(rng.choice([1396.9, 1480.0, 1661.2]), 0.4, 0.18)        # off-key on purpose: stress
def err():
    N = int(0.3 * SR); m = np.sign(sine(207.6, 0.3)) * 0.25 + np.sign(sine(220, 0.3)) * 0.25
    return st(lp(m, 2500) * np.minimum(1, np.arange(N) / (0.005 * SR)) * np.exp(-np.arange(N) / (0.2 * SR)) * 0.45)
def toggle(): N = int(0.06 * SR); return st(bp(rng.standard_normal(N), 2000, 6000) * env(N, 0.0003, 0.006) * 0.8 + sine(1800, 0.06) * env(N, 0.0005, 0.01) * 0.3)
def card(): N = int(0.3 * SR); return st(sine(np.geomspace(220, 80, N), 0.3) * env(N, 0.002, 0.06) * 0.8 + bp(rng.standard_normal(N), 2500, 8000) * env(N, 0.0004, 0.004) * 0.5)
def sparkle():
    N = int(1.0 * SR); out = np.zeros((N, 2))
    for _ in range(26):
        o = int(rng.uniform(0, 0.5) * SR); d = rng.uniform(0.08, 0.25); f = rng.choice([1318.5, 1568.0, 1975.5, 2637.0, 3136.0])
        s2 = st(sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14), rng.uniform(-0.8, 0.8)); out[o:o + len(s2)] += s2[: N - o]
    return out
def boom(): d = 2.6; N = int(d * SR); return st(sine(np.geomspace(82.4, 41.2, N), d) * env(N, 0.004, 0.7) + sine(164.8, d) * env(N, 0.004, 0.25) * 0.12)

BANK = {"drop": drop, "ding": ding, "err": err, "key": key, "tap": tap, "toggle": toggle, "card": card, "sparkle": sparkle, "boom": boom,
        "freeze": lambda: whoosh(0.5, 6000, 300, 0.16)[::-1] * 1.2, "air": lambda: whoosh(1.8, 2000, 9000, 0.05, (0, 0)),
        "send": lambda: whoosh(0.45, 600, 7000, 0.2), "suck": lambda: whoosh(B, 300, 9000, 0.25)[::-1], "bloom": lambda: whoosh(1.0, 200, 3000, 0.16),
        "through": lambda: whoosh(0.4, 200, 7000, 0.18), "swish": lambda: whoosh(0.22, 1200, 7000, 0.09),
        "chime_e": lambda: chime(659.26), "chime_g": lambda: chime(783.99), "chime_b": lambda: chime(987.77, 1.0, 0.32), "chime_e_hi": lambda: chime(1318.5, 1.8, 0.5)}
PRE = {"suck": B, "send": 0.12, "swish": 0.1, "through": 0.15, "freeze": 0.5}
VERB_SEND = {"chime_e": 0.55, "chime_g": 0.55, "chime_b": 0.5, "chime_e_hi": 0.65, "sparkle": 0.6, "tap": 0.35, "key": 0.45, "toggle": 0.4,
             "card": 0.25, "boom": 0.35, "drop": 0.12, "ding": 0.2, "send": 0.4, "swish": 0.3}

dry = np.zeros((LEN + 8 * SR, 2)); fx = np.zeros_like(dry)
def place(buf, sig, sec):
    i = int(round(sec * SR))
    if i < 0: sig, i = sig[-i:], 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[: j - i]
events = [(k, "key") for k in tl["keyBeats"]] + [(k, kind) for k, kind in tl["sfx"]]
for k, kind in events:
    sig = BANK[kind](); sec = k * B - PRE.get(kind, 0.0)
    place(dry, sig, sec)
    if kind in VERB_SEND: place(fx, sig * VERB_SEND[kind], sec)
ui = dry + verb(fx[:len(dry)], ROOM)[: len(dry)] * 0.8

# UI bus level vs the song
ref = np.sqrt(np.mean(song[at(13):at(20)] ** 2))
ui *= (ref * 10 ** (-14 / 20)) / (np.sqrt(np.mean(ui[ui.any(1)] ** 2)) + 1e-9)
ui[at(6):at(12)] *= 1.8                                             # the quiet gap: keys + chimes read
wet_level = ref * 10 ** (-8 / 20) / (np.sqrt(np.mean(wet[at(6):at(7.5)] ** 2)) + 1e-9)     # set by the throw's first beats

full = np.zeros((LEN + 8 * SR, 2)); full[:LEN] += song
full += wet * wet_level + ui
# wrap everything past the loop point back onto the start: the end tail plays under the hook, the loop has no seam
over = full[LEN:]; full = full[:LEN]; n = min(LEN, len(over)); full[:n] += over[:n]
mix = full
sf.write("audio/mix_premaster.wav", mix.astype(np.float32), SR, subtype="FLOAT")
def ln(x=""): return f"loudnorm=I=-14:TP=-1.0:LRA=11{x}"
p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", "audio/mix_premaster.wav", "-af", ln(":print_format=json"), "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S).group(0))
second = ln(f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix_premaster.wav", "-af", second + f",aresample={SR},alimiter=limit=0.79:level=false", "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("pass-1:", m["input_i"], "LUFS", m["input_tp"], "dBTP")

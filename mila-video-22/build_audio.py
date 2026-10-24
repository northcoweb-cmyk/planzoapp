"""Video #22 audio: "She's Gone, Dance On" 2:03.740-2:28.813 + the agent's voice (Kokoro af_bella) + UI sound, master.

Usage:  python3 build_audio.py path/to/Shes_Gone_Dance_On.mp3
The song is never sped up or pitch-shifted.
  * voice chain: 85 Hz high-pass, de-mud cut at 300 Hz, presence lift 3.2 kHz, air shelf, 2:1-ish compression, a small plate
  * the song ducks ~9 dB under every voice line (40 ms attack, 350 ms release) and opens a 1.5-4 kHz pocket for the words
  * the drop (b36) lands on "...it SOLD" with a sub boom; the end tail wraps onto the start so the loop has no seam
Writes audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP).
"""
import json, re, subprocess, sys
import numpy as np, librosa, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
tl = json.load(open("timeline.json")); B = tl["beat"]
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
t = np.arange(LEN) / SR; b = t / B
rng = np.random.default_rng(12)

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

HALL = make_ir(3.2, seed=2)
BIG = make_ir(4.5, predelay=0.03, bright=9000, dark=2200, seed=4)    # the 99% wash            # big, long: throws + end tail
ROOM = make_ir(1.6, predelay=0.012, bright=9000, dark=3000, seed=3)     # UI sounds

def at(beat): return int(round(beat * B * SR))

# ---------------------------------------------------------------- song
song = song_full[:LEN].copy()
pts_b = [0, 0.05, 35.9, 36.0, 54.0, 56.0]
pts_db = [-30, -2, -2, 0, 0, -48]
song *= (10 ** (np.interp(b, pts_b, pts_db) / 20))[:, None]
wet = np.zeros((LEN + 8 * SR, 2))
def addwet(sig, i):
    j = min(len(wet), i + len(sig)); wet[i:j] += sig[: j - i]
# ---------------------------------------------------------------- the voice
from scipy.signal import lfilter
def peq(x, f0, gdb, q=1.0):
    A = 10 ** (gdb / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / (2 * q)
    bb = [1 + al * A, -2 * np.cos(w), 1 - al * A]; aa = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return lfilter(np.array(bb) / aa[0], np.array(aa) / aa[0], x, axis=0)
def shelf_hi(x, f0, gdb):
    A = 10 ** (gdb / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / 2 * np.sqrt(2); c = np.cos(w)
    bb = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al)]
    aa = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al]
    return lfilter(np.array(bb) / aa[0], np.array(aa) / aa[0], x, axis=0)
def comp(x, thr_db=-24, ratio=2.5, att=0.005, rel=0.12):
    e = np.abs(x); env_ = np.zeros_like(e); a1 = np.exp(-1 / (att * SR)); r1 = np.exp(-1 / (rel * SR)); v = 0.0
    for i in range(len(e)):
        c = a1 if e[i] > v else r1; v = c * v + (1 - c) * e[i]; env_[i] = v
    ldb = 20 * np.log10(env_ + 1e-9); g = np.where(ldb > thr_db, (thr_db - ldb) * (1 - 1 / ratio), 0)
    return x * 10 ** (g / 20)
vox = np.zeros(LEN + 2 * SR); gate = np.zeros(LEN + 2 * SR)
for n, sec, _, _ in tl["voice"]:
    v, vsr = sf.read(f"voice/{n}.wav")
    v = librosa.resample(v.astype(np.float64), orig_sr=vsr, target_sr=SR)
    i = int(round(sec * SR)); vox[i:i + len(v)] += v; gate[i:i + len(v)] = 1
vox = hp(vox[:, None], 85, 4)[:, 0]
vox = peq(vox, 300, -2.5, 0.9); vox = peq(vox, 3200, 2.5, 0.8); vox = shelf_hi(vox, 9000, 2.0)
vox = vox / (np.abs(vox).max() + 1e-9)
vox = comp(vox, thr_db=-26, ratio=3.5, att=0.003, rel=0.1)
vox = vox / (np.percentile(np.abs(vox[np.abs(vox) > 1e-4]), 99.5) + 1e-9); vox = np.tanh(vox * 0.9) / np.tanh(0.9)   # soft ceiling on the transients
vox_st = np.stack([vox, vox], 1)
PLATE = make_ir(0.9, predelay=0.018, bright=8000, dark=3500, seed=7)
vox_wet = verb(vox_st, PLATE, lo=250)[: len(vox_st)] * 0.07
vox_bus = (vox_st + vox_wet)[:LEN]
# the duck: an envelope over the voice gate (40 ms in, 350 ms out), pre-opened a touch before each line
gd = np.convolve(gate, np.ones(int(0.08 * SR)) / int(0.08 * SR), "same")[:LEN] > 0.01
dk = np.zeros(LEN); v_ = 0.0; aa_ = np.exp(-1 / (0.04 * SR)); rr_ = np.exp(-1 / (0.35 * SR))
for i in range(LEN):
    tgt = 1.0 if gd[i] else 0.0; c = aa_ if tgt > v_ else rr_; v_ = c * v_ + (1 - c) * tgt; dk[i] = v_
tdrop = tl["drop"] * B; l6 = [v for v in tl["voice"] if v[0] == "l6"][0][1]
i0, i1 = int(tdrop * SR), int((l6 - 0.06) * SR); dk[i0:i1] = 0                       # the drop is never ducked
for i in range(i1, LEN):                                                          # re-run the follower from there so it's continuous
    tgt = 1.0 if gd[i] else 0.0; c = aa_ if tgt > dk[i - 1] else rr_; dk[i] = c * dk[i - 1] + (1 - c) * tgt
depth = np.where(np.arange(LEN) / SR < tdrop, 9.0, 4.0)
pocket = bp(song, 1500, 4000, 2)
song = song * (1 - dk * (1 - 10 ** (-depth / 20)))[:, None] - pocket * (dk * np.where(depth > 5, 0.35, 0.15))[:, None]
tail_src = song_full[at(54.0):at(56) + EXTRA].copy() * np.interp(np.arange(at(56) + EXTRA - at(54.0)) / SR / B + 54.0, [54.0, 55.3, 57], [0.15, 1, 0])[:, None]
addwet(verb(tail_src, HALL) * 0.36, at(54.0))

# ---------------------------------------------------------------- sound design (E major)
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
def tap(): N = int(0.09 * SR); return st(sine(np.linspace(1500, 700, N), 0.09) * env(N, 0.001, 0.02) + lp(rng.standard_normal(N), 2000) * env(N, 0.0005, 0.01) * 0.5)
def card(): N = int(0.3 * SR); return st(sine(np.geomspace(220, 80, N), 0.3) * env(N, 0.002, 0.06) * 0.8 + bp(rng.standard_normal(N), 2500, 8000) * env(N, 0.0004, 0.004) * 0.5)
def sparkle():
    N = int(1.0 * SR); out = np.zeros((N, 2))
    for _ in range(24):
        o = int(rng.uniform(0, 0.5) * SR); d = rng.uniform(0.08, 0.25); f = rng.choice([1046.5, 1244.5, 1568.0, 2093.0, 2489.0])
        s2 = st(sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14), rng.uniform(-0.8, 0.8)); out[o:o + len(s2)] += s2[: N - o]
    return out
def boom(): d = 2.6; N = int(d * SR); return st(sine(np.geomspace(65.4, 32.7, N), d) * env(N, 0.004, 0.7) + sine(130.8, d) * env(N, 0.004, 0.25) * 0.12)
def click(a=1.0):                                 # one split-flap leaf hitting its stop
    N = int(0.012 * SR); x = bp(rng.standard_normal(N), 1800, 7000) * env(N, 0.0002, 0.0018) + sine(rng.uniform(2200, 3200), 0.012) * env(N, 0.0002, 0.002) * 0.5
    return st(x * a * 0.6, rng.uniform(-0.8, 0.8))
def clatter(n, dur):                             # a burst of split-flap leaves, dense at the start
    N = int((dur + 0.05) * SR); out = np.zeros((N, 2))
    for _ in range(n):
        o = int(dur * rng.random() ** 1.6 * SR); c = click(rng.uniform(0.3, 1.0)); out[o:o + len(c)] += c[: N - o]
    return out
def notif(): f = rng.choice([1318.51, 1567.98]); N = int(0.4 * SR); m = sine(f, 0.4) * env(N, 0.001, 0.08) + sine(f * 1.5, 0.4) * env(N, 0.06, 0.1) * 0.6; return st(m * 0.3, rng.uniform(-0.3, 0.3))
def pa():                                        # airport PA chime: three soft bell tones
    out = np.zeros((int(1.8 * SR), 2))
    for k, f in enumerate([783.99, 622.25, 523.25]):
        s2 = chime(f, 1.2, 0.3); o = int(k * 0.22 * SR); out[o:o + len(s2)] += s2[: len(out) - o]
    return out
def tap(): N = int(0.09 * SR); return st(sine(np.linspace(1500, 700, N), 0.09) * env(N, 0.001, 0.02) + lp(rng.standard_normal(N), 2000) * env(N, 0.0005, 0.01) * 0.5)
def card(): N = int(0.3 * SR); return st(sine(np.geomspace(220, 80, N), 0.3) * env(N, 0.002, 0.06) * 0.8 + bp(rng.standard_normal(N), 2500, 8000) * env(N, 0.0004, 0.004) * 0.5)
def sparkle():
    N = int(1.0 * SR); out = np.zeros((N, 2))
    for _ in range(24):
        o = int(rng.uniform(0, 0.5) * SR); d = rng.uniform(0.08, 0.25); f = rng.choice([1046.5, 1174.66, 1318.51, 1567.98, 1760.0])
        s2 = st(sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14), rng.uniform(-0.8, 0.8)); out[o:o + len(s2)] += s2[: N - o]
    return out
def boom(): d = 2.6; N = int(d * SR); return st(sine(np.geomspace(110.0, 55.0, N), d) * env(N, 0.004, 0.7) + sine(220.0, d) * env(N, 0.004, 0.25) * 0.12)
def tick(): N = int(0.06 * SR); return st((sine(2400, 0.06) * env(N, 0.0008, 0.012) + bp(rng.standard_normal(N), 3000, 9000) * env(N, 0.0003, 0.004) * 0.6) * 0.45)
def listen():                                     # mic-on: two soft rising tones
    out = np.zeros((int(0.6 * SR), 2)); a = chime(880.0, 0.5, 0.18); b2 = chime(1174.66, 0.5, 0.18); out[:len(a)] += a; o = int(0.09 * SR); out[o:o + len(b2)] += b2[: len(out) - o]; return out
def pop(): N = int(0.12 * SR); return st(sine(np.geomspace(1100, 320, N), 0.12) * env(N, 0.002, 0.035) * 0.7)

def hit():                                        # word slam: sub thump + crisp transient
    N = int(0.35 * SR); return st(sine(np.geomspace(120, 45, N), 0.35) * env(N, 0.002, 0.08) * 0.9 + bp(rng.standard_normal(N), 2000, 9000) * env(N, 0.0003, 0.006) * 0.6)
def shutter():                                    # camera shutter: two mechanical clicks
    N = int(0.08 * SR); x = np.zeros(N)
    for o, a in ((0, 1.0), (int(0.028 * SR), 0.7)): n = int(0.01 * SR); x[o:o + n] += bp(rng.standard_normal(n), 1500, 8000) * env(n, 0.0002, 0.002) * a
    return st(x * 0.7, rng.uniform(-0.5, 0.5))
def stamp(): N = int(0.3 * SR); return st(sine(np.geomspace(180, 60, N), 0.3) * env(N, 0.001, 0.05) + lp(rng.standard_normal(N), 1500) * env(N, 0.001, 0.03) * 0.8)

def error():                                    # a soft two-tone "nope" (low, in key), with a little grit
    N = int(0.32 * SR); a = sine(329.63, 0.32) * env(N, 0.002, 0.07); b = sine(261.63, 0.32) * env(N, 0.002, 0.09)
    o = int(0.09 * SR); m = a.copy(); m[o:] += b[: N - o]; m = np.tanh(m * 1.6) * 0.5
    return st(m, rng.uniform(-0.3, 0.3))
def glitch():
    N = int(0.11 * SR); x = rng.standard_normal(N); x = np.repeat(x[::40], 40)[:N] * env(N, 0.001, 0.03)
    return st(bp(x, 600, 6000) * 0.7, rng.uniform(-0.7, 0.7))
BANK = {"notif": notif, "error": error, "glitch": glitch, "tick": tick, "card": card, "tap": tap, "sparkle": sparkle, "boom": boom, "pop": pop, "hit": hit, "shutter": shutter, "stamp": stamp,
        "chime": lambda: chime(rng.choice([880.0, 1046.5, 1318.51]), 0.9, 0.26), "chime_hi": lambda: chime(1760.0, 1.6, 0.42),
        "riser": lambda: whoosh(2.0, 300, 9000, 0.05), "air": lambda: whoosh(1.0, 2000, 9000, 0.05, (0, 0)), "send": lambda: whoosh(0.45, 600, 7000, 0.2),
        "bloom": lambda: whoosh(1.0, 200, 3000, 0.16), "whip": lambda: whoosh(0.22, 900, 8000, 0.12)}
PRE = {"send": 0.12, "whip": 0.1, "riser": 2.0 - 0.1}
VERB_SEND = {"error": 0.25, "glitch": 0.1, "chime": 0.5, "chime_hi": 0.65, "sparkle": 0.6, "tap": 0.35, "hit": 0.2, "boom": 0.3, "pop": 0.3, "stamp": 0.25, "shutter": 0.15}

dry = np.zeros((LEN + 8 * SR, 2)); fx = np.zeros_like(dry)
def place(buf, sig, sec):
    i = int(round(sec * SR))
    if i < 0: sig, i = sig[-i:], 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[: j - i]
events = [(k, kind) for k, kind in tl["sfx"]]
for k, kind in events:
    sig = BANK[kind](); sec = k * B - PRE.get(kind, 0.0)
    place(dry, sig, sec)
    if kind in VERB_SEND: place(fx, sig * VERB_SEND[kind], sec)
ui = dry + verb(fx[:len(dry)], ROOM)[: len(dry)] * 0.8

# UI bus level vs the song
ref = np.sqrt(np.mean(song[at(41):at(53)] ** 2))                     # the full drop is the reference level
ui *= (ref * 10 ** (-17 / 20)) / (np.sqrt(np.mean(ui[ui.any(1)] ** 2)) + 1e-9)
wet_level = 1.0

full = np.zeros((LEN + 8 * SR, 2)); full[:LEN] += song
bed = np.sqrt(np.mean(song[gd] ** 2)); vr = np.sqrt(np.mean(vox_bus[gd] ** 2)) + 1e-9
full[:LEN] += vox_bus * (bed * 10 ** (6.5 / 20) / vr)
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

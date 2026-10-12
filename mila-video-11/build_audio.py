"""Video #11 audio: cut "Too Much For Me (Extended)" + the voice on the beat grid, add reverb design + UI sound, master.

Usage:  python3 build_audio.py path/to/Too_Much_For_Me_Extended.mp3
The song is never sped up or pitch-shifted.
  * VOICE SECTION (b0-18.5): the song's breakdown is low-passed, sent into a big hall and ducked under the voice
    (sidechain from the voice envelope), so every word sits clearly on top of a soft reverb bed
  * THE COOL DROP: as the voice ends the filter opens, the song stutters in 1/8-beat re-triggers (b18.5-19.5),
    then cuts to a half-beat of silence filled by a reverse-reverb swell of the drop itself
  * FULL DROP on b20 (song beat 96, 0:45.12), dry and full-range
  * voice chain: high-pass, presence lift, soft compression, small room
Writes audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP).
"""
import json, re, subprocess, sys
import numpy as np, librosa, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
tl = json.load(open("timeline.json")); B = tl["beat"]
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
t = np.arange(LEN) / SR; b = t / B
rng = np.random.default_rng(11)

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

# ---------------------------------------------------------------- voice
from scipy.signal import sosfilt_zi
voice = np.zeros(LEN)
for i, st0 in enumerate(tl["voiceStarts"]):
    v, vsr = sf.read(f"assets/voice/p{i}.wav")
    if v.ndim > 1: v = v.mean(1)
    v = librosa.resample(v.astype(np.float64), orig_sr=vsr, target_sr=SR)
    k = int(round(st0 * SR)); voice[k:k + len(v)] += v[: LEN - k]
voice = sosfilt(butter(2, 90, "highpass", fs=SR, output="sos"), voice)
voice = voice + 0.35 * sosfilt(butter(2, [2500, 6000], "bandpass", fs=SR, output="sos"), voice)      # presence
pk = np.max(np.abs(voice)) + 1e-9; voice = np.tanh(voice / pk * 2.2) / np.tanh(2.2) * pk          # soft compression
venv = np.convolve(np.abs(voice), np.ones(int(0.03 * SR)) / int(0.03 * SR), mode="same")
venv_s = np.convolve(venv, np.ones(int(0.12 * SR)) / int(0.12 * SR), mode="same"); venv_s /= venv_s.max() + 1e-9
# envelope for the visuals (60 fps)
import json as _json
fr = np.arange(0, LEN, SR // 60); _json.dump([round(float(venv_s[i]), 3) for i in fr], open("audio/voice_env.json", "w"))

# ---------------------------------------------------------------- song
song = song_full[:LEN].copy()
def cutoff(x): return 1100.0 if x < 17.6 else (1100.0 * (16000 / 1100) ** ((x - 17.6) / 1.9) if x < 19.5 else 20000.0)
blk, zi, out = 256, None, np.zeros_like(song)
for i in range(0, LEN, blk):
    fc = cutoff((i + blk / 2) / SR / B); seg = song[i:i + blk]
    if fc >= 19999: out[i:i + blk] = seg; zi = None; continue
    sos = butter(2, fc, "lowpass", fs=SR, output="sos")
    if zi is None: zi = np.stack([sosfilt_zi(sos) * seg[0, c] for c in range(2)], -1)
    for c in range(2): out[i:i + blk, c], zi[..., c] = sosfilt(sos, seg[:, c], zi=zi[..., c])
song = out
# stutter: re-trigger the 1/8-beat slice at b18.5 eight times, gated, getting brighter (filter already opening)
sl = at(0.125); s0 = at(18.5); slice_ = song[s0:s0 + sl].copy()
g = np.ones(sl); g[int(sl * 0.7):] = np.linspace(1, 0, sl - int(sl * 0.7)); slice_ *= g[:, None]
for r in range(8): song[s0 + r * sl: s0 + (r + 1) * sl] = slice_ * (0.75 + 0.25 * r / 7)
pts_b = [0, 0.06, 18.49, 18.5, 19.49, 19.5, 19.995, 20.0, 37.5, 40.0]
pts_db = [-30, 0, 0, 4, 6, -90, -90, 0, 0, -48]
gain = 10 ** (np.interp(b, pts_b, pts_db) / 20)
duck = 10 ** (-9 * venv_s * (b < 18.6) / 20)                          # sidechain under the voice
song *= (gain * duck)[:, None]

wet = np.zeros((LEN + 8 * SR, 2))
def addwet(sig, i):
    j = min(len(wet), i + len(sig)); wet[i:j] += sig[: j - i]
# the reverb bed under the voice: the filtered song into the big hall, faded out before the stutter
bed = song[: at(18.5)].copy() * np.interp(np.arange(at(18.5)) / SR / B, [0, 0.3, 17.8, 18.5], [0, 1, 1, 0.4])[:, None]
addwet(verb(bed, BIG, lo=200) * 0.75, 0)
# the stutter's tail + a reverse-reverb swell of the drop into b20
addwet(verb(song[at(18.5):at(19.5)].copy(), HALL) * 0.5, at(18.5))
rv = verb(song_full[at(20):at(21)].copy(), HALL)[::-1]; rv *= np.linspace(0, 1, len(rv))[:, None] ** 2.5
addwet(rv[-at(3):] * 0.4, at(20) - min(len(rv), at(3)))
# end: the last bars into the hall while the dry song fades; wrapped onto the start below
tail_src = song_full[at(37.5):at(40) + EXTRA].copy() * np.interp(np.arange(at(40) + EXTRA - at(37.5)) / SR / B + 37.5, [37.5, 39, 41], [0.15, 1, 0])[:, None]
addwet(verb(tail_src, HALL) * 0.36, at(37.5))

# ---------------------------------------------------------------- sound design (D minor)
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
def notif(): f = rng.choice([1046.5, 1174.66]); N = int(0.4 * SR); m = sine(f, 0.4) * env(N, 0.001, 0.08) + sine(f * 1.5, 0.4) * env(N, 0.06, 0.1) * 0.6; return st(m * 0.3, rng.uniform(-0.3, 0.3))
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
        o = int(rng.uniform(0, 0.5) * SR); d = rng.uniform(0.08, 0.25); f = rng.choice([1174.66, 1396.9, 1760.0, 2349.3, 2793.8])
        s2 = st(sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14), rng.uniform(-0.8, 0.8)); out[o:o + len(s2)] += s2[: N - o]
    return out
def boom(): d = 2.6; N = int(d * SR); return st(sine(np.geomspace(73.4, 36.7, N), d) * env(N, 0.004, 0.7) + sine(146.8, d) * env(N, 0.004, 0.25) * 0.12)
def tick(): N = int(0.06 * SR); return st((sine(2400, 0.06) * env(N, 0.0008, 0.012) + bp(rng.standard_normal(N), 3000, 9000) * env(N, 0.0003, 0.004) * 0.6) * 0.45)
def listen():                                     # mic-on: two soft rising tones
    out = np.zeros((int(0.6 * SR), 2)); a = chime(880.0, 0.5, 0.18); b2 = chime(1174.66, 0.5, 0.18); out[:len(a)] += a; o = int(0.09 * SR); out[o:o + len(b2)] += b2[: len(out) - o]; return out
def pop(): N = int(0.12 * SR); return st(sine(np.geomspace(1100, 320, N), 0.12) * env(N, 0.002, 0.035) * 0.7)

BANK = {"tick": tick, "listen": listen, "card": card, "tap": tap, "sparkle": sparkle, "boom": boom, "pop": pop,
        "chime": lambda: chime(rng.choice([1174.66, 1396.9, 1760.0]), 0.9, 0.26), "chime_hi": lambda: chime(2349.3, 1.6, 0.42),
        "swoosh_up": lambda: whoosh(0.5, 400, 9000, 0.14), "send": lambda: whoosh(0.45, 600, 7000, 0.2), "through": lambda: whoosh(0.4, 200, 7000, 0.18)}
PRE = {"send": 0.12, "through": 0.15}
VERB_SEND = {"chime": 0.5, "chime_hi": 0.65, "sparkle": 0.6, "tap": 0.35, "card": 0.25, "listen": 0.5, "pop": 0.3, "boom": 0.3}

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
ref = np.sqrt(np.mean(song[at(21):at(31)] ** 2))                     # the full drop is the reference level
ui *= (ref * 10 ** (-15 / 20)) / (np.sqrt(np.mean(ui[ui.any(1)] ** 2)) + 1e-9)
wet_level = 1.0

vox = st(voice) / np.sqrt(2)
vox_room = verb(np.stack([voice, voice], 1), ROOM, lo=150)[:LEN] * 0.16
vref = np.sqrt(np.mean(voice[np.abs(voice) > 0.01] ** 2)) + 1e-9
vox_gain = (ref * 10 ** (5 / 20)) / vref                              # the voice sits ~5 dB over the drop level, far over the ducked bed
full = np.zeros((LEN + 8 * SR, 2)); full[:LEN] += song + (vox + vox_room) * vox_gain
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

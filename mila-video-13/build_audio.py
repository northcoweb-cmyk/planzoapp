"""Video #13 audio: cut "Can You Just Relax" on the beat grid, add reverb design + UI sound, master.

Usage:  python3 build_audio.py path/to/can_you_just_relax.mp3
The song is never sped up or pitch-shifted.
  * b0-14.5: the song's own breakdown (song beats 272-286.5), untouched: it is the build
  * THE HANG: at b14.5 ("And then…") the dry song cuts out and the beat before it is thrown into a 4.5 s hall, so the build
    hangs in reverb until the song's own pickup at b15.5; a reversed-reverb swell sucks into the drop at b16 (song beat 288, 2:15.01)
  * the drop: every screen lighting up is a notification ping; four beats of in-key ping swarms in a wide room
  * b19.55-20: reversed-reverb swell into the snap back to the phone
  * the end reverb tail wraps onto the start so the loop has no seam
Writes audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP).
"""

import json, re, subprocess, sys
import numpy as np, librosa, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
tl = json.load(open("timeline.json")); B = tl["beat"]
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
t = np.arange(LEN) / SR; b = t / B
rng = np.random.default_rng(13)

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
BIG = make_ir(4.5, predelay=0.03, bright=9000, dark=2200, seed=4)    # big, long: the hang
ROOM = make_ir(1.6, predelay=0.012, bright=9000, dark=3000, seed=3)     # UI sounds

def at(beat): return int(round(beat * B * SR))

# ---------------------------------------------------------------- song
song = song_full[:LEN].copy()
pts_b = [0, 0.05, 14.49, 14.5, 15.495, 15.5, 15.99, 16.0, 41.5, 44.0]
pts_db = [-26, 4, 4, -90, -90, 3, 3, 0, 0, -48]          # the breakdown sits +4 dB so the hook carries; the drop is the reference
song *= (10 ** (np.interp(b, pts_b, pts_db) / 20))[:, None]
wet = np.zeros((LEN + 8 * SR, 2))
def addwet(sig, i):
    i = max(0, i); j = min(len(wet), i + len(sig)); wet[i:j] += sig[: j - i]
# the hang: the beat before "And then…" thrown into the big hall, ducked hard when the drop lands
throw = song_full[at(13.5):at(14.5)].copy() * np.linspace(0.4, 1, at(14.5) - at(13.5))[:, None]
wash = verb(throw, BIG, lo=220)
duck = np.ones(len(wash)); k0 = at(16) - at(13.5); kr = int(0.1 * SR)
duck[k0:] = np.concatenate([np.linspace(1, 0.12, kr), np.full(max(0, len(wash) - k0 - kr), 0.12)])[: len(wash) - k0]
addwet(wash * duck[:, None] * 1.0, at(13.5))
# reversed-reverb swells: into the drop (from the drop's own first beat) and into the snap back to the phone (from b19)
def swell(src_b0, src_b1, end_b, gain):
    src = song_full[at(src_b0):at(src_b1)].copy(); r = verb(src, HALL, lo=250)[: int(1.6 * B * SR)]
    r = r[::-1] * np.linspace(0, 1, len(r))[:, None] ** 2; addwet(r * gain, at(end_b) - len(r))
swell(16, 17, 16, 0.55)
swell(19, 19.5, 20, 0.45)
tail_src = song_full[at(41.5):at(44) + EXTRA].copy() * np.interp(np.arange(at(44) + EXTRA - at(41.5)) / SR / B + 41.5, [41.5, 43, 45], [0.15, 1, 0])[:, None]
addwet(verb(tail_src, HALL) * 0.36, at(41.5))

# ---------------------------------------------------------------- sound design (E-flat major pentatonic)
PENT = [622.25, 698.46, 783.99, 932.33, 1046.5, 1244.51, 1396.91, 1567.98, 1864.66, 2093.0, 2489.02]
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
def notif():                                      # phone notification: two quick in-key tones
    f = rng.choice([1244.51, 1396.91, 1567.98]); N = int(0.45 * SR); m = sine(f, 0.45) * env(N, 0.001, 0.07) * 0.8
    o = int(0.075 * SR); m[o:] += (sine(f * 1.335, 0.45) * env(N, 0.001, 0.12))[: N - o]
    return st(m * 0.32, rng.uniform(-0.25, 0.25))
def ping(a=0.16, pan=None):                       # one far-away phone lighting up
    f = rng.choice(PENT[4:]); d = rng.uniform(0.12, 0.3); N = int(d * SR)
    return st((sine(f, d) + 0.25 * sine(f * 2, d)) * env(N, 0.001, d / 4) * a, rng.uniform(-0.9, 0.9) if pan is None else pan)
def swarm():                                      # a whole city of screens pinging: dense at the downbeat, thinning out
    N = int(1.2 * SR); out = np.zeros((N, 2))
    for _ in range(70):
        o = int(B * rng.random() ** 2.2 * SR); s2 = ping(rng.uniform(0.03, 0.11)); out[o:o + len(s2)] += s2[: N - o]
    return out
def tap(): N = int(0.09 * SR); return st(sine(np.linspace(1500, 700, N), 0.09) * env(N, 0.001, 0.02) + lp(rng.standard_normal(N), 2000) * env(N, 0.0005, 0.01) * 0.5)
def card(): N = int(0.3 * SR); return st(sine(np.geomspace(220, 80, N), 0.3) * env(N, 0.002, 0.06) * 0.8 + bp(rng.standard_normal(N), 2500, 8000) * env(N, 0.0004, 0.004) * 0.5)
def sparkle():
    N = int(1.0 * SR); out = np.zeros((N, 2))
    for _ in range(24):
        o = int(rng.uniform(0, 0.5) * SR); d = rng.uniform(0.08, 0.25); f = rng.choice(PENT[4:])
        s2 = st(sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14), rng.uniform(-0.8, 0.8)); out[o:o + len(s2)] += s2[: N - o]
    return out
def boom(): d = 2.6; N = int(d * SR); return st(sine(np.geomspace(77.78, 38.89, N), d) * env(N, 0.004, 0.7) + sine(155.56, d) * env(N, 0.004, 0.25) * 0.12)
def tick(): N = int(0.06 * SR); return st((sine(2400, 0.06) * env(N, 0.0008, 0.012) + bp(rng.standard_normal(N), 3000, 9000) * env(N, 0.0003, 0.004) * 0.6) * 0.4, rng.uniform(-0.3, 0.3))
def pop(): N = int(0.12 * SR); return st(sine(np.geomspace(1100, 320, N), 0.12) * env(N, 0.002, 0.035) * 0.7)
def hit():                                        # word slam: sub thump + crisp transient
    N = int(0.35 * SR); return st(sine(np.geomspace(120, 45, N), 0.35) * env(N, 0.002, 0.08) * 0.9 + bp(rng.standard_normal(N), 2000, 9000) * env(N, 0.0003, 0.006) * 0.6)
def snap():                                       # landing back on the phone
    N = int(0.25 * SR); return st(sine(np.geomspace(300, 70, N), 0.25) * env(N, 0.001, 0.05) * 0.9 + bp(rng.standard_normal(N), 1500, 9000) * env(N, 0.0003, 0.01) * 0.8)

BANK = {"notif": notif, "ping": ping, "swarm": swarm, "tick": tick, "card": card, "tap": tap, "sparkle": sparkle, "boom": boom, "pop": pop, "hit": hit, "snap": snap,
        "chime": lambda: chime(rng.choice([932.33, 1046.5, 1244.51]), 0.9, 0.26), "chime_hi": lambda: chime(1864.66, 1.6, 0.42),
        "riser": lambda: whoosh(3.0, 300, 9000, 0.05), "air": lambda: whoosh(1.0, 2000, 9000, 0.05, (0, 0)), "swipe": lambda: whoosh(0.24, 1500, 7000, 0.07),
        "rewind": lambda: whoosh(0.3, 7000, 900, 0.1, (0.6, -0.6)), "zoomin": lambda: whoosh(0.3 * 0 + B * 0.45, 400, 9000, 0.16, (0, 0)),
        "bloom": lambda: whoosh(1.0, 200, 3000, 0.16), "whip": lambda: whoosh(0.22, 900, 8000, 0.12)}
PRE = {"whip": 0.1, "riser": 3.0 - 0.1, "swipe": 0.06, "rewind": 0.05, "zoomin": B * 0.45 - 0.04}
VERB_SEND = {"notif": 0.35, "ping": 0.7, "swarm": 0.8, "chime": 0.5, "chime_hi": 0.65, "sparkle": 0.6, "tap": 0.35, "hit": 0.2, "boom": 0.3, "pop": 0.3, "snap": 0.25, "tick": 0.15}

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
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

# UI bus level vs the song
ref = np.sqrt(np.mean(song[at(17):at(33)] ** 2))                     # the full drop is the reference level
ui *= (ref * 10 ** (-17 / 20)) / (np.sqrt(np.mean(ui[ui.any(1)] ** 2)) + 1e-9)
wet_level = 1.0
ui *= (10 ** (np.interp(np.arange(len(ui)) / SR / B, [0, 15.9, 16.0], [5, 5, 0]) / 20))[:, None]   # the build UI sits +5 dB: the pings tell the story

for nm, sig in (("song", song), ("wet", wet[:LEN]), ("ui", ui[:LEN])):
    print(nm.ljust(5), " ".join(f"{a}-{c}:{db(sig[at(a):at(c)]):6.1f}" for a, c in ((0, 2), (2, 8), (8, 13.5), (13.5, 14.5), (14.5, 15.5), (16, 20), (20, 32))))
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
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix_premaster.wav", "-af", second + f",aresample={SR},alimiter=limit=0.79:level=false:latency=true", "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("pass-1:", m["input_i"], "LUFS", m["input_tp"], "dBTP")

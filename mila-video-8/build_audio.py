"""Video #8 audio: cut "How Deep Is Your Love (UK House)" on the beat grid, add reverb design + UI sound, master.

Usage:  python3 build_audio.py path/to/How_Deep_Is_Your_Love.mp3
The song is never sped up or pitch-shifted. Reverb is a convolution hall/room (synthetic, darkening IR):
  * a room send on the 8-bit SFX (square/pulse/noise chip sounds) so they sit in the track
  * a short reverse-reverb swell into the drop / GO (b12)
  * an END TAIL: the song fades into the hall and the tail is wrapped to the start, so the loop has no seam
Writes audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP).
"""
import json, re, subprocess, sys
import numpy as np, librosa, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
tl = json.load(open("timeline.json")); B = tl["beat"]
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
t = np.arange(LEN) / SR; b = t / B
rng = np.random.default_rng(8)

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
pts_b = [0, 0.06, 37.5, 40.0]
pts_db = [-30, 0, 0, -48]
song *= (10 ** (np.interp(b, pts_b, pts_db) / 20))[:, None]

wet = np.zeros((LEN + 8 * SR, 2))
def addwet(sig, i):
    j = min(len(wet), i + len(sig)); wet[i:j] += sig[: j - i]

# reverse-reverb swell into GO, made from the drop's first beat
rv = verb(song_full[at(12):at(13)].copy(), HALL)[::-1]
rv *= np.linspace(0, 1, len(rv))[:, None] ** 2.5
addwet(rv[-at(4):] * 0.28, at(12) - min(len(rv), at(4)))
# end: the last bars go into the hall while the dry song fades; wrapped onto the start below
tail_src = song_full[at(37.5):at(40) + EXTRA].copy() * np.interp(np.arange(at(40) + EXTRA - at(37.5)) / SR / B + 37.5, [37.5, 39, 41], [0.15, 1, 0])[:, None]
addwet(verb(tail_src, HALL) * 0.36, at(37.5))

# ---------------------------------------------------------------- 8-bit SFX (chip voices, tuned to E minor / G major)
def env(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def sine(f, d): N = int(d * SR); f = np.broadcast_to(np.asarray(f, float), (N,)); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def st(m, pan=0.0): return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
def pulse(f, d, duty=0.5):
    N = int(d * SR); f = np.broadcast_to(np.asarray(f, float), (N,)); ph = np.cumsum(f) / SR % 1.0
    return np.where(ph < duty, 1.0, -1.0) * 0.5
def tri(f, d): N = int(d * SR); f = np.broadcast_to(np.asarray(f, float), (N,)); ph = np.cumsum(f) / SR % 1.0; return (4 * np.abs(ph - 0.5) - 1) * 0.6
def chipnoise(d, rate=8000):
    N = int(d * SR); step = max(1, int(SR / rate)); v = rng.uniform(-1, 1, N // step + 2); return np.repeat(v, step)[:N] * 0.5
def gate(x, a=0.002, d=0.08): N = len(x); return x * env(N, a, d)
def notes(seq, dur, duty=0.25, decay=None):        # arpeggio: list of Hz, each `dur` s
    return np.concatenate([gate(pulse(f, dur, duty), 0.001, decay or dur * 0.8) for f in seq])
E5, G5, A5, B5, D6, E6, G6, B6, E4, A4 = 659.26, 783.99, 880.0, 987.77, 1174.66, 1318.5, 1567.98, 1975.53, 329.63, 440.0
def blip(): return st(gate(pulse(B5, 0.06, 0.25), 0.001, 0.03) * 0.5, rng.uniform(-0.2, 0.2))
def coin(): return st(np.concatenate([gate(pulse(B5, 0.05, 0.5), 0.001, 0.05), gate(pulse(E6, 0.22, 0.5), 0.001, 0.12)]) * 0.45, rng.uniform(-0.4, 0.4))
def select(): return st(notes([E5, B5], 0.05, 0.125) * 0.5)
def check(i): return st(notes([[E5, G5, A5, B5, D6, E6][i], [E5, G5, A5, B5, D6, E6][i] * 2], 0.045, 0.25) * 0.45, -0.3 + 0.12 * i)
def allset(): return st(notes([G5, B5, D6, G6], 0.06, 0.25) * 0.5)
def ready(): return st(gate(pulse(np.geomspace(E4, E5, int(0.3 * SR)), 0.3, 0.5), 0.005, 0.25) * 0.4)
def beep(): return st(gate(pulse(A4, 0.18, 0.5), 0.002, 0.14) * 0.55)
def go(): return st((gate(pulse(A5, 0.5, 0.5), 0.002, 0.35) + gate(pulse(A5 * 1.5, 0.5, 0.25), 0.002, 0.3) * 0.5) * 0.45)
def boom(): d = 0.9; N = int(d * SR); return st((gate(chipnoise(d, 3000), 0.001, 0.25) * 0.7 + tri(np.geomspace(110, 40, N), d) * env(N, 0.002, 0.3)) * 0.8)
def split(): return st(notes([E6, B6], 0.07, 0.25) * 0.5)
def record(): return st(np.concatenate([notes([G5, B5, D6, G6], 0.07, 0.5), gate(pulse(G6, 0.6, 0.25), 0.002, 0.4) + gate(pulse(B6, 0.6, 0.125), 0.002, 0.4) * 0.5]) * 0.45)
def approve(): return st(notes([B5, E6, G6, B6], 0.06, 0.25) * 0.5)

BANK = {"blip": blip, "coin": coin, "select": select, "allset": allset, "ready": ready, "beep": beep, "go": go, "boom": boom, "split": split, "record": record, "approve": approve,
        **{"check%d" % i: (lambda i=i: check(i)) for i in range(6)}}
PRE = {}
VERB_SEND = {k: 0.3 for k in BANK}; VERB_SEND["boom"] = 0.2

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
ref = np.sqrt(np.mean(song[at(13):at(30)] ** 2))
ui *= (ref * 10 ** (-13 / 20)) / (np.sqrt(np.mean(ui[ui.any(1)] ** 2)) + 1e-9)
wet_level = 1.0

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

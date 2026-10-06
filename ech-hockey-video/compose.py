"""Original music + sound design for the East Coast Hockey video (no licensed audio).

140 BPM, D minor, i-VI-III-VII (Dm Bb F C). Form follows timeline.json:
hook (impact + puck crack) -> 6-beat build with riser and a 1/4-beat gap -> DROP A
(sticks) -> hockey-stop fill -> goal horn + DROP B (skates) -> goal horn + logo outro.
Writes audio/mix.wav at -14 LUFS, <= -1 dBTP, 48 kHz.
"""
import json, re, subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sawtooth

SR = 48000
tl = json.load(open("timeline.json"))
B = tl["beat"]; TOT = tl["totalBeats"]
LEN = int(round(np.ceil(tl["duration"] * tl["fps"]) / tl["fps"] * SR))
rng = np.random.default_rng(140)
S16 = B / 4

def n(dur): return int(dur * SR)
def env(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 100), "lowpass", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "highpass", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def osc(f, dur, kind="sin"):
    N = n(dur); f = np.broadcast_to(np.asarray(f, float), (N,)); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if kind == "sin" else sawtooth(ph) if kind == "saw" else np.sign(np.sin(ph))
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)

BUS = {k: np.zeros((LEN, 2)) for k in ('drums', 'bed')}; duck = np.ones(LEN)
def add(sig, beat, gain=1.0, pan=0.0, bus='drums'):
    i = int(round(beat * B * SR))
    if i >= LEN or i < 0: return
    j = min(LEN, i + len(sig)); s = sig[: j - i] * gain
    BUS[bus][i:j, 0] += s * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2); BUS[bus][i:j, 1] += s * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
def sidechain(beat, depth=0.6, rel=0.18):
    i = int(round(beat * B * SR)); N = n(rel * 2)
    if i >= LEN: return
    c = 1 - depth * np.exp(-np.arange(N) / (rel * SR / 3)); j = min(LEN, i + N); duck[i:j] = np.minimum(duck[i:j], c[: j - i])

# ---------------------------------------------------------------- instruments
def kick():
    d = 0.32; N = n(d)
    return np.tanh(2.2 * (osc(np.geomspace(160, 44, N), d) * env(N, 0.001, 0.11) + hp(rng.standard_normal(N), 3000) * env(N, 0.0003, 0.004) * 0.5)) * 0.9
def b808(freq, dur):
    N = n(dur); f = freq * (1 + 0.5 * np.exp(-np.arange(N) / (0.03 * SR)))
    return np.tanh(2.5 * osc(f, dur) * env(N, 0.002, dur * 0.55)) * 0.75
def clap():
    N = n(0.35); x = np.zeros(N)
    for k, o in enumerate([0, 0.011, 0.022]):
        i = n(o); b = bp(rng.standard_normal(N - i), 900, 3200) * env(N - i, 0.0005, 0.012 if k < 2 else 0.09); x[i:] += b
    return x * 0.9
def hat(open_=False):
    d = 0.18 if open_ else 0.05; N = n(d)
    return hp(rng.standard_normal(N), 7500) * env(N, 0.0005, 0.05 if open_ else 0.011) * (0.32 if open_ else 0.26)
def snare():
    N = n(0.2); return (bp(rng.standard_normal(N), 1500, 6000) * env(N, 0.0005, 0.05) + osc(190, 0.2) * env(N, 0.001, 0.04) * 0.4) * 0.7
def pluck(freq, dur=0.32):
    N = n(dur); x = (osc(freq, dur, "saw") + osc(freq * 1.006, dur, "saw") + 0.5 * osc(freq * 2, dur, "saw")) / 2.5
    out = np.zeros(N); blk = 512
    for i in range(0, N, blk):   # filter envelope
        fc = 600 + 5200 * np.exp(-i / (0.07 * SR)); out[i:i + blk] = lp(x[i:i + blk], fc, 1)
    return out * env(N, 0.002, 0.16) * 0.42
def pad(freqs, dur, cutoff):
    N = n(dur); x = sum(osc(f * dt, dur, "saw") for f in freqs for dt in (0.995, 1.0, 1.005)) / (len(freqs) * 3)
    a = np.minimum(1, np.arange(N) / (0.08 * SR)) * np.minimum(1, (N - np.arange(N)) / (0.05 * SR))
    return lp(x, cutoff, 2) * a * 0.38
def riser(dur):
    N = n(dur); a = np.linspace(0, 1, N) ** 2.4; noise = rng.standard_normal(N); out = np.zeros(N)
    for i in range(0, N, 1024):
        c = 400 * (14000 / 400) ** (i / N); out[i:i + 1024] = bp(noise[i:i + 1024], c * 0.6, min(c * 1.5, 20000), 1)
    return (out * 0.6 + osc(np.geomspace(110, 880, N), dur, "saw") * 0.08) * a
def impact():
    N = n(2.6)
    sub = osc(np.geomspace(70, 30, N), 2.6) * env(N, 0.002, 0.7)
    crash = hp(rng.standard_normal(N), 4000) * env(N, 0.001, 0.9) * 0.35
    return np.tanh(1.6 * (sub + crash)) * 0.95
def puck_crack():   # puck off the glass / camera: sharp transient + hollow thock
    N = n(0.5)
    return (hp(rng.standard_normal(N), 2000) * env(N, 0.0002, 0.006) * 1.2 + osc(np.geomspace(1400, 600, N), 0.5) * env(N, 0.0005, 0.03) * 0.7 + lp(rng.standard_normal(N), 400) * env(N, 0.001, 0.08) * 0.4)
def slap():         # slap shot: stick on ice + crack
    N = n(0.4); return hp(rng.standard_normal(N), 1500) * env(N, 0.0003, 0.02) * 1.0 + osc(np.geomspace(500, 120, N), 0.4) * env(N, 0.001, 0.05) * 0.6
def hockey_stop(dur=0.75):   # skate blade spraying ice: gritty band noise, fast swell
    N = n(dur); grit = (rng.random(N) < 0.08) * rng.standard_normal(N) * 2
    x = bp(rng.standard_normal(N) + grit, 2200, 9500, 2)
    a = np.minimum(1, np.arange(N) / (0.05 * SR)) * np.exp(-np.maximum(0, np.arange(N) - n(0.25)) / (0.18 * SR))
    return x * a * 0.55
def goal_horn(dur=1.5):     # stadium goal horn: buzzy low chord with a little vibrato + room
    N = n(dur); vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * np.arange(N) / SR)
    x = sum(a * np.sign(np.sin(2 * np.pi * np.cumsum(np.full(N, f) * vib) / SR)) for f, a in ((146.8, 0.5), (220.0, 0.35), (293.7, 0.25)))
    x = lp(x, 1700, 2) * np.minimum(1, np.arange(N) / (0.04 * SR)) * np.minimum(1, (N - np.arange(N)) / (0.25 * SR))
    out = x.copy()
    for d, g in ((0.061, 0.35), (0.113, 0.25), (0.197, 0.18)): k = n(d); out[k:] += x[:-k] * g
    return out * 0.42
def whoosh(dur=0.35, lo=400, hi=8000):
    N = n(dur); noise = rng.standard_normal(N); out = np.zeros(N)
    for i in range(0, N, 1024):
        c = lo * (hi / lo) ** (i / N); out[i:i + 1024] = bp(noise[i:i + 1024], c * 0.6, min(c * 1.6, 20000), 1)
    return out * np.sin(np.pi * np.linspace(0, 1, N)) ** 2 * 0.35

# ---------------------------------------------------------------- song
CHORDS = [[62, 65, 69], [58, 62, 65], [65, 69, 72], [60, 64, 67]]   # Dm Bb F C (voiced around D4)
ROOT = [midi(38), midi(34), midi(41), midi(36)]                      # 808 roots: D2 Bb1 F2 C2
LEAD = [(0, 74), (2, 77), (4, 81), (5, 79), (6, 77), (8, 76), (10, 77), (12, 74),          # 2-bar motif in 8ths
        (16, 74), (18, 77), (20, 81), (21, 84), (22, 81), (24, 79), (26, 77), (28, 76)]

def bar_chord(b): return int(b // 4) % 4

# hook: impact + crack + long 808
add(impact(), 0, 1.0); add(puck_crack(), 0, 0.9); add(b808(midi(38), 1.6), 0, 0.9)
# build b2-8
for b in np.arange(2, 7.75, 0.5): add(hat(), b, 0.8, 0.3)
for b in np.arange(6, 7.75, 0.25): add(hat(), b + 0.125, 0.5, -0.3)
for b in range(4, 8): add(kick(), b, 0.8); sidechain(b, 0.4)
for b in np.concatenate([np.arange(6, 7, 0.5), np.arange(7, 7.5, 0.25), np.arange(7.5, 7.75, 0.125)]): add(snare(), b, 0.35 + 0.4 * (b - 6) / 1.75)
add(riser(5.75 * B), 2, 0.55)
for bar in range(0, 2):
    st = 2 + bar * 2.875; c = CHORDS[bar % 4]
    add(pad([midi(m) for m in c], 2.875 * B, 300 + 1500 * bar), st, 0.9, bus='bed')

def drop(b0, b1, extra=False):
    for b in np.arange(b0, b1, 1.0):
        bar_pos = (b - b0) % 4; ci = bar_chord(b - b0)
        if bar_pos == 0:
            add(pad([midi(m) for m in CHORDS[ci]], 4 * B, 2600), b, 0.8, bus='bed')
        # kick + 808 on 16th steps 0, 6, 10 of each bar (classic trap bounce)
    for b in np.arange(b0, b1, 4.0):
        if b >= b1: break
        ci = bar_chord(b - b0)
        for step in (0, 6, 10):
            t = b + step / 4
            if t >= b1 or (b1 - t) < 0.5 and b1 in (24,): continue
            add(kick(), t, 1.0); sidechain(t, 0.65)
            add(b808(ROOT[ci], {0: 6, 6: 4, 10: 6}[step] * S16 + 0.1), t, 1.0)
        for step in (8,):
            add(clap(), b + step / 4, 0.95, 0.05)
        for s in range(0, 16, 2): add(hat(), b + s / 4, 0.9, 0.25)
        roll = np.arange(14, 16, 0.5) if int((b - b0) / 4) % 2 == 0 else np.arange(12, 16, 2 / 3)
        for s in roll: add(hat(), b + s / 4, 0.55, -0.25)
        if extra:
            add(hat(True), b + 1.5, 0.7, 0.4); add(hat(True), b + 3.5, 0.7, -0.4)
            arp = [CHORDS[ci][k % 3] + 12 * (k // 3) for k in range(6)]
            for s in range(16): add(pluck(midi(arp[s % 6] + 12), 0.15), b + s / 4, 0.22, 0.5 * np.sin(s), bus='bed')
    for b in np.arange(b0, b1, 8.0):
        for step, m in LEAD:
            t = b + step / 2
            if t < b1 - 0.1: add(pluck(midi(m)), t, 0.9, -0.15, bus='bed')

drop(8, 24)
# fill b23-24: drums thin out, hockey stop sprays on 23.5, snare stutter
for t in np.arange(23, 23.5, 0.125): add(snare(), t, 0.5)
add(hockey_stop(0.8), 23.5, 1.0, 0.3); add(whoosh(0.5, 300, 9000), 23.4, 0.8)
drop(24, 40, extra=True)
add(goal_horn(1.6), 24, 1.0); add(impact(), 24, 0.6)
# punctuation inside the drops
add(slap(), 14, 1.0, 0.3); add(whoosh(0.3, 800, 9000), 13.85, 0.7, 0.5)
for t in (12, 16, 20, 28, 32): add(whoosh(0.3, 500, 8000), t - 0.12, 0.6, 0.0)
for t in (36, 37, 38): add(slap(), t, 0.5); add(kick(), t, 0.5)
add(hockey_stop(0.6), 24, 0.6, -0.3); add(hockey_stop(0.6), 32, 0.5, 0.3)
# outro b40-48: horn + impact on the logo, groove for one bar, then pad + 808 ring out
add(impact(), 40, 1.0); add(goal_horn(2.2), 40, 1.1); add(puck_crack(), 40, 0.6)
for b in np.arange(40, 44, 1.0): add(kick(), b, 0.8); sidechain(b, 0.5)
for b in np.arange(40, 44, 0.5): add(hat(), b, 0.7, 0.2)
add(clap(), 42, 0.8)
add(pad([midi(m) for m in CHORDS[0]], 6 * B, 1800), 42, 0.9, bus='bed'); add(b808(midi(38), 6 * B), 44, 0.8)

# ---------------------------------------------------------------- mix + master
mix = BUS['drums'] + BUS['bed'] * duck[:, None]   # pads/leads pump under the kick
t = np.arange(LEN) / SR
fade = np.clip((tl["duration"] - t) / (2 * B), 0, 1) ** 1.5           # last 2 beats ring to silence on beat 48
mix *= fade[:, None]
mix = np.tanh(mix * 0.9) / 0.9
sf.write("audio/mix_premaster.wav", mix.astype(np.float32), SR, subtype="FLOAT")
def ln(x=""): return f"loudnorm=I=-14:TP=-1.0:LRA=11{x}"
p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", "audio/mix_premaster.wav", "-af", ln(":print_format=json"), "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S).group(0))
second = ln(f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix_premaster.wav", "-af", second + f",aresample={SR},alimiter=limit=0.89:level=false", "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("pass-1:", m["input_i"], "LUFS", m["input_tp"], "dBTP")

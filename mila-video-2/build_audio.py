"""Video #2 audio: beat-grid cut, filter automation, city ambience, UI sounds, master.

Usage:  python3 build_audio.py path/to/song.mp3
Writes: audio/mix_premaster.wav, audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP)

No time-stretch or pitch-shift. The calm before the logo is a low-pass filter
sweep on the song (b48-56) with a synthesised riser, snapping open on the
final downbeat. UI sounds are synthesised and tuned to F major.
"""
import json, subprocess, sys, re
import numpy as np
import librosa, soundfile as sf
from scipy.signal import butter, sosfilt, sosfilt_zi

SR = 48000
tl = json.load(open("timeline.json"))
B = tl["beat"]; FPS = tl["fps"]
n_frames = int(np.ceil(tl["duration"] * FPS))
LEN = int(round(n_frames / FPS * SR))
rng = np.random.default_rng(23)
t = np.arange(LEN) / SR
beat = t / B

# ---------------------------------------------------------------- song cut
y, _ = librosa.load(sys.argv[1], sr=SR, mono=False)
s0 = int(round(tl["songStart"] * SR))
song = y[:, s0:s0 + LEN].T.copy()

# time-varying low-pass (2nd-order, per 256-sample block, state carried over)
F = tl["filter"]
def cutoff(b):
    if b < F["down"][0] or b >= F["open"]:
        return 20000.0
    if b < F["down"][1]:   # quick dive
        p = (b - F["down"][0]) / (F["down"][1] - F["down"][0])
        return float(np.exp(np.log(20000) + (np.log(F["cutoffLow"]) - np.log(20000)) * p))
    if b < F["riseStart"]:
        return float(F["cutoffLow"])
    p = (b - F["riseStart"]) / (F["open"] - F["riseStart"])   # slow lift under the riser
    return float(np.exp(np.log(F["cutoffLow"]) + (np.log(F["cutoffRise"]) - np.log(F["cutoffLow"])) * p ** 2))

blk = 256
out = np.zeros_like(song)
zi = None
for i in range(0, LEN, blk):
    fc = cutoff((i + blk / 2) / SR / B)
    seg = song[i:i + blk]
    if fc >= 19999:
        out[i:i + blk] = seg; zi = None; continue
    sos = butter(2, fc, "lowpass", fs=SR, output="sos")
    if zi is None:
        zi = np.stack([sosfilt_zi(sos) * seg[0, ch] for ch in range(2)], -1)
    for ch in range(2):
        out[i:i + blk, ch], zi[..., ch] = sosfilt(sos, seg[:, ch], zi=zi[..., ch])
song = out
# filtered section loses level - compensate gently so the "calm" still sits under the riser
calm = (beat >= F["down"][0]) & (beat < F["open"])
song[calm] *= 1.35

fade_in = np.clip(t / 0.3, 0, 1) ** 2
end = tl["duration"]; fo0 = end - 4 * B             # fade over the last bar, silent on beat 64
x = np.clip((t - fo0) / (end - fo0), 0, 1)
song *= (fade_in * np.cos(x * np.pi / 2) ** 1.5)[:, None]


# ---------------------------------------------------------------- synthesis helpers
def env(n, a, d):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    e[na:] = np.exp(-np.arange(n - na) / (d * SR)); return e
def bp(s, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), s)
def lp(s, f, o=2): return sosfilt(butter(o, f, "lowpass", fs=SR, output="sos"), s)
def hp(s, f, o=2): return sosfilt(butter(o, f, "highpass", fs=SR, output="sos"), s)
def sine(f, dur):
    n = int(dur * SR); f = np.broadcast_to(np.asarray(f, float), (n,))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def stereo(m, pan=0.0):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([m * l, m * r], 1) * np.sqrt(2)

def key():
    n = int(0.05 * SR)
    m = bp(rng.standard_normal(n), 2500, 7000) * env(n, 0.0005, 0.006) + sine(rng.uniform(380, 520), 0.05) * env(n, 0.001, 0.012) * 0.4
    return stereo(m * 0.5, rng.uniform(-0.25, 0.25))
def tick():
    n = int(0.06 * SR)
    m = sine(2400, 0.06) * env(n, 0.0008, 0.012) + bp(rng.standard_normal(n), 3000, 9000) * env(n, 0.0003, 0.004) * 0.6
    return stereo(m * 0.55, rng.uniform(-0.3, 0.3))
def tap():
    n = int(0.09 * SR)
    m = sine(np.linspace(1500, 700, n), 0.09) * env(n, 0.001, 0.02) + lp(rng.standard_normal(n), 2000) * env(n, 0.0005, 0.01) * 0.5
    return stereo(m * 0.8)
def pop():
    n = int(0.12 * SR); return stereo(sine(np.geomspace(1100, 320, n), 0.12) * env(n, 0.002, 0.035) * 0.7, rng.uniform(-0.2, 0.2))
def floor_thud():
    n = int(0.3 * SR)
    m = sine(np.geomspace(150, 60, n), 0.3) * env(n, 0.002, 0.08) + lp(rng.standard_normal(n), 900) * env(n, 0.0005, 0.01) * 0.5
    return stereo(m * 0.8)
def chime(f0, dur=1.1, amp=0.42):
    n = int(dur * SR); m = np.zeros(n)
    for r, a, d in ((1, 1, 0.5), (2.0, 0.35, 0.28), (2.76, 0.22, 0.18), (5.4, 0.08, 0.08)):
        m += a * sine(f0 * r, dur) * env(n, 0.002, d)
    return stereo(m * amp, 0.1)
def doorbell():   # two-tone "ding-dong" (A5 -> F5), the approve-tap match cut
    a = chime(880.0, 0.7, 0.38); b = chime(698.46, 1.0, 0.38)
    out = np.zeros((int(1.2 * SR), 2)); out[:len(a)] += a; o = int(0.22 * SR); out[o:o + len(b)] += b[: len(out) - o]
    return out
def whoosh(dur, lo, hi, amp, pan=(-0.6, 0.6)):
    n = int(dur * SR); noise = rng.standard_normal(n); o = np.zeros(n)
    for i in range(0, n, 1024):
        c = lo * (hi / lo) ** (i / n)
        o[i:i + 1024] = bp(noise[i:i + 1024], max(60, c * 0.6), min(SR / 2 - 100, c * 1.6), 1)
    m = o * np.sin(np.pi * np.clip(np.linspace(0, 1, n) ** 0.7, 0, 1)) ** 2 * amp
    p = np.linspace(*pan, n)
    return np.stack([m * np.cos((p + 1) * np.pi / 4), m * np.sin((p + 1) * np.pi / 4)], 1) * np.sqrt(2)
def slats():          # 9 quick shutter clicks across the stereo field
    out = np.zeros((int(0.5 * SR), 2))
    for k in range(9):
        s = tick() * 0.7; o = int(k * 0.028 * SR); out[o:o + len(s)] += s
    return out + whoosh(0.5, 800, 6000, 0.12)
def taxi():           # car pass-by with a doppler-ish drop
    dur = 1.4; n = int(dur * SR)
    rum = lp(rng.standard_normal(n), 500) * 0.6 + sine(np.linspace(110, 80, n), dur) * 0.15
    shape = np.exp(-((np.linspace(-1, 1, n)) ** 2) / 0.12)
    p = np.linspace(-0.9, 0.9, n); m = rum * shape * 0.5
    return np.stack([m * np.cos((p + 1) * np.pi / 4), m * np.sin((p + 1) * np.pi / 4)], 1) * np.sqrt(2)
def sparkle():
    n = int(0.9 * SR); out = np.zeros((n, 2))
    for _ in range(26):
        st = int(rng.uniform(0, 0.45) * SR); d = rng.uniform(0.08, 0.25)
        f = rng.choice([1396.91, 1760.0, 2093.0, 2793.83, 3520.0, 4186.0])
        g = sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14)
        s = stereo(g, rng.uniform(-0.8, 0.8)); out[st:st + len(s)] += s[: n - st]
    return out
def riser():          # 4-beat noise riser + rising F sine, peaks on the logo downbeat
    dur = 4 * B; n = int(dur * SR); a = np.linspace(0, 1, n) ** 2.4
    m = whoosh(dur, 300, 9000, 0.5, (0, 0))[:, 0] * a + sine(np.geomspace(174.6, 698.5, n), dur) * a * 0.12
    return stereo(m)
def boom():
    dur = 2.4; n = int(dur * SR)
    return stereo(sine(np.geomspace(87.3, 43.65, n), dur) * env(n, 0.004, 0.6) + sine(174.6, dur) * env(n, 0.004, 0.25) * 0.12)
def bloom():
    return whoosh(0.9, 200, 3000, 0.18)

BANK = {
    "tick": tick, "tap": tap, "pop": pop, "floor": floor_thud, "doorbell": doorbell, "taxi": taxi, "sparkle": sparkle,
    "riser": riser, "boom": boom, "bloom": bloom, "slats": slats,
    "chime_f": lambda: chime(698.46), "chime_a": lambda: chime(880.0), "chime_c": lambda: chime(1046.5),
    "chime_f_hi": lambda: chime(1396.91, 1.6, 0.5),
    "send": lambda: whoosh(0.45, 600, 7000, 0.2),
    "whoosh_soft": lambda: whoosh(0.5, 300, 4000, 0.16),
    "whoosh_down": lambda: whoosh(0.8, 4000, 250, 0.2, (0.3, -0.3)),
    "split": lambda: whoosh(0.35, 500, 8000, 0.22),
    "swish": lambda: whoosh(0.22, 1200, 7000, 0.09),
    "cube": lambda: whoosh(0.4, 400, 5000, 0.16),
    "sweep_night": lambda: whoosh(1.6, 6000, 150, 0.22, (0.6, -0.6)),
}
PREROLL = {"send": 0.15, "whoosh_soft": 0.22, "whoosh_down": 0.1, "split": 0.12, "swish": 0.1, "cube": 0.15,
           "riser": 4 * B, "taxi": 0.7, "bloom": 0.0, "slats": 0.0}

sfx = np.zeros((LEN, 2))
def place(sig, sec):
    i = int(round(sec * SR))
    if i < 0: sig, i = sig[-i:], 0
    j = min(LEN, i + len(sig))
    if j > i: sfx[i:j] += sig[: j - i]

for b in tl["keyBeats"]: place(key(), b * B)
for b in np.arange(tl["emailType"][0], tl["emailType"][1], 0.09): place(tick() * 0.25, b * B)
for b, kind in tl["sfx"]: place(BANK[kind](), b * B - PREROLL.get(kind, 0.0))

# city ambience bed: traffic rumble + air, brighter by day, softer at night, gone on the end card
amb = lp(rng.standard_normal(LEN), 700) * 0.6 + bp(rng.standard_normal(LEN), 1500, 6000) * 0.08
amb_r = lp(rng.standard_normal(LEN), 700) * 0.6 + bp(rng.standard_normal(LEN), 1500, 6000) * 0.08
lvl = np.interp(beat, [0, 1, 32, 34, 48, 52, 56, 57], [0.0, 1.0, 1.0, 0.7, 0.7, 0.4, 0.4, 0.0])
ambience = np.stack([amb, amb_r], 1) * lvl[:, None]

# bus levels under the song (UI ~-16 dB, ambience ~-26 dB relative)
sfx = np.tanh(sfx * 1.2) / 1.2
song_rms = np.sqrt(np.mean(song[int(13 * SR):int(18 * SR)] ** 2))
sfx *= (song_rms * 10 ** (-16 / 20)) / (np.sqrt(np.mean(sfx[sfx.any(1)] ** 2)) + 1e-9)
ambience *= (song_rms * 10 ** (-26 / 20)) / (np.sqrt(np.mean(ambience[lvl > 0.5] ** 2)) + 1e-9)
mix = song + sfx + ambience
mix[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))[:, None]
sf.write("audio/mix_premaster.wav", mix.astype(np.float32), SR, subtype="FLOAT")

def loudnorm(extra=""): return f"loudnorm=I=-14:TP=-1.0:LRA=11{extra}"
p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", "audio/mix_premaster.wav", "-af", loudnorm(":print_format=json"),
                    "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S).group(0))
second = loudnorm(f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
                  f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix_premaster.wav", "-af",
                second + f",aresample={SR},alimiter=limit=0.89:level=false", "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("pass-1 measured:", {k: m[k] for k in ("input_i", "input_tp")})

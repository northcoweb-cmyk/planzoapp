"""Video #3 audio: beat-grid cut, stamp/flap/keys sound design, master.

Usage:  python3 build_audio.py path/to/song.mp3
Writes: audio/mix_premaster.wav, audio/mix.wav (48 kHz, -14 LUFS, <= -1 dBTP)

No time-stretch or pitch-shift. UI sounds are synthesised and tuned to G minor.
"""
import json, subprocess, sys, re
import numpy as np
import librosa, soundfile as sf
from scipy.signal import butter, sosfilt

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

fade_in = np.clip(t / 0.3, 0, 1) ** 2
end = tl["duration"]; fo0 = end - 4 * B             # fade over the last bar, silent on beat 48
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
def riser():          # half-beat riser into the silence beat
    dur = 0.5 * B; n = int(dur * SR); a = np.linspace(0, 1, n) ** 2.4
    m = whoosh(dur, 300, 9000, 0.5, (0, 0))[:, 0] * a + sine(np.geomspace(196, 784, n), dur) * a * 0.12
    return stereo(m)
def boom():
    dur = 2.4; n = int(dur * SR)
    return stereo(sine(np.geomspace(98, 49, n), dur) * env(n, 0.004, 0.6) + sine(196, dur) * env(n, 0.004, 0.25) * 0.12)
def bloom():
    return whoosh(0.9, 200, 3000, 0.18)


def kick():
    dur = 0.6; n = int(dur * SR)
    return stereo(sine(np.geomspace(140, 38, n), dur) * env(n, 0.002, 0.18) * 1.2 + lp(rng.standard_normal(n), 3000) * env(n, 0.0005, 0.006) * 0.4)
def buzz():          # phone vibration on a dashboard
    dur = 0.38; n = int(dur * SR)
    m = np.sign(sine(170, dur)) * 0.3 + sine(170, dur) * 0.5
    return stereo(lp(m, 900) * env(n, 0.01, 0.2) * 0.6 * (np.sin(np.linspace(0, np.pi, n)) ** 0.5))
def stamp(big=False):  # rubber stamp: wood thud + paper slap
    dur = 0.5; n = int(dur * SR)
    m = sine(np.geomspace(220 if big else 260, 70, n), dur) * env(n, 0.001, 0.07) * (1.3 if big else 1.0)
    m += bp(rng.standard_normal(n), 800, 5000) * env(n, 0.0005, 0.015) * (0.9 if big else 0.7)
    return stereo(m)
def flap():          # split-flap rattle: 5 fast clicks
    out = np.zeros((int(0.25 * SR), 2))
    for k in range(5):
        s2 = tick() * 0.6; o = int(k * 0.035 * SR); out[o:o + len(s2)] += s2[: len(out) - o]
    return out
def roll():          # slot-machine reel: accelerating-then-slowing ticks over 1 beat
    out = np.zeros((int(B * SR) + 4000, 2)); ts = np.cumsum(np.linspace(0.02, 0.07, 14)); ts = ts / ts[-1] * (B * 0.95)
    for x in ts:
        s2 = tick() * 0.5; o = int(x * SR); out[o:o + len(s2)] += s2[: len(out) - o]
    return out
def lock():
    n = int(0.15 * SR); return stereo(sine(np.geomspace(900, 500, n), 0.15) * env(n, 0.001, 0.03) * 0.7 + bp(rng.standard_normal(n), 2000, 6000) * env(n, 0.0005, 0.006) * 0.5)
def keys():          # key jingle: cluster of inharmonic metal pings
    out = np.zeros((int(0.9 * SR), 2))
    for _ in range(9):
        o = int(rng.uniform(0, 0.35) * SR); d = rng.uniform(0.15, 0.4)
        m = sum(sine(f0 * r, d) * a for f0 in [rng.uniform(2500, 5200)] for r, a in ((1, 1), (2.4, 0.4), (3.9, 0.2)))
        s2 = stereo(m * env(int(d * SR), 0.0005, d / 5) * 0.12, rng.uniform(-0.5, 0.5)); out[o:o + len(s2)] += s2[: len(out) - o]
    return out
def burn():
    return whoosh(0.6, 200, 5000, 0.18)
def flash():
    return whoosh(0.4, 3000, 9000, 0.12)

BANK = {
    "tick": tick, "tap": tap, "pop": pop, "floor": floor_thud, "doorbell": doorbell, "taxi": taxi, "sparkle": sparkle,
    "riser": riser, "boom": boom, "bloom": bloom, "slats": slats, "kick": kick, "buzz": buzz, "stamp": stamp,
    "stamp_big": lambda: stamp(True), "flap": flap, "roll": roll, "lock": lock, "keys": keys, "burn": burn, "flash": flash,
    "burn_long": lambda: whoosh(1.2, 150, 6000, 0.2),
    "chime_g": lambda: chime(783.99), "chime_d": lambda: chime(1174.66), "chime_g_hi": lambda: chime(1567.98, 1.6, 0.5),
    "send": lambda: whoosh(0.45, 600, 7000, 0.2),
    "whoosh_soft": lambda: whoosh(0.5, 300, 4000, 0.16),
    "whoosh_down": lambda: whoosh(0.8, 4000, 250, 0.2, (0.3, -0.3)),
    "split": lambda: whoosh(0.35, 500, 8000, 0.22),
    "swish": lambda: whoosh(0.22, 1200, 7000, 0.09),
    "cube": lambda: whoosh(0.4, 400, 5000, 0.16),
    "through": lambda: whoosh(0.45, 200, 7000, 0.2),
    "whip": lambda: whoosh(0.3, 600, 8000, 0.2),
    "tick": tick,
    "sweep_night": lambda: whoosh(1.6, 6000, 150, 0.22, (0.6, -0.6)),
}
PREROLL = {"send": 0.15, "whoosh_soft": 0.22, "whoosh_down": 0.1, "split": 0.12, "swish": 0.1, "cube": 0.15,
           "riser": 0.0, "through": 0.15, "whip": 0.12, "burn_long": 0.0, "taxi": 0.7, "bloom": 0.0, "slats": 0.0}

sfx = np.zeros((LEN, 2))
def place(sig, sec):
    i = int(round(sec * SR))
    if i < 0: sig, i = sig[-i:], 0
    j = min(LEN, i + len(sig))
    if j > i: sfx[i:j] += sig[: j - i]

for b in np.arange(tl['followType'][0], tl['followType'][1], 0.07): place(key() * 0.8, b * B)
for b, kind in tl["sfx"]: place(BANK[kind](), b * B - PREROLL.get(kind, 0.0))

# bus levels under the song (UI ~-16 dB, ambience ~-26 dB relative)
sfx = np.tanh(sfx * 1.2) / 1.2
song_rms = np.sqrt(np.mean(song[int(11 * SR):int(16 * SR)] ** 2))
sfx *= (song_rms * 10 ** (-16 / 20)) / (np.sqrt(np.mean(sfx[sfx.any(1)] ** 2)) + 1e-9)
mix = song + sfx
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

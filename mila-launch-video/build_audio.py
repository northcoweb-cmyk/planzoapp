"""Cut the song on the beat grid, synthesise UI sounds, mix, master.

Usage:  python3 build_audio.py path/to/Desire.mp3
Writes: audio/mix_premaster.wav, audio/mix.wav (48 kHz, -14 LUFS, -1 dBTP)

The song is never time-stretched or pitch-shifted. It is cut from the same
decoder that produced the beat analysis, so the grid lines up sample-exact.
All UI sounds are synthesised here (no stock SFX) and tuned to G minor.
"""
import json, subprocess, sys, re
import numpy as np
import librosa, soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
tl = json.load(open("timeline.json"))
B = tl["beat"]
FPS = tl["fps"]
n_frames = int(np.ceil(tl["duration"] * FPS))
LEN = int(round(n_frames / FPS * SR))
rng = np.random.default_rng(11)

# ---------------------------------------------------------------- song cut
y, _ = librosa.load(sys.argv[1], sr=SR, mono=False)
s0 = int(round(tl["songStart"] * SR))
song = y[:, s0:s0 + LEN].T.copy()                     # (N, 2)
t = np.arange(LEN) / SR
fade_in = np.clip(t / 0.3, 0, 1) ** 2                 # 0.3 s fade-in
end = tl["duration"]                                   # beat 46 exactly
fo0 = end - 2 * B                                      # fade over the last 2 beats
x = np.clip((t - fo0) / (end - fo0), 0, 1)
fade_out = np.cos(x * np.pi / 2) ** 1.5                # equal-power-ish, lands at 0 on the beat
song *= (fade_in * fade_out)[:, None]


# ---------------------------------------------------------------- synthesis
def env(n, a, d, sr=SR):
    e = np.ones(n)
    na = max(1, int(a * sr)); e[:na] = np.linspace(0, 1, na)
    e[na:] = np.exp(-np.arange(n - na) / (d * sr))
    return e


def bp(sig, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), sig)


def lp(sig, f, order=2):
    return sosfilt(butter(order, f, "lowpass", fs=SR, output="sos"), sig)


def sine(f, dur, phase=0):
    n = int(dur * SR)
    f = np.broadcast_to(np.asarray(f, float), (n,))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def stereo(m, pan=0.0):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([m * l, m * r], 1) * np.sqrt(2)


def key():                       # mechanical-soft key tap
    n = int(0.05 * SR)
    click = bp(rng.standard_normal(n), 2500, 7000) * env(n, 0.0005, 0.006)
    body = sine(rng.uniform(380, 520), 0.05) * env(n, 0.001, 0.012) * 0.4
    return stereo((click + body) * 0.5, rng.uniform(-0.25, 0.25))


def tick():
    n = int(0.06 * SR)
    m = sine(2400, 0.06) * env(n, 0.0008, 0.012) + bp(rng.standard_normal(n), 3000, 9000) * env(n, 0.0003, 0.004) * 0.6
    return stereo(m * 0.55, rng.uniform(-0.3, 0.3))


def tap():
    n = int(0.09 * SR)
    m = sine(np.linspace(1500, 700, n), 0.09) * env(n, 0.001, 0.02) + lp(rng.standard_normal(n), 2000) * env(n, 0.0005, 0.01) * 0.5
    return stereo(m * 0.8)


def pop():
    n = int(0.12 * SR)
    m = sine(np.geomspace(1100, 320, n), 0.12) * env(n, 0.002, 0.035)
    return stereo(m * 0.7, rng.uniform(-0.2, 0.2))


def thock():
    n = int(0.25 * SR)
    m = sine(np.geomspace(190, 70, n), 0.25) * env(n, 0.002, 0.07) + lp(rng.standard_normal(n), 1200) * env(n, 0.0005, 0.008) * 0.6
    return stereo(m * 0.9)


def chime(f0, dur=1.1, amp=0.42):
    n = int(dur * SR); m = np.zeros(n)
    for ratio, a, d in ((1, 1, 0.5), (2.0, 0.35, 0.28), (2.76, 0.22, 0.18), (5.4, 0.08, 0.08)):
        m += a * sine(f0 * ratio, dur) * env(n, 0.002, d)
    return stereo(m * amp, 0.1)


def whoosh(dur, lo, hi, amp, sweep=True):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    # sweep a band through the noise in short blocks
    out = np.zeros(n); blk = 1024
    for i in range(0, n, blk):
        p = i / n
        c = (lo * (hi / lo) ** p) if sweep else np.sqrt(lo * hi)
        out[i:i + blk] = bp(noise[i:i + blk], max(60, c * 0.6), min(SR / 2 - 100, c * 1.6), 1)
    shape = np.sin(np.pi * np.clip(np.linspace(0, 1, n) ** 0.7, 0, 1)) ** 2
    m = out * shape * amp
    pan = np.linspace(-0.6, 0.6, n)
    return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)


def sparkle():
    n = int(0.9 * SR); out = np.zeros((n, 2))
    for _ in range(26):
        st = int(rng.uniform(0, 0.45) * SR); d = rng.uniform(0.08, 0.25)
        f = rng.choice([1567.98, 1864.66, 2349.32, 3135.96, 3729.31, 4698.63])   # G, Bb, D up high
        g = sine(f, d) * env(int(d * SR), 0.001, d / 4) * rng.uniform(0.05, 0.14)
        s = stereo(g, rng.uniform(-0.8, 0.8))
        out[st:st + len(s)] += s[: n - st]
    return out


def riser():                     # short air lift into the drop (send -> expansion)
    return whoosh(0.45 * B / 0.44, 400, 6000, 0.22)


def swell():                     # G sub swell into the logo, peaks on the downbeat
    dur = 2 * B; n = int(dur * SR)
    a = np.linspace(0, 1, n) ** 2.2
    m = sine(49.0, dur) * a * 0.9 + lp(rng.standard_normal(n), 900) * a * 0.12
    return stereo(m)


def boom():
    dur = 2.2; n = int(dur * SR)
    m = sine(np.geomspace(98, 49, n), dur) * env(n, 0.004, 0.55) * 1.0
    m += sine(196, dur) * env(n, 0.004, 0.25) * 0.12
    return stereo(m)


BANK = {
    "tick": tick, "tap": tap, "pop": pop, "thock": thock, "sparkle": sparkle,
    "riser": riser, "swell": swell, "boom": boom,
    "chime_g": lambda: chime(783.99), "chime_bb": lambda: chime(932.33),
    "chime_d": lambda: chime(1174.66), "chime_g_hi": lambda: chime(1567.98, 1.6, 0.5),
    "whoosh_soft": lambda: whoosh(0.5, 300, 4000, 0.16),
    "whoosh_big": lambda: whoosh(0.9, 180, 7000, 0.3),
    "whip": lambda: whoosh(0.32, 500, 8000, 0.2),
    "swish": lambda: whoosh(0.22, 1200, 7000, 0.09),
}
PREROLL = {"whoosh_soft": 0.22, "whoosh_big": 0.35, "whip": 0.14, "swish": 0.1,
           "riser": 0.45, "swell": 2 * B}   # these peak ON the beat, so start early

sfx = np.zeros((LEN, 2))


def place(sig, sec):
    i = int(round(sec * SR))
    if i < 0: sig, i = sig[-i:], 0
    j = min(LEN, i + len(sig))
    if j > i: sfx[i:j] += sig[: j - i]


for b in tl["keyBeats"]:
    place(key(), b * B)
for b0, b1 in [tl["emailType"]]:                 # fast "AI typing" texture, very quiet
    for b in np.arange(b0, b1, 0.09):
        place(tick() * 0.25, b * B)
for b, kind in tl["sfx"]:
    place(BANK[kind](), b * B - PREROLL.get(kind, 0.0))

# SFX bus sits underneath the song: ~-16 dB relative, soft-limited
sfx = np.tanh(sfx * 1.2) / 1.2
song_rms = np.sqrt(np.mean(song[int(4 * SR):] ** 2))
sfx_rms = np.sqrt(np.mean(sfx[sfx.any(1)] ** 2)) + 1e-9
sfx *= (song_rms * 10 ** (-16 / 20)) / sfx_rms
# the logo swell/boom are musical, let them sit a bit higher than the UI bus
mix = song + sfx
mix[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))[:, None]   # no click at the very end

sf.write("audio/mix_premaster.wav", mix.astype(np.float32), SR, subtype="FLOAT")

# ---------------------------------------------------------------- master: -14 LUFS, -1 dBTP
def loudnorm(extra=""):
    return f"loudnorm=I=-14:TP=-1.0:LRA=11{extra}"

p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", "audio/mix_premaster.wav", "-af",
                    loudnorm(":print_format=json"), "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S).group(0))
second = loudnorm(f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
                  f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix_premaster.wav", "-af",
                second + f",aresample={SR},alimiter=limit=0.89:level=false",
                "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix.wav"], check=True)
print("pass-1 measured:", {k: m[k] for k in ("input_i", "input_tp")})

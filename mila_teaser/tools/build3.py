"""delay announcement build ("Da Fonk", the 2:46.3 drop out of the long breakdown): local beat grid around the chosen drop -> beats_v2.json + the music mix.
Window: start on a beat 11 beats before the drop (drop ~4.68 s in); 7.0 s is 16.46 beats at 141 BPM, so the end gets a short
natural release starting on the last beat inside the window."""
import json, re, subprocess, numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt, sosfiltfilt
SONG, FPS, DUR, SR = '../music/track_v3.mp3', 60, 12.0, 48000
BPM, DROP = 127.10, 166.300                     # the big drop after the breakdown: local grid fit anchored on the drop hit
B = 60 / BPM; START = DROP - 11 * B
beats = [round(k * B, 4) for k in range(0, 40) if k * B <= DUR + 1e-6]
DRY_CUT_BEAT = 22            # dry to beat 22 (10.39 s), then the last bar rings out in a hall to 12 s
down = [round(b, 4) for k, b in enumerate(beats) if (k - 11) % 4 == 0]
# the real hits in the window (kick + clap/snare onsets), so every accent lands on something you can HEAR
_y, _ = librosa.load(SONG, sr=44100, mono=True, offset=START, duration=DUR)
HITS = []
for band, q in (((30, 120), 96), ((1500, 6000), 96)):
    xb = sosfiltfilt(butter(4, band, 'bandpass', fs=44100, output='sos'), _y)
    oe = librosa.onset.onset_strength(y=xb, sr=44100, hop_length=128); ot = librosa.frames_to_time(np.arange(len(oe)), sr=44100, hop_length=128)
    pk = librosa.util.peak_pick(oe, pre_max=8, post_max=8, pre_avg=20, post_avg=20, delta=np.percentile(oe, 90) * 0.5, wait=20)
    HITS += [(float(ot[i]), float(oe[i] / oe.max())) for i in pk if oe[i] > np.percentile(oe, q) * 0.6]
HITS.sort(); hits = []
for h in HITS:
    if not hits or h[0] - hits[-1][0] > 0.06: hits.append([round(h[0], 4), round(h[1], 3)])
def bt(k):
    """beat k, snapped to the nearest real hit within 1/8 beat"""
    g = k * B; near = [h[0] for h in hits if abs(h[0] - g) < B / 8]
    return round(min(near, key=lambda x: abs(x - g)) if near else g, 4)
cues = {'label': bt(0), 'owe': bt(1), 'notThisWeek': bt(3), 'date': bt(5), 'flip': bt(6), 'sorry': bt(7), 'but': bt(9),
        'drop': round(11 * B, 4), 'drop2': bt(12), 'drop3': bt(13), 'feats': [bt(14), bt(15), bt(16), bt(17)],
        'mila': bt(19), 'tagline': bt(20), 'cta': bt(21), 'dryCut': round(DRY_CUT_BEAT * B, 4)}
FEATS = [['follow-ups.', 'handled.'], ['every dm.', 'answered.'], ['your calendar.', 'synced.'], ['every listing.', 'written.']]
# ---------------------------------------------------------------- audio
y, _ = librosa.load(SONG, sr=SR, mono=False, offset=START, duration=DUR + 0.3); y = y[:, :int(DUR * SR)].T.copy(); t = np.arange(len(y)) / SR
lo = sosfiltfilt(butter(4, 120, 'lowpass', fs=SR, output='sos'), y.mean(1))
env = np.array([np.sqrt(np.mean(lo[int(f / FPS * SR):int((f + 1) / FPS * SR)] ** 2)) for f in range(int(DUR * FPS))])
env = np.convolve(env, np.ones(5) / 5, 'same'); env = (env - env.min()) / (env.max() - env.min() + 1e-9)
last_beat = max(b for b in beats if b <= DUR - 0.05)
y *= np.clip(t / 0.15, 0, 1)[:, None] ** 2                                     # 0.15 s fade in
# the vocal: a new word starts right at the end of the window, so the vocal stem closes just before it;
# the instrumental rings on and releases naturally from the last beat
voc, _ = librosa.load('analysis_v3/vocals.wav', sr=SR, mono=False, offset=START, duration=DUR + 0.3); voc = voc[:, :len(y)].T
inst = y - voc
y = inst + voc
# the end: dry song to beat 24, then the last bar (beats 20-24) is thrown into a long hall that rings out to 12 s
from scipy.signal import fftconvolve
def make_ir(rt60, predelay=0.03, seed=4):
    r = np.random.default_rng(seed); n = int(rt60 * 1.1 * SR); tt = np.arange(n) / SR
    nz = r.standard_normal((n, 2)); mixk = np.clip(tt / (rt60 * 0.5), 0, 1)[:, None]
    bright = sosfilt(butter(2, 9000, 'lowpass', fs=SR, output='sos'), nz, axis=0); dark = sosfilt(butter(2, 2200, 'lowpass', fs=SR, output='sos'), nz, axis=0)
    ir = (bright * (1 - mixk) + dark * mixk) * np.exp(-6.9 * tt / rt60)[:, None]; ir[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir]); return ir / np.sqrt((ir ** 2).sum(0).mean())
cut = int(DRY_CUT_BEAT * B * SR); a0 = int((DRY_CUT_BEAT - 4) * B * SR)
throw = y[a0:cut].copy() * np.linspace(0.25, 1, cut - a0)[:, None] ** 2
throw = sosfilt(butter(2, 200, 'highpass', fs=SR, output='sos'), throw, axis=0)
IR = make_ir(3.8)
wet = np.stack([fftconvolve(throw[:, c], IR[:, c]) for c in range(2)], 1)
tail = np.zeros_like(y); n_ = min(len(y) - a0, len(wet)); tail[a0:a0 + n_] = wet[:n_]
tail *= np.interp(t, [0, (DRY_CUT_BEAT - 2) * B, DRY_CUT_BEAT * B, DUR - 0.6, DUR], [0, 0, 1, 0.55, 0])[:, None] ** 1.2
dry_env = np.interp(t, [0, DRY_CUT_BEAT * B - 0.01, DRY_CUT_BEAT * B + 0.03, DUR], [1, 1, 0, 0])
y = y * dry_env[:, None] + tail * (np.sqrt(np.mean(y[a0:cut] ** 2)) / (np.sqrt(np.mean(tail[cut:cut + SR] ** 2)) + 1e-9)) * 0.55
rng = np.random.default_rng(16)
def envl(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def tap():
    N = int(0.05 * SR); nz = sosfilt(butter(2, [1800, 7000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(N)) * envl(N, 0.0005, 0.006)
    return nz + np.sin(2 * np.pi * np.cumsum(np.linspace(900, 400, N)) / SR) * envl(N, 0.0008, 0.01) * 0.4
def shimmer():
    N = int(1.6 * SR); out = np.zeros(N); tt = np.arange(N) / SR
    for f in (1108.7, 1396.9, 1661.2, 2217.5): out += np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(3, 6) * tt))
    air = sosfilt(butter(2, [5000, 12000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(N)) * 0.6
    return (out * 0.25 + air) * np.minimum(1, tt / 0.4) * np.exp(-np.maximum(0, tt - 0.5) / 0.6)
fx = np.zeros(len(y))
for T in (cues['flip'],): s = tap() * 1.2; i = int(T * SR); fx[i:i + len(s)] += s[: len(fx) - i]
sh = shimmer(); i = int((cues['mila'] - 0.2) * SR); fx[i:i + len(sh)] += sh[: len(fx) - i]
song_ref = np.sqrt(np.mean(y[int(cues['drop'] * SR):] ** 2)); fx *= song_ref * 10 ** (-15 / 20) / (np.sqrt(np.mean(fx[np.abs(fx) > 1e-6] ** 2)) + 1e-12)
mix = y + np.stack([fx, fx], 1) * 0.9
sf.write('public/audio/premaster_v3.wav', mix.astype(np.float32), SR, subtype='FLOAT')
def measure(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', p)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', p)[-1])
gain = 0.0
for it in range(6):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'public/audio/premaster_v3.wav', '-af', f'volume={gain}dB,alimiter=limit=0.84:level=false:latency=true,aresample={SR}',
                    '-ar', str(SR), '-c:a', 'pcm_s24le', 'public/audio/mix_v3.wav'], check=True)
    I, TP = measure('public/audio/mix_v3.wav'); print(f'loudness pass {it}: {I} LUFS, peak {TP} dBFS')
    if abs(I + 14) < 0.15: break
    gain += (-14 - I)
hits = [h for h in hits if h[0] < DRY_CUT_BEAT * B + 0.02]
out = {'feats': FEATS, 'hits': hits, 'fps': FPS, 'duration': DUR, 'bpm': BPM, 'beat': round(B, 5), 'songStart': round(START, 3), 'songEnd': round(START + DUR, 3), 'beats': beats, 'downbeats': down,
       'cues': cues, 'bass': [round(float(v), 3) for v in env]}
json.dump(out, open('src/beats_v3.json', 'w'), indent=1)
print('window', round(START, 3), '->', round(START + DUR, 3), '| drop in video', cues['drop'], '| downbeats', down)

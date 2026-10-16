"""v2 teaser build ("AD LA – Nicole Kidman"): local beat grid around the chosen drop -> beats_v2.json + the music mix.
Window: start on a beat 11 beats before the drop (drop ~4.68 s in); 7.0 s is 16.46 beats at 141 BPM, so the end gets a short
natural release starting on the last beat inside the window."""
import json, re, subprocess, numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt, sosfiltfilt
SONG, FPS, DUR, SR = '../music/track_v2.mp3', 60, 7.0, 48000
BPM, DROP = 141.12, 132.807                     # local fit around the drop (anchored on the drop kick, see README)
B = 60 / BPM; START = DROP - 11 * B
beats = [round(k * B, 4) for k in range(0, 17) if k * B <= DUR + 1e-6]
down = [round(b, 4) for k, b in enumerate(beats) if (k - 11) % 4 == 0]
bt = lambda k: round(k * B, 4)                                                  # time of beat k (fractions = subdivisions)
cues = {'grid': bt(0), 'weekend': bt(1), 'openHouses': bt(3), 'showings': bt(4), 'monday': bt(6), 'breath': bt(8),
        'typeStart': round(bt(8) + 0.08, 4), 'typeEnd': round(bt(10.6), 4), 'drop': bt(11), 'sent': [bt(11.5), bt(12), bt(12.5)],
        'mila': bt(13), 'tagline': bt(14), 'cta': bt(15)}
EVENTS = [[bt(3), 'sat', 13, 3, 'open house', '1–4 pm', 'peri'], [bt(3.5), 'sun', 12, 3, 'open house', '12–3 pm', 'peri'],
          [bt(4), 'sat', 9.5, 1, 'showing', '9:30 am', 'lav'], [bt(4.5), 'sun', 16, 1, 'showing', '4:00 pm', 'lav'], [bt(5), 'sat', 17, 1, 'showing', '5:00 pm', 'lav']]
NOTES = [[bt(6.5), 'follow up', '12 visitors from saturday'], [bt(7), 'reply', 'buyer question · 48 coral palm'],
         [bt(7.25), 'send', 'listing post · sea grape ln'], [bt(7.5), 'follow up', 'showing feedback']]
SENT = [['jordan ellis', 'thanks for coming saturday'], ['priya shah', 'disclosures attached'], ['the ellises', 'second showing?']]
PROMPT = 'follow up with everyone from saturday'
# ---------------------------------------------------------------- audio
y, _ = librosa.load(SONG, sr=SR, mono=False, offset=START, duration=DUR + 0.3); y = y[:, :int(DUR * SR)].T.copy(); t = np.arange(len(y)) / SR
lo = sosfiltfilt(butter(4, 120, 'lowpass', fs=SR, output='sos'), y.mean(1))
env = np.array([np.sqrt(np.mean(lo[int(f / FPS * SR):int((f + 1) / FPS * SR)] ** 2)) for f in range(int(DUR * FPS))])
env = np.convolve(env, np.ones(5) / 5, 'same'); env = (env - env.min()) / (env.max() - env.min() + 1e-9)
last_beat = max(b for b in beats if b <= DUR - 0.05)
y *= np.clip(t / 0.15, 0, 1)[:, None] ** 2                                     # 0.15 s fade in
# the vocal: a new word starts at 6.75 s and would be cut, so the vocal stem closes in the gap before it (6.30-6.70 s, ~-34 dB);
# the instrumental rings on and releases naturally from the last beat
voc, _ = librosa.load('analysis_v2/vocals.wav', sr=SR, mono=False, offset=START, duration=DUR + 0.3); voc = voc[:, :len(y)].T
inst = y - voc
voc *= np.interp(t, [0, 6.30, 6.62, DUR], [1, 1, 0, 0])[:, None]
inst *= np.interp(t, [0, last_beat, DUR], [1, 1, 0])[:, None] ** 1.5
y = inst + voc
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
fx = np.zeros(len(y)); n = len(PROMPT); T0, T1 = cues['typeStart'], cues['typeEnd']
for k, ch in enumerate(PROMPT):
    if ch != ' ' and k % 2 == 0: s = tap() * rng.uniform(0.6, 1.0); i = int((T0 + k / n * (T1 - T0)) * SR); fx[i:i + len(s)] += s[: len(fx) - i]
sh = shimmer(); i = int((cues['mila'] - 0.2) * SR); fx[i:i + len(sh)] += sh[: len(fx) - i]
song_ref = np.sqrt(np.mean(y[int(cues['drop'] * SR):] ** 2)); fx *= song_ref * 10 ** (-15 / 20) / (np.sqrt(np.mean(fx[np.abs(fx) > 1e-6] ** 2)) + 1e-12)
mix = y + np.stack([fx, fx], 1) * 0.9
sf.write('public/audio/premaster_v2.wav', mix.astype(np.float32), SR, subtype='FLOAT')
def measure(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', p)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', p)[-1])
gain = 0.0
for it in range(6):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'public/audio/premaster_v2.wav', '-af', f'volume={gain}dB,alimiter=limit=0.891:level=false:latency=true,aresample={SR}',
                    '-ar', str(SR), '-c:a', 'pcm_s24le', 'public/audio/mix_v2.wav'], check=True)
    I, TP = measure('public/audio/mix_v2.wav'); print(f'loudness pass {it}: {I} LUFS, peak {TP} dBFS')
    if abs(I + 14) < 0.15: break
    gain += (-14 - I)
out = {'fps': FPS, 'duration': DUR, 'bpm': BPM, 'beat': round(B, 5), 'songStart': round(START, 3), 'songEnd': round(START + DUR, 3), 'beats': beats, 'downbeats': down,
       'cues': cues, 'events': EVENTS, 'notes': NOTES, 'sent': SENT, 'prompt': PROMPT, 'bass': [round(float(v), 3) for v in env]}
json.dump(out, open('src/beats_v2.json', 'w'), indent=1)
print('window', round(START, 3), '->', round(START + DUR, 3), '| drop in video', cues['drop'], '| downbeats', down)

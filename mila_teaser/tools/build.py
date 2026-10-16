"""Build beats.json + the music mix for the chosen window. Usage: python3 tools/build.py <window index 0-2>"""
import json, re, subprocess, sys, numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt, sosfiltfilt
W = json.load(open('analysis/windows.json'))[int(sys.argv[1])]; A = json.load(open('analysis/analysis.json'))
FPS, DUR, SR = 60, 7.0, 48000
start, drop = W['start'], W['drop']
grid = np.array(A['grid']); beats = [round(float(b - start), 4) for b in grid if start - 1e-3 <= b <= start + DUR + 1e-3]
idx0 = int(np.argmin(np.abs(grid - start))); down = [b for k, b in enumerate(beats) if (idx0 + k - A['downPhase']) % 4 == 0]
D = round(drop - start, 4)
def snap(target, step=1.0):
    """nearest beat (step=1) or beat subdivision (step=0.5 / 0.25) to the storyboard target"""
    cands = [b + j * 0.5 * step for b in beats for j in range(int(round(1 / step)))]
    return round(min(cands, key=lambda c: abs(c - target)), 4)
cues = {'weekend': snap(0.6), 'openHouses': snap(1.4), 'showings': snap(1.9), 'monday': snap(2.6), 'breath': snap(D - 1.0), 'drop': D,
        'typeStart': round(snap(D - 1.0) + 0.05, 4), 'typeEnd': round(D - 0.16, 4), 'mila': snap(5.5), 'tagline': snap(6.0), 'cta': snap(6.25, 0.5)}
# notification cards on successive beat subdivisions, tightening toward the breath (1/2 then 1/4 beats)
notes_t = [cues['monday'] + 0.25, cues['monday'] + 0.5, cues['monday'] + 0.75, cues['monday'] + 0.875, cues['breath'] - 0.125]
NOTES = ['follow up: 12 visitors', 'reply: buyer question', 'send: listing post', 'follow up: showing feedback', 'reply: offer question']
CAL = [['open house', 'sat · 1–4 pm', 610, 360, 0.35], ['showing', 'sat · 10:00 am', 60, 1060, 0.6], ['open house', 'sun · 12–3 pm', 640, 1180, 1.0],
       ['showing', 'sun · 11:30 am', 90, 300, 0.2], ['showing', 'sat · 4:30 pm', 520, 1420, 0.45]]
SENT = [[-150, 'sent · jordan'], [-100, 'sent · priya'], [-40, 'sent · marcus'], [20, 'sent · dana & mark'], [75, 'sent · sam'], [130, 'sent · kate'], [200, 'sent · alex'], [250, 'sent · the ellises']]
PROMPT = 'follow up with everyone from saturday'
# ---------------------------------------------------------------- audio
y, _ = librosa.load('../music/track.mp3', sr=SR, mono=False, offset=start, duration=DUR + 0.5); y = y[:, :int(DUR * SR)].T.copy()
t = np.arange(len(y)) / SR
# bass envelope per video frame (drives the aura's breathing)
lo = sosfiltfilt(butter(4, 120, 'lowpass', fs=SR, output='sos'), y.mean(1))
env = np.array([np.sqrt(np.mean(lo[int(f / FPS * SR):int((f + 1) / FPS * SR)] ** 2)) for f in range(int(DUR * FPS))])
env = np.convolve(env, np.ones(5) / 5, 'same'); env = (env - env.min()) / (env.max() - env.min() + 1e-9)
# the breath: duck to ~10% for the beats before the drop only if the song has no real dip there
need_duck = W['breath_db'] > -6
g_db = np.zeros(len(t))
if need_duck:
    b0, b1 = cues['breath'], D
    g_db = np.interp(t, [0, b0 - 0.04, b0 + 0.06, b1 - 0.03, b1, DUR], [0, 0, -20, -20, 0, 0])
y *= (10 ** (g_db / 20))[:, None]
y *= np.clip(t / 0.15, 0, 1)[:, None] ** 2                                  # 0.15 s fade in
tail = np.clip((DUR - t) / 0.08, 0, 1)[:, None]; y *= tail                 # the window ends ON a beat: just an 80 ms release, no mid-note cut
# sound design ~15 dB under the song
rng = np.random.default_rng(16)
def envl(N, a, d): e = np.ones(N); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(N - na) / (d * SR)); return e
def tap():
    N = int(0.05 * SR); nz = sosfilt(butter(2, [1800, 7000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(N)) * envl(N, 0.0005, 0.006)
    thk = np.sin(2 * np.pi * np.cumsum(np.linspace(900, 400, N)) / SR) * envl(N, 0.0008, 0.01) * 0.4; return nz + thk
def shimmer():
    N = int(2.2 * SR); out = np.zeros(N); tt = np.arange(N) / SR
    for f in (1046.5, 1318.5, 1568.0, 2093.0): out += np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(3, 6) * tt))
    air = sosfilt(butter(2, [5000, 12000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(N)) * 0.6
    return (out * 0.25 + air) * np.minimum(1, tt / 0.6) * np.exp(-np.maximum(0, tt - 0.8) / 0.9)
fx = np.zeros(len(y))
n = len(PROMPT); T0, T1 = cues['typeStart'], cues['typeEnd']
for k, ch in enumerate(PROMPT):
    if ch != ' ' and k % 2 == 0:                                            # a soft tap every other letter, never a typewriter rattle
        s = tap() * rng.uniform(0.6, 1.0); i = int((T0 + k / n * (T1 - T0)) * SR); fx[i:i + len(s)] += s[: len(fx) - i]
sh = shimmer(); i = int((cues['mila'] - 0.3) * SR); fx[i:i + len(sh)] += sh[: len(fx) - i]
def rms(x): return np.sqrt(np.mean(x[np.abs(x) > 1e-6] ** 2)) + 1e-12
song_ref = np.sqrt(np.mean(y[int(D * SR):] ** 2))
fx *= song_ref * 10 ** (-15 / 20) / rms(fx)
mix = y + np.stack([fx, fx], 1) * 0.9
sf.write('public/audio/premaster.wav', mix.astype(np.float32), SR, subtype='FLOAT')
def ln(x=''): return f'loudnorm=I=-14:TP=-1.0:LRA=11{x}'
p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', 'public/audio/premaster.wav', '-af', ln(':print_format=json'), '-f', 'null', '-'], capture_output=True, text=True)
m = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', p.stderr, re.S).group(0))
second = ln(f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'public/audio/premaster.wav', '-af', second + f',aresample={SR},alimiter=limit=0.89:level=false:latency=true', '-ar', str(SR), '-c:a', 'pcm_s24le', 'public/audio/mix.wav'], check=True)
out = {'fps': FPS, 'duration': DUR, 'bpm': A['bpm'], 'songStart': start, 'songEnd': start + DUR, 'beats': beats, 'downbeats': down, 'cues': cues, 'ducked': bool(need_duck),
       'notes': [[round(a, 4), s] for a, s in zip(notes_t, NOTES)], 'calendar': CAL, 'sent': SENT, 'prompt': PROMPT, 'bass': [round(float(v), 3) for v in env]}
json.dump(out, open('src/beats.json', 'w'), indent=1)
print(json.dumps({k: v for k, v in out.items() if k not in ('bass', 'beats', 'calendar', 'sent')}, indent=1))

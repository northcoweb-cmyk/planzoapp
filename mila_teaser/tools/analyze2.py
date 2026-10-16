"""Song analysis for the Mila teaser: tempo, beats, downbeats, onset strength, RMS, bass energy, drop candidates."""
import os
SONG = os.environ.get('SONG', '../music/track.mp3'); OUT = os.environ.get('OUT', 'analysis')
import json, numpy as np, librosa
from scipy.signal import butter, sosfiltfilt
SR = 22050; HOP = 256
y, _ = librosa.load(SONG, sr=SR, mono=True)
dur = len(y) / SR
onset = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP); ot = librosa.frames_to_time(np.arange(len(onset)), sr=SR, hop_length=HOP)
tempo, beat_fr = librosa.beat.beat_track(onset_envelope=onset, sr=SR, hop_length=HOP, tightness=120)
beats = librosa.frames_to_time(beat_fr, sr=SR, hop_length=HOP)
# refine to a straight grid: robust fit of beat index vs time
bpm0 = float(np.atleast_1d(tempo)[0]); P = 60 / bpm0
best = None
for bpm in np.arange(bpm0 - 2, bpm0 + 2, 0.01):
    p = 60 / bpm
    for ph in np.arange(0, p, 0.002):
        g = np.arange(ph, dur, p); sc = np.interp(g, ot, onset).mean()
        if best is None or sc > best[0]: best = (sc, bpm, ph)
_, BPM, PH = best; B = 60 / BPM; grid = np.arange(PH, dur - 0.01, B)
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0]
lo = sosfiltfilt(butter(4, 120, 'lowpass', fs=SR, output='sos'), y)
bass = np.sqrt(np.convolve(lo ** 2, np.ones(1024) / 1024, 'same'))[::HOP]
n = min(len(rms), len(bass), len(onset)); rms, bass, onset, ot = rms[:n], bass[:n], onset[:n], ot[:n]
def mean_db(x, a, b): m = (ot >= a) & (ot < b); return 20 * np.log10(x[m].mean() + 1e-9) if m.any() else -120
# downbeats: the bar phase (0-3) whose beats carry the most bass onsets
lflux = np.maximum(0, np.diff(bass, prepend=bass[0]))
phase_score = [np.interp(grid[k::4], ot, lflux).mean() for k in range(4)]; DPH = int(np.argmax(phase_score))
down = grid[DPH::4]
# drop candidates: every beat, energy (rms + bass, in dB) 2 s after minus 2 s before
cands = []
for i, t in enumerate(grid):
    if t < 5 or t > dur - 4: continue
    e_after = 0.5 * mean_db(rms, t, t + 2) + 0.5 * mean_db(bass, t, t + 2)
    e_before = 0.5 * mean_db(rms, t - 2, t) + 0.5 * mean_db(bass, t - 2, t)
    is_down = (i - DPH) % 4 == 0
    dip = mean_db(rms, t - 0.6, t) - mean_db(rms, t - 4, t - 0.6)          # a breath right before (negative = quieter)
    cands.append(dict(t=round(float(t), 3), beat=i, score=round(float(e_after - e_before) + (2.0 if is_down else 0), 2), jump_db=round(float(e_after - e_before), 2),
                      downbeat=bool(is_down), dip_db=round(float(dip), 2), after_db=round(float(e_after), 1)))
cands.sort(key=lambda c: -c['score'])
top = []
for c in cands:
    if all(abs(c['t'] - d['t']) > 8 for d in top): top.append(c)
    if len(top) == 5: break
print(f"duration {dur:.2f}s  BPM {BPM:.2f} (librosa raw {bpm0:.2f})  beat {B:.4f}s  phase {PH:.3f}s  downbeat phase {DPH}")
for c in top: print(c)
json.dump({'bpm': BPM, 'beat': B, 'phase': PH, 'downPhase': DPH, 'grid': [round(float(x), 4) for x in grid], 'top': top}, open(OUT + '/analysis.json', 'w'), indent=1)
# loudness profile for the record
for s in range(0, int(dur), 4): print(f"{s:4d}s rms {mean_db(rms, s, s + 4):6.1f} bass {mean_db(bass, s, s + 4):6.1f}", end='   ' if (s // 4) % 4 != 3 else '\n')

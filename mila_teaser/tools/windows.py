"""Turn the top drop candidates into 7-second windows (drop ~4.6 s in, start on a beat; 7.0 s = 14 beats at 120 BPM so the end
lands on a beat too), check them for vocals cut mid-word and for a breath before the drop, save previews, pick the best."""
import json, subprocess, numpy as np, soundfile as sf, librosa
A = json.load(open('analysis/analysis.json')); B, grid = A['beat'], np.array(A['grid']); DPH = A['downPhase']
voc, sr = sf.read('analysis/vocals.wav'); voc = voc.mean(1) if voc.ndim > 1 else voc
mix, _ = sf.read('analysis/track.wav'); mix = mix.mean(1)
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
def seg(x, a, b): return x[int(a * sr):int(b * sr)]
rows = []
for c in A['top'][:3]:
    drop = c['t']; i = int(np.argmin(np.abs(grid - (drop - 4.6)))); start = float(grid[i]); end = start + 7.0
    vs, ve = db(seg(voc, start - 0.06, start + 0.06)), db(seg(voc, end - 0.06, end + 0.06))
    vref = db(seg(voc, start, end))
    breath = db(seg(mix, drop - 1.0, drop)) - db(seg(mix, drop - 3.0, drop - 1.0))
    payoff = db(seg(mix, drop, drop + 2.0))
    r = dict(drop=drop, start=round(start, 3), end=round(end, 3), drop_in_window=round(drop - start, 3), start_on_downbeat=(i - DPH) % 4 == 0,
             vocal_at_start_db=round(vs, 1), vocal_at_end_db=round(ve, 1), vocal_level_db=round(vref, 1), breath_db=round(breath, 1),
             build_db=round(db(seg(mix, start, drop)), 1), payoff_db=round(payoff, 1), jump_db=c['jump_db'], score=c['score'])
    rows.append(r)
for k, r in enumerate(rows):
    out = f'previews/window{k + 1}_{r["start"]:.2f}-{r["end"]:.2f}s.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(r['start']), '-t', '7', '-i', '../music/track.mp3', '-af', 'afade=t=in:d=0.15,afade=t=out:st=6.85:d=0.15', '-ar', '48000', out], check=True)
    r['preview'] = out; print(json.dumps(r))
json.dump(rows, open('analysis/windows.json', 'w'), indent=1)

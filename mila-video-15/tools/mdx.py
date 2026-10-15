"""MDX-Net stem separation (UVR models) in numpy + onnxruntime. Usage: mdx.py model.onnx n_fft compensate in.wav out.wav"""
import sys, numpy as np, soundfile as sf, onnxruntime as ort, librosa
model, n_fft, comp, src, dst = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), sys.argv[4], sys.argv[5]
SR, HOP, DIM_F, DIM_T = 44100, 1024, 3072, 256
mix, sr = sf.read(src, always_2d=True); mix = mix.T.astype(np.float32)
if sr != SR: mix = librosa.resample(mix, orig_sr=sr, target_sr=SR)
n_bins = n_fft // 2 + 1; chunk = HOP * (DIM_T - 1); trim = n_fft // 2; gen = chunk - 2 * trim
win = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n_fft) / n_fft)).astype(np.float32)        # periodic hann (torch default)
def stft(x):                                  # x: [C, chunk] -> [C, n_bins, DIM_T] complex, torch center=True reflect pad
    xp = np.pad(x, ((0, 0), (n_fft // 2, n_fft // 2)), mode='reflect')
    fr = np.stack([xp[:, i * HOP:i * HOP + n_fft] * win for i in range(DIM_T)], -1)       # [C, n_fft, T]
    return np.fft.rfft(fr, axis=1)
def istft(S):                                 # [C, n_bins, T] -> [C, chunk]
    fr = np.fft.irfft(S, n=n_fft, axis=1) * win[None, :, None]
    L = n_fft + HOP * (DIM_T - 1); out = np.zeros((S.shape[0], L), np.float32); wsum = np.zeros(L, np.float32)
    for i in range(DIM_T): out[:, i * HOP:i * HOP + n_fft] += fr[:, :, i]; wsum[i * HOP:i * HOP + n_fft] += win ** 2
    out /= np.maximum(wsum, 1e-8); return out[:, n_fft // 2:n_fft // 2 + chunk]
sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
def run(m):
    n = m.shape[1]; pad = gen - n % gen
    mp = np.concatenate([np.zeros((2, trim), np.float32), m, np.zeros((2, pad), np.float32), np.zeros((2, trim), np.float32)], 1)
    outs = []
    for i in range(0, n + pad, gen):
        S = stft(mp[:, i:i + chunk])[:, :DIM_F]                                             # [2, F, T]
        X = np.stack([S[0].real, S[0].imag, S[1].real, S[1].imag])[None].astype(np.float32)
        Y = sess.run(None, {'input': X})[0][0]
        Sc = np.zeros((2, n_bins, DIM_T), np.complex64); Sc[0, :DIM_F] = Y[0] + 1j * Y[1]; Sc[1, :DIM_F] = Y[2] + 1j * Y[3]
        outs.append(istft(Sc)[:, trim:-trim])
    return np.concatenate(outs, 1)[:, :n]
stem = (run(mix) - run(-mix)) * 0.5 * comp     # UVR "denoise": average with the sign-flipped pass
sf.write(dst, stem.T, SR, subtype='FLOAT'); print('wrote', dst, stem.shape)

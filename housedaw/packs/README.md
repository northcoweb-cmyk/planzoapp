# Optional sound packs

HouseDAW ships with **no audio files** — every sound is generated on your device. If you later get properly licensed
samples, put them in this folder and describe them in `manifest.json`:

```json
{
  "name": "My Licensed Pack",
  "sounds": [
    { "file": "kicks/thump.wav", "name": "Thump", "cat": "DRUMS", "sub": "Kick" },
    { "file": "vox/ahh.wav",     "name": "Ahh",   "cat": "VOCALS", "sub": "Chop" }
  ]
}
```

`cat` is one of DRUMS, VOCALS, FX, MY SOUNDS. Packs are decoded at startup and appear in the browser like any other sound
(preview, waveform, drag-and-drop, favorites). No code changes are needed. Do not add copyrighted material you don't have
the rights to use.

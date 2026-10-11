# Mila film #9: "Patch"

18.46 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), -14 LUFS AAC 320k.

**Output:** `out/mila_film9_1080x1350_60fps.mp4`

```bash
python3 timeline.py && python3 build_audio.py path/to/Patch.mp3
node render.cjs --format feed
```

## Music: "Patch" (0:22.17 to 0:40.63)
- **Tempo:** 130.0 BPM, one beat = 0.4615 s. The grid fits all three full-energy sections of the track the same way.
- **Drop:** the song's drop (first bass hit at 0:29.55) lands on video beat 16, "100% · Installed".
- **The build:** the build is low-passed and sits 4 dB lower, then opens up over b11–15, so the drop arrives full-range and about 5 dB louder.
- **The reverb emphasis, "stuck at 99%":** on b15 the dry song cuts out completely. The last beat of the build is thrown into a 4.5 s hall, so one beat of pure reverb wash hangs over the frozen 99% screen. It ducks under the drop on b16.
- **Sound effects:** glitch bursts, error buzzes, typing ticks, data blips, node plucks, card thunks and C-minor chimes, all with a room send. The end reverb tail is wrapped to the start, so the loop is seamless.

## Cut list (b × 0.4615 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "Your workflow needs a patch." `agent_os · v1.0 · not responding`, CPU 100%, warnings stacking (47 unread, 3 showings overlap, 14 follow-ups overdue…) with glitches |
| 4 | 1.85 | **Update available: Mila · Patch 2.0.** Patch notes type in, one per beat (b5–11) |
| 12 | 5.54 | **Install** is tapped. 0→99% races with the hi-hats, the install log streams, the screen shakes and glitches |
| 15 | 6.92 | **Stuck at 99%:** freeze, desaturate, slow push in. The dry song cuts out and the reverb wash rings |
| **16** | **7.38** | **DROP: 100% · Installed.** The Mila core powers up and Calendar, Email, CRM, MLS, Social and Texts wire in. Data pulses run on every beat |
| 18–28 | 8.3–12.9 | Results land every 2 beats, and the source node lights up: lead reply drafted, showing booked, listing copy, carousel, buyer email, 9 follow-ups |
| 30 | 13.85 | "6 drafts ready for you, Rachel · Approve all" is tapped and every card flips to **Approved ✓** |
| 32 | 14.77 | **Workflow: patched.** |
| 35 | 16.15 | **Mila** end card, the tagline, then *Comment "Mila" for a 7-day free trial.* |
| 39–40 | 18.0–18.46 | Loop tail back to the frame-0 hook |

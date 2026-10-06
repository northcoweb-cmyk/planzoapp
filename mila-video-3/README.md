# Mila film #3: "CONTRACT TO KEYS" (Texas)

21.2 s, 1080×1080, 60 fps. One Texas deal from lead to keys: Marcus Hale buys **4812 Bluebonnet Ln, Austin, TX 78704** for $645,000.

The style is bold Americana film: Anton slams, ink stamps, split-flap counters, a slot-machine match reel, film burns, halation, heat shimmer and low-sun flares.

It uses the same build system as films #1 and #2: every frame is a pure function of time, captured at 120 fps and averaged to 60 fps for a 180° shutter.

```bash
python3 timeline.py
python3 build_audio.py path/to/song.mp3     # -> audio/mix.wav (-14 LUFS, <= -1 dBTP, 48 kHz)
node render.cjs --format square             # -> out/mila_film3_1080x1080_60fps.mp4
```

## Song analysis: "SOPHIE – VYZEE (Melodic Part Extended Edit)"
- **136.03 BPM**: beat 0.44109 s. The grid is fitted to 410 beats with a mean error of 10 ms. The key is G minor, so the chimes sit on G / D.
- **Sections:** intro 0–14 s, groove 14–28 s, breakdown 28–56 s, drop 1 at 56.59 s, breakdown 112–141 s (with silence breaks at 113.5 and 117.0 s), **drop 2 at 2:21.277**.
- Drop 2 has the biggest bass jump in the track, and the bass cuts out for exactly one beat (grid beat 319) right before it.
- **Window:** 2:10.691 → 2:31.863, grid beats 296 → 344, 48 beats. It's cut on downbeats, with no stretching or pitch change.
- **Silence beat = video beat 23 (10.145 s):** black plus a film burn.
- **Drop = beat 24 = 10.586 s:** UNDER CONTRACT.
- **Logo = final downbeat, beat 40 = 17.643 s.** The fade over the last bar reaches silence on beat 48.
- **Checked on the cut:** bass energy is 22 on beat 23 against about 350 around it. The grid lines up within 6 ms.

## Cut list (b × 0.44109 s)
| Beat | Time | Shot | Transition |
|---|---|---|---|
| 0 | 0.000 | Built Texas highway at sunrise through the windshield. The phone buzzes in the dash mount with a "New lead: Marcus Hale" notification. AUSTIN 12 sign | kick + cut from black |
| 2 | 0.882 | **NEW LEAD** stamp (Texas silhouette in the stamp) | stamp slam + shake |
| 4 | 1.764 | Voice note → Marcus Hale contact card. **$650K / 3 BED / AUSTIN** slam on 4 / 4.5 / 5 over the Austin exterior | zoom through the phone |
| 6 | 2.647 | **Slot reel** of 9 homes locks on 4812 Bluebonnet Ln on beat 7. **98% MATCH**. Split-flap pipeline ticks to $312,000, then $649,000 | vertical roll |
| 8 | 3.529 | **THU / 4:30 PM** over the interior | whip pan |
| 9 / 10 / 11 | 3.970 / 4.411 / 4.852 | Wide photo event card → showing sheet sign-ins → "Text details to Marcus" sends | whip in, then quick cuts |
| 12 | 5.293 | **SHOWING** stamp | stamp + film burn |
| 14–22 | 6.175–9.704 | The build, one hit per beat with the photos whipping on every beat: follow-up typed (**FOLLOW UP.**) · price-improvement post (**PRICE DROP.**) · "What am I forgetting?" ✓✓✓ (**NOTHING MISSED.**) · offer $640K sent (**OFFER IN.**) → counter $645K accepted (**ACCEPTED.**) | zoom-throughs, whips, speed-ramped pushes, heat shimmer |
| 23 | 10.145 | Song's silence beat: black + film burn | zoom through to black |
| **24** | **10.586** | **DROP: UNDER CONTRACT** stamp, then the transaction checklist cascades (inspection 25, appraisal 25.5, financing 26, title 26.5). Split-flap closing countdown 30 → 21 → 14 → 07 → 00 on 24 / 26 / 27 / 28 / 29. Golden low sun | smash + flash + shake |
| 30 | 13.233 | Closing day: the key tag drops onto the counter. "Just sold" post in Ready for approval | zoom through the phone |
| 31.5 | 13.894 | Approve tap: check + chime | tap |
| 32 | 14.115 | Giant **SOLD** stamp, flash, film-dust confetti | stamp + flash |
| 36 / 37 | 15.879 / 16.320 | **CONTRACT / TO KEYS.** on clay red | smash cut |
| 38 | 16.761 | Film burn to white | burn |
| **40** | **17.643** | Pastel gradient, Mila wordmark rises with a glow. Tagline on 41, Comment "Mila" / for a 7-day free trial on 42 / 42.5 | glow |
| 45.75–48 | 20.18–21.17 | Frozen hold of 1 s or more, then silence | hold |

## Notes
- **Everything is fictional:** names, prices and addresses. The second match and the price-improvement post are 9031 Hill Country Rd, Dripping Springs, TX.
- **No URL, vendor names, API names or error states.**
- The **highway, dashboard and key tag** are built objects, because no photos of them were supplied.
- **Photos:** the sources are 735 / 734 / 1103 px wide, upscaled with Lanczos plus light denoise. The film grain and halation hide the softness.
- **Brand gradient** appears only as the glow behind the phone and on the end card.

# Mila launch film

The 20-second launch video for Mila, "your AI operations manager for real estate". It's built as code: every frame is a pure function of time, cut to the song's beat grid.

| Deliverable | File (after rendering) |
|---|---|
| 1:1 master, 1080×1080, 60 fps | `out/mila_launch_1080x1080_60fps.mp4` |
| 9:16 reframe, 1080×1920, 60 fps | `out/mila_launch_1080x1920_60fps.mp4` |
| 16:9 reframe, 1920×1080, 60 fps | `out/mila_launch_1920x1080_60fps.mp4` |

Masters are H.264 High at CRF 12 (≈36 Mbps), yuv420p, BT.709, with AAC 320 kbps / 48 kHz audio at −14 LUFS integrated and below −1 dBTP true peak. They aren't committed because of their size, and `audio/*.wav` isn't committed because it contains the song. Rebuild both with the steps below.

## Build / export

```bash
pip install librosa soundfile scipy        # audio analysis + mix
npm i playwright                           # or use a global install

python3 timeline.py                        # beat grid + cue sheet -> timeline.json
python3 build_audio.py path/to/Desire.mp3  # -> audio/mix.wav (-14 LUFS, -1 dBTP, 48 kHz)
node render.cjs --format square            # ~7 min on 4 cores
node render.cjs --format portrait
node render.cjs --format landscape
node render.cjs --format square --stills 3.6,8.9   # review PNGs at given seconds
```

**Preview:** run `python3 -m http.server` in this folder and open `http://localhost:8000/?format=square` (or `portrait` / `landscape`). It plays with audio and has a scrubber.

**How the render works:** each format is captured at 120 fps by 4 headless Chromium workers into lossless segments. Each pair of frames is then averaged down to 60 fps, which gives a true 180° shutter, so whips and swipes get real motion blur. Fast moves also get a directional blur scaled to their velocity.

## Song analysis: "Desire"

- **BPM:** 136.03 (beat 0.44106 s, bar 1.7642 s). The grid is a least-squares fit to 351 detected beats, with a mean error of 14 ms.
- **Key:** G minor. All UI chimes and the logo bass swell are tuned to G / B♭ / D.
- **Sections:** intro build 0–4.4 s, drop 1 at 39.28 s, breakdown 112–116 s, build 116.02 s, **drop 2 at 123.08 s** (strongest build and drop), outro ~156 s.
- **Window used:** 1:59.550 → 2:19.839 (grid beats 271 → 317, 46 beats = 20.289 s). That's 2 bars of build, the drop on video beat 8, and 9.5 bars of drop. The song is not sped up or pitch-shifted. It has a 0.3 s fade-in, and the fade-out over the last 2 beats reaches silence exactly on beat 46.
- Checked on the cut file: bass energy jumps from 3.5 to 456 exactly at video beat 8, and the whole grid lines up within one frame.

## Cut list

Video beat *b* → seconds = *b* × 0.44106. Frame numbers are at 60 fps.

| Beat | Time | Frame | Song | What happens | Transition | Assets |
|---|---|---|---|---|---|---|
| 0 | 0.000 | 0 | 1:59.550 | Pure white. The phone slides up with a 3D tilt and soft shadow | spring | Home screen |
| 2 | 0.882 | 53 | 2:00.433 | Chat box glows and typing starts (64 key sounds) | glow + shine | — |
| 7 | 3.087 | 185 | 2:02.638 | **Send** tap. The text lifts away and the phone "inhales" | press | — |
| **8** | **3.529** | **212** | **2:03.079 DROP** | **Signature expansion:** the screen blows out into a 7×7 grid of Malibu photos with a white bloom and rack focus | outExpo burst | all 4 photos |
| 9 | 3.970 | 238 | | Center tile grows and turns into the Malibu map | crossfade | map |
| 10 | 4.411 | 265 | | Pin lands on 26110 PCH with a ripple and address label | drop + bounce | — |
| 10.5 | 4.631 | 278 | | Map snaps to the hero photo with a focus pull | focus snap | hero |
| 12 | 5.293 | 318 | 2:04.843 | Hero photo flies into the app as the brief card photo. **"Ready to list."** | shared element | hero |
| 12.5–14 | | | | Brief rows build in one per half-beat with checks; the progress ring fills | masked wipes | — |
| 15 | 6.616 | 397 | | Ring completes, chime, glass shine sweep | — | — |
| **16** | 7.057 | 423 | 2:06.608 | Brief photo becomes carousel slide 1. Slides fan out. **"Posts."** | whip + shared element | hero, pool, firepit |
| 17 / 18 / 19 | 7.498 / 7.939 / 8.380 | 450 / 476 / 503 | | Fan straightens into a carousel, then swipes left to slide 2 and slide 3 | swipe + motion blur | — |
| **20** | 8.821 | 529 | 2:08.372 | CTA slide shrinks into the email banner. **"Emails."** Email types at speed and the signature lands | whip + shared element | firepit |
| **23** | 10.144 | 609 | 2:09.695 | Text follow-ups: 3 bubbles pop on 23 / 23.75 / 24.5, then "Queued" on 25. **"Follow-ups."** | whip | hillside |
| **26** | 11.468 | 688 | 2:11.018 | Approval stack. "Mila asks before anything goes out." | whip | hero |
| 26.5 / 27 / 27.5 / 28 | 11.688 / 11.909 / 12.129 / 12.350 | 701 / 715 / 728 / 741 | | Four approve taps, each with a check draw and chime. Cards sweep away | tap + sweep | — |
| 28 | 12.350 | 741 | | **"Approved."** Sparkle burst, light leak, "All caught up" | bloom | — |
| **30** | 13.232 | 794 | 2:12.782 | Calendar: the open house drops onto Sunday. Showings fill in on 31–32.5 and counters tick up. **"Open house. Done."** | whip + drop | hero, pool, firepit, hillside |
| **33** | 14.555 | 873 | 2:14.106 | Pipeline cards slide past. **"Who's next?"** | whip | — |
| 35 | 15.437 | 926 | | "Who should I follow up with?" answer card | spring | — |
| **36** | 15.878 | 953 | 2:15.429 | Meeting prep, then "What am I forgetting today?" on 38. **"Nothing forgotten."** | whip | pool, hillside |
| 39.3–40 | | | | Everything dissolves to white | white dissolve | — |
| **40** | **17.643** | **1059** | 2:17.193 | **Final downbeat:** pastel gradient, Mila wordmark scales in with a bloom, G bass swell and boom | scale + glow | wordmark |
| 41 | 18.084 | 1085 | | Tagline masked reveal | line wipe | — |
| 42 / 42.5 | 18.525 / 18.745 | 1111 / 1125 | | Comment "Mila" / for a 7-day free trial | line wipe + glow | — |
| 43.75–46 | 19.297–20.289 | 1158–1217 | 2:19.839 | Frozen hold of 1 s or more. The music lands at silence on beat 46 | hold | — |

## Things to know or swap

- **Agent name in the email signature** is the placeholder "Sarah Bennett, Coastline Realty Group". Change it in `index.html` (`#sig`).
- **Wordmark:** only a screenshot of the brand sheet was supplied. Following its own rule ("Mila is typeset, never drawn… Instrument Serif Regular, tracking −2%"), the wordmark is set live in Instrument Serif at −2%. To use the official files instead, drop the SVG into `#wordmark`.
- **App UI:** no app screenshots or recordings were supplied, so every screen is rebuilt from the written spec.
- **Photos:** the source photos are about 735 px wide. They are upscaled 2× with Lanczos and light sharpening, then given one shared coastal golden-hour grade (`assets/photos/`). Full-bleed use is limited to the expansion grid. Photos at 2000 px or larger would make that moment sharper.
- **No URL** appears anywhere in the film, along with no vendor names and no error states. All names, prices and phone numbers are fictional (310-555-01xx).

## Caption

**Instagram:**
> Tell Mila what you need. It drafts the posts, emails, follow-ups and calendar, and asks before anything goes out. Comment "Mila" for a 7-day free trial.
>
> #realestate #realtor #realestateagent #proptech #AI #malibu #openhouse #realtorlife #realestatemarketing #newlisting

**X:**
> Meet Mila, your AI operations manager for real estate. One sentence in, a whole open house out. Comment "Mila" for a 7-day free trial. #realestate #AI #proptech

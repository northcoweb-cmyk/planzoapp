# Mila film #8: "Speedrun" (retro 8-bit)

18.75 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), -14 LUFS AAC 320k.

**Output:** `out/mila_film8_1080x1350_60fps.mp4`

**How it's drawn:** everything is drawn on a 270 px wide pixel canvas, scaled 4× with nearest-neighbour, and captured at 60 fps with no motion-blur blend so every pixel stays crisp. A CRT pass adds bloom, scanlines, an RGB mask and a vignette.

**Fonts:** Press Start 2P and Silkscreen, both under the SIL Open Font License (licence files in `assets/fonts/`).

```bash
python3 timeline.py && python3 build_audio.py path/to/How_Deep_Is_Your_Love.mp3
node render.cjs --format feed          # also square / portrait; --hook "..." replaces the title's subline
```

## Music: "How Deep Is Your Love (UK House)" (0:26.44 to 0:45.19)
- **Tempo:** 128 BPM, one beat = 0.46875 s. Measured drop-to-drop at 128.0 BPM.
- **Grid anchor:** the grid is anchored on the drop's first kick (0:32.065). The UK-house bass sits on the off-beats, so the kick is the reliable downbeat.
- **Drop:** the drop is **GO!** on video beat 12 (5.625 s).
- **Countdown:** the song's 4-beat bass dropout before the drop is the READY / 3 / 2 / 1 countdown.
- **Sound effects:** synthesized 8-bit chip voices (pulse, triangle and noise) tuned to the song. Coins, connector checks, countdown beeps, GO, split chimes, the record fanfare and approve all go through a room reverb. The end reverb tail is wrapped to the start for the loop.

## Timer
The on-screen timer runs in **real time**, from GO to the final split: 18 beats = **0:08.43**.

| Split | Time |
|---|---|
| LISTING COPY | 0:01.40 |
| PHOTOS | 0:02.81 |
| IG CAROUSEL | 0:04.21 |
| BUYER EMAIL | 0:05.62 |
| OPEN HOUSE | 0:07.03 |
| FOLLOW-UPS | 0:08.43 |

The run is labelled "ANY% · ALL CONNECTORS LINKED · REAL TIME". The loadout screen links all connectors before the run: Calendar, Email, CRM, MLS, Social, Texts.

## Cut list (b × 0.46875 s)
| b | Time | Screen |
|---|---|---|
| 0 | 0.00 | Title: **SPEEDRUN / NEW LISTING >> OPEN HOUSE**, level card 1-1 (48 Coral Palm Way, Naples, FL), PRESS START |
| 4 | 1.88 | Loadout: PLAYER 1 **RACHEL** (pixel sprite). Connectors check in on half-beats, then **ALL LINKED!** |
| 8–11 | 3.75 | **READY? / 3 / 2 / 1** with warp-speed stars |
| **12** | **5.63** | **GO!** on the drop. Timer, splits and level panels start, and Rachel runs the 6-checkpoint track |
| 15–30 | 7.0–14.1 | Splits, one every 3 beats: listing copy types itself, photos de-pixelate, the IG carousel fans in, the email goes to 31 buyers, the open house is stamped on Sunday, follow-ups are queued |
| **30** | **14.06** | **NEW RECORD! 0:08.43** at the goal flag. **APPROVE ALL** on b32, then 6/6 approved |
| 33.5 | 15.7 | **TOP RUNS:** 1. RACHEL + MILA 0:08.43 · 2. 12 APPS + COFFEE DNF · 3. ALL BY HAND DNF |
| 36 | 16.9 | **MILA**, the tagline, then **COMMENT "MILA" FOR A 7-DAY FREE TRIAL** |
| 39.1–40 | 18.3 | Ordered-dither dissolve back to the exact frame-0 title, so the loop is seamless |

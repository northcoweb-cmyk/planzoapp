# Mila film #13: "Viral"

20.6 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), −14 LUFS AAC 320k.

**Output:** `out/mila_film13_1080x1350_60fps.mp4`

```bash
python3 timeline.py && python3 build_audio.py path/to/can_you_just_relax.mp3
node render.cjs --format feed
```

**Concept:** one listing post goes viral. The camera pulls back from Rachel's phone, and the post lights up the phones around it. On the drop it zooms out exponentially until the phone is one screen in a tilted city of screens, all lighting up on the beat. Then it whips back into the same phone: 214 DMs. Mila sorts them, drafts every reply, Rachel approves, and 6 showings get booked.

## Music: "Can You Just Relax" (2:07.51 to 2:28.14)
- **Tempo:** 128.0 BPM, one beat = 0.46875 s, phase 0.012 s. An onset-strength grid search over the whole song and over both drops independently all give 128.00. Drop transients land within 10 ms of the grid.
- **Structure:** video beat 0 is song beat 272, where the breakdown starts. The whole breakdown is the build, and the main drop (song beat 288, 2:15.01) lands on **video beat 16**.
- **Reverb hang:** at b14.5 ("And then…") the dry song cuts out. The beat before it hangs in a 4.5 s hall until the song's own pickup at b15.5, and a reversed-reverb swell sucks into the drop.
- **Swell into the snap:** a second reversed-reverb swell leads into the snap back to the phone at b20.
- **Sound design (in E♭ major pentatonic):**
  - a notification on every build beat, plus carousel swipes
  - pings that get denser as more phones light up
  - on the drop, a 70-ping swarm on each beat in a wide room: the city of phones going off
  - ticks as the DMs arrive, the approve chime, and pops on the showings
- **Loop:** the end reverb tail wraps onto the start. The limiter's latency is compensated, so the audio loop is sample-aligned.

## Cut list (b × 0.46875 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "You post one listing." Rachel's phone shows the @coastline.realty post: *Just listed.* 2884 Cliffside Dr, Malibu, $50,000,000 · 9 bd · 15 ba |
| 2–8 | 0.9–3.8 | Notifications drop in, one per beat (liked, shared, saved, "Is this still available?"). The carousel swipes through all 5 photos, then rewinds. Likes climb from 12 to 1,204 |
| 8–14 | 3.8–6.6 | "Then their friends do." / "And theirs." The camera pulls back, and the phones around it light up with the post. A REACH counter appears |
| 14.5–16 | 6.8–7.5 | "And then…", then the reverb hang |
| **16** | **7.50** | **DROP:** exponential zoom-out (×16) with a 36° tilt. The phone becomes one screen in a city of screens that light up in bursts on each beat. **Shared. Saved. Sent. Everywhere.** REACH climbs to 48,210 |
| 19.55–20 | 9.2–9.4 | Whip zoom back into the same phone |
| 20 | 9.38 | **214 DMs.** The inbox floods |
| 21–24 | 9.8–11.3 | Mila's sheet: **Sorted 214 DMs** (bars), then **214 replies drafted** (typed reply), then **Approve all**, then **All approved ✓** |
| 24–27 | 11.3–12.7 | Showings confirmed, one per half beat |
| 27 | 12.66 | **6 showings booked.** From one post |
| 28–32 | 13.1–15.0 | Full-bleed photos: **Posted. Shared. Answered. Booked.** |
| 32–33 | 15.0–15.5 | **One post.** / Mila handles *the rest.* |
| 34 | 15.94 | **Mila** end card over the dim city of screens, then the tagline and *Comment "Mila" for a 7-day free trial.* |
| 42–44 | 19.7–20.6 | Loop tail back to the exact frame-0 hook |

## Notes
- **Photos:** the 5 listing photos were upscaled ×2 or ×4 with EDSR (OpenCV dnn_superres), then lightly sharpened.
- **Fictional data:** the address (2884 Cliffside Dr, Malibu), price, handles, names and counts are all fictional.
- **What Mila is shown doing:** Mila drafts and Rachel approves.
- **City technique:** the city is drawn on a canvas with a real perspective projection (mipmapped phone sprites). Each screen lights at a seeded time: rings during the build, beat-quantized bursts on the drop.

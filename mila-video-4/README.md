# Mila film #4: "Chaos to Calm" (Maryland)

21.3 s, 60 fps, in three sizes: 1080×1080, 1080×1350 (4:5 feed) and 1080×1920.

A Maryland agent's day is chaos. One plain sentence to Mila, and **the SNAP**: every messy notification flies back in and magnetically snaps into its tidy "Ready for approval" card, one per beat. It uses the white glass look of film #1, built the same way: every frame is a pure function of time, captured at 120 fps and averaged to 60 fps.

```bash
python3 timeline.py
python3 build_audio.py path/to/LMB.mp3            # -> audio/mix.wav (-14 LUFS, <= -1 dBTP, 48 kHz)
node render.cjs --format square                   # also: --format feed (1080x1350), --format portrait (1080x1920)
node render.cjs --format square --hook "41 unread. 3 showings." --tag ugc1   # alternate hook text
node render.cjs --format square --stills 6.95     # cover frame
```

## Song analysis: "LMB"
- **135.00 BPM**: beat 0.44444 s. The grid is fitted on the drum sections with an error of 4 ms. Downbeats fall on grid beats ≡ 3 (mod 4). The key is E minor, so the chimes sit on E / G / B.
- **Sections:** sparse intro 0–6.5 s, groove 6.5–14 s, melodic section with no bass 14–21 s, **build from 21.13 s** (bass and hi-hats come in), one-beat bass drop-out at 27.80 s, **drop 1 at 28.240 s**.
- Drop 2 at 1:39.35 comes after a 7-second near-silence. Drop 1's build matches the storyboard, so that's the one used.
- **Window:** 0:15.795 → 0:37.128, grid beats 35 → 83, 48 beats. No speed or pitch change.
- **Half a beat of silence** on the white (beat 4–5) is a −25 dB volume dip on the song.
- **SNAP = beat 12 = 5.333 s** (song 21.129, where the build kicks in).
- **Freeze = beat 27 = 12.0 s**, on the bass drop-out.
- **DROP = beat 28 = 12.444 s**, the approval cascade.
- **Logo = beat 40 = 17.778 s**, the final downbeat.
- The music fades over the last bar into the loop.

## Cut list (b × 0.44444 s)
| Beat | Time | Shot | Transition |
|---|---|---|---|
| 0–4 | 0.00–1.78 | **Hook:** a phone buried in a pile of notifications, with 12 pieces orbiting in 3D (missed calls, a sticky note, clashing showings, texts, 41 unread). The shake builds. **"Sound familiar?"** | hard cut in |
| 4–5 | 1.78–2.22 | Everything freezes, blurs and fades to white. Half a beat of silence | freeze |
| 5–6 | 2.22–2.67 | Calm glass chat box, blinking cursor | rise |
| 6–11.2 | 2.67–4.98 | Typing in four short lines: *Set me up for Sunday's open house / at 27 Fernwood Hollow Ct, Germantown, / and follow up with everyone / from last week.* | — |
| 11.5 | 5.11 | Send. The box lifts into the message bubble, and "Ready for approval" appears | lift |
| **12 / 13 / 14 / 15 / 15.5** | **5.33 / 5.78 / 6.22 / 6.67 / 6.89** | **THE SNAP:** missed call → **follow-up draft** · sticky note → **open house checklist** · clashing alerts → **calendar, cleaned up** · texts → **3 text follow-ups** · "41 unread" → **open house email**. Each one lands with a magnetic thunk, a squash and a glow ring, and the counter rises 1 → 5 | magnetic morph |
| 16 | 7.11 | Push through the first card into the phone: **listing brief** builds (✓ 16.5 / 17 / 17.5). **"Brief. Built."** | zoom through |
| 18 | 8.00 | Carousel fans out of the phone: address slide, stats slide on the pool, CTA slide. **"Posts."** | push |
| 20 | 8.89 | Email types itself. **"Emails."** | push |
| 22 | 9.78 | Text follow-ups to last week's visitors (22.5 / 23 / 23.5), then Queued. **"Follow-ups."** | push |
| 24 | 10.67 | Wide photo event card drops (24.5), then expands into Directions / Follow-up / Property / Send details (25.5–26.4). **"Open house. Booked."** | push + expand |
| 27 | 12.00 | Freeze on the bass drop-out | freeze |
| **28–32** | **12.44–14.22** | **DROP: approval cascade.** One tap per beat, each with a check, a bloom and a sweep. The counter falls 5 → 0 | rhythmic sweeps |
| 32 / 33 | 14.22 / 14.67 | **"Typed once. / Done."** | line reveal |
| 34 / 35 / 36 / 37 | 15.11 / 15.56 / 16.00 / 16.44 | Whip-pans: log cabin, pool, stone farmhouse, then the hero farmhouse, each with a glass address card | whip + motion blur |
| 38–40 | 16.89–17.78 | Back to white | dissolve |
| **40** | **17.78** | Mila wordmark rises with a glow. Tagline on 41, Comment "Mila" / for a 7-day free trial on 42 / 42.5 | glow |
| 43.75–46 | 19.44–20.44 | Frozen hold of 1 s or more | hold |
| 46–48 | 20.44–21.33 | Fades to the **empty chat box with a blinking cursor**, so it loops into the typing moment | loop |

## Photos and addresses (all fictional)
| Photo | Use | Address |
|---|---|---|
| Dark farmhouse at dusk | Hero: brief, carousel, event card, last whip | 27 Fernwood Hollow Ct, Germantown, MD 20874 |
| Log cabin | Whip | 88 Laurel Fern Way, Frederick, MD 21702 |
| Pool | Carousel stats slide, whip | 41 Quail Hollow Bend, Bethesda, MD 20817 |
| Stone farmhouse | Whip | 12 Millstone Bend Ln, Poolesville, MD 20837 |

Retouching: the real house number on the hero's porch column was painted out. The pool photo is cropped so the children aren't in the frame. The stone farmhouse is cropped to remove the yard sculpture.

## Hook texts for UGC-style tests
Swap in with `--hook "..."`. The polished cut uses "Sound familiar?".
1. 41 unread. 3 showings.
2. POV: you're a Maryland agent on a Friday.
3. There has to be a better way.

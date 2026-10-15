# Mila film #14: "The Match"

24.4 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), −14 LUFS AAC 320k.

**Output:** `out/mila_film14_1080x1350_60fps.mp4`

```bash
python3 timeline.py && python3 build_audio.py path/to/Real_Love.mp3
node render.cjs --format feed
```

**Concept:** Rachel's new client Maya wants Manhattan for $5–6K/mo with a list of must-haves. Rachel hands the brief to Mila, which searches a live map of Manhattan and narrows 4,812 listings down to 3 on the beat. On the drop the three matches slam in. Maya picks the 3rd. Its thumbnail opens into the apartment, more photos pop in, every must-have gets checked off, and the tour is booked.

## Music: "Real Love" (1:29.11 to 1:53.48)
- **Tempo:** 128.0 BPM, one beat = 0.46875 s, phase 0.045 s. The intro kicks fit 128.00 BPM with a 0.1 ms residual.
- **Drop:** the main drop is song beat 206 (1:36.61), exactly 128 beats after the first drop. It lands on **video beat 16**.
- **The build** (song beats 190–205.5) sits 1 dB down, and a high-pass sweeps 30 → 380 Hz over b8–15.5, so the drop's low end lands fresh.
- **Reverb hang:** on b15.5, under "Found 3.", the dry song cuts and the beat before it hangs in a 4.5 s hall. A reversed-reverb swell leads into the drop, and a second one into the photo opening into the apartment.
- **Sound effects (F major pentatonic):**
  - pops for the must-haves and keys for the typing
  - pings as the map pins land, and hits on each funnel stage
  - the send whoosh, Maya's reply, the tap on the 3rd photo
  - checks for each must-have, and a stamp on "tour booked"
- **Loop:** the end reverb tail wraps onto the start, and the limiter's latency is compensated.

## Cut list (b × 0.46875 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "New client." Maya Chen, moving to Manhattan, budget **$5,000–$6,000/mo**. The must-haves pop in on half-beats: 1–2 bed, natural light, doorman, in-unit laundry, near the subway, dog-friendly |
| 5 | 2.34 | "Hand it to Mila." The request is typed into Mila, then sent |
| 8–14 | 3.75–6.56 | **Mila searches Manhattan.** A map of the island (street grid, neighborhoods) fills with pins. Scan beams narrow 4,812 listings → 612 in budget → 38 with every must-have → 3 best fits, which glow with their match % and price |
| 14–16 | 6.56–7.50 | **"Found 3."** The map leans downtown, then the reverb hang |
| **16–18** | **7.50** | **DROP:** match 1 Chelsea $5,450 (92%), match 2 West Village $5,800 (94%), match 3 Financial District $5,950 (98%). One per beat, full-bleed |
| 19 | 8.91 | Shortlist ready (3 cards) |
| 20–22.5 | 9.38–10.55 | The shortlist goes to Maya: "Drafted by Mila · sent". Typing dots, then **"The 3rd one!! ♥"**. The 3rd thumbnail is tapped |
| 22.75–23.25 | 10.7–10.9 | The thumbnail opens up into the apartment, full screen |
| 24–25 | 11.25–11.7 | The living room and kitchen photos pop in |
| 26–30 | 12.2–14.1 | The photos settle into a grid. Maya's pick: Nassau St, #18A. All 6 must-haves are checked off one by one. **TOUR BOOKED**, Saturday 11:00 AM |
| 32–36 | 15.0–16.9 | Full-bleed kicker words: **Budget. Wishlist. Matched. Toured.** |
| 36–38 | 16.9–17.8 | "Your client's wishlist. / Mila finds *the match.*" |
| 38 | 17.81 | Mila end card, tagline, then *Comment "Mila" for a 7-day free trial.* |
| 50–52 | 23.4–24.4 | Loop tail back to the frame-0 hook |

## Notes
- **Photos:** the 5 apartment photos were upscaled ×4 with EDSR (OpenCV dnn_superres), then lightly sharpened. The last three are the same apartment (Nassau St #18A).
- **Fictional data:** the client, units and match %s are fictional. Addresses use street names only, with no building numbers.
- **What Mila is shown doing:** Mila drafts and the agent sends.

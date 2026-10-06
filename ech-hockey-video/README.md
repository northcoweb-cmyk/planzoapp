# East Coast Hockey & Skating Supply: "New gear just dropped"

20.6 s, 60 fps Instagram video in three sizes: **1080×1350** (feed, the main version), 1080×1920 (Reels/Stories) and 1080×1080.

It features the new CCM sticks and the new Bauer and CCM skates. It's built the same way as the Mila films: every frame is a pure function of time, captured at 120 fps and averaged to 60 fps for a real motion-blur shutter.

The **music is original**, composed in `compose.py` for this edit. No licensed audio is used, so it won't get muted or flagged.

```bash
python3 timeline.py && python3 compose.py         # -> audio/mix.wav (-14 LUFS, <= -1 dBTP, 48 kHz)
node render.cjs --format feed                     # also --format portrait / --format square
python3 -I cutout.py SRC.jpg assets/img/NAME.png SCALE [white-tolerance] [edge-erode]   # product cut-outs
```

## Music
- **Tempo and key:** 140 BPM (beat 0.4286 s), D minor, chords Dm–B♭–F–C.
- **Structure:**
  - Impact plus puck crack.
  - A 6-beat build with a riser and a ¼-beat gap.
  - **Drop A** (sticks) at 3.43 s.
  - A hockey-stop spray fill.
  - **Goal horn + Drop B** (skates) at 10.29 s.
  - **Goal horn + logo** at 17.14 s, then a ring-out to silence.
- **Sound design in the music:** puck crack, slap shot, skate-stop ice spray and two stadium goal horns. The pads and lead pump under the kick (sidechain).

## Cut list (b × 0.4286 s)
| Beat | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** a puck smashes into the glass over the logo, cracks spread, flash, ice-spray burst |
| 2–3.5 | 0.86 | **NEW / GEAR / JUST / DROPPED.**, one word per half-beat on navy with red slashes |
| 4–7 | 1.71 | Teasers, one product per beat (01–04), whipping in with light sweeps |
| 7.75 | 3.32 | One-beat gap to black |
| **8** | **3.43** | **Drop A:** the Unleashed Pro stick swings down onto the ice with spray. Then the **UNLEASHED PRO** tag, **NEW**, **IN STOCK** |
| 12 | 5.14 | JetSpeed whips in. **JETSPEED** spins up on split-flaps |
| 14 | 6.00 | Slap shot: the puck flies at camera. **SNIPE SEASON.** |
| 16 / 18 | 6.86 / 7.71 | Crossed sticks, **NEW CCM STICKS**, then the **IN STOCK** ink stamp slams |
| 20–21.5 | 8.57 | **AND / NEW / SKATES / LANDED.** |
| 22 | 9.43 | Bauer blade macro |
| 23.5 | 10.07 | **Hockey-stop spray white-out** (the signature transition) |
| **24** | **10.29** | **Drop B + goal horn:** the Bauer skate lands on the ice. **BAUER**, **JUST IN** |
| 28 | 12.00 | CCM skate on navy. **CCM**. **JUST LANDED** on split-flaps |
| 32 | 13.71 | Both skates: **NEW SKATES / IN STORE NOW** |
| 36–39 | 15.43 | **HOCKEY. / FIGURE / SKATING. / EVERYTHING ON ICE.** with a figure-8 tracing drawn on the ice |
| **40** | **17.14** | Logo slam with the goal horn and ice spray, then **NEW GEAR / IN STORE NOW** |
| 45.5–48 | 19.5–20.6 | Hold, ring-out |

## Notes
- **Cut-outs:** made with `cutout.py`, which flood-fills white from the border, keeps the main object and trims the fringe.
- **Skate image quality:** the skate photos are only 225×225 px, so they're upscaled 3.2× and are the softest part of the video. Larger product shots would make the skates much sharper.
- **Product names on screen** use only what's printed on the gear: "UNLEASHED PRO", "JETSPEED", "BAUER", "CCM". No specs or prices are claimed.

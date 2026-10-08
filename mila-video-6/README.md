# Mila film #6: "Out of Office"

19.54 s, 60 fps, H.264 High (CRF 12, BT.709), -14 LUFS AAC 320k. The film is pure motion graphics; the only photos used are the user's Florida listing photos.

**Outputs:**
- `out/mila_film6_1080x1350_60fps.mp4` (4:5 feed)
- `out/mila_film6_1080x1920_60fps.mp4` (9:16 Reels)
- `out/mila_film6_1080x1080_60fps.mp4` (1:1)
- 4:5 hook variants: `out/mila_film6_1080x1350_60fps_hook2.mp4` ("My calendar this week.") and `out/mila_film6_1080x1350_60fps_hook3.mp4` ("When's your next day off?")
- The main hook is "Agents don't get vacations."

**Seamless loop:** the last frame rebuilds the exact first frame, the calendar. The song's reverb tail is wrapped onto the start, so the sound loops too.

```bash
python3 timeline.py                                    # cues -> timeline.json
python3 build_audio.py path/to/COULD_BE_WRONG.mp3      # -> audio/mix.wav
node render.cjs --format square|feed|portrait          # [--hook "..." --tag hook2] [--stills 4.2,8.4]
```

## Music: "Could Be Wrong" (0:36.33 to 0:55.86)
- **Grid:** 86.0 BPM, one beat = 0.6977 s. The cut starts on a bar line in the hi-hat build, so the song's own drop (0:44.70) lands on video beat 12.
- **Reverb design:** a convolution hall (3.2 s) and a room (1.6 s), built from synthetic, darkening impulse responses.
  - **Throw:** the last beat of the build goes into the hall and washes through the song's quiet gap (b6–12).
  - **Reverse-reverb swell:** made from the drop itself and reversed, so it rises into b12.
  - **UI sends:** chimes, taps, keys and the toggle all go to the room, so they bloom instead of clicking.
  - **End:** the song fades into the hall, and the tail wraps around under the opening.
- **UI sound:**
  - calendar blocks landing and off-key dings, with a conflict buzz in the build
  - key clicks
  - a boom and sparkle on the drop
  - card thunks, then the "Approve all" chime run in E minor (E, G, B, high E)

## Cut list (b × 0.6977 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "Agents don't get vacations." over an already busy week calendar |
| 0–6 | 0–4.2 | Events pile on with the hi-hats, double-booked conflicts go red, "+6 more" chips, the counter climbs to 46. Shake builds, then a red conflict hit on b5.5 |
| 6 | 4.19 | **Freeze.** The reverb wash starts and the calendar turns to a ghost |
| 6.6–10.8 | 4.6–7.5 | A message to Mila: *I'm off till Monday. Keep everything moving.* Send |
| 11–12 | 7.7 | The message box turns into the sun and the calendar spirals into it |
| **12** | **8.37** | **DROP:** white flash, then a sunset over the sea. **Out of office.** The toggle switches ON |
| 14–18.5 | 9.8–12.9 | **Ready for approval** cards land: **Leads. Showings. Follow-ups. Posts.** |
| **20** | **13.95** | **Approve all**: four checks run on the quarter-beats |
| 21.5 | 15.0 | **Approved from the beach.** Polaroid postcards of the Florida listings |
| **24** | **16.75** | The **Mila** wordmark rises with the sun, then the tagline and *Comment "Mila" for a 7-day free trial.* |
| 27–28 | 18.8–19.5 | Loop tail: the sunset dissolves back into the calendar's frame 0 |

## Notes
- **Addresses:** all are fictional.
- **What Mila is shown doing:** it only prepares work for approval. Nothing is sent without the agent's tap.

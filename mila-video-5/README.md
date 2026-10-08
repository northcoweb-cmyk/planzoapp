# Mila film #5: "Maze to One Sentence" (Florida)

23.48 s, 60 fps, H.264 High (CRF 12, BT.709), -14 LUFS AAC 320k. It comes in three sizes:

- `out/mila_film5_1080x1080_60fps.mp4` (1:1)
- `out/mila_film5_1080x1350_60fps.mp4` (4:5 feed)
- `out/mila_film5_1080x1920_60fps.mp4` (9:16 Reels/Stories)

Extra outputs:

- **Cover** at the maze's peak: `out/cover_*.png`.
- **Hook variants** (1:1): `out/mila_film5_1080x1080_60fps_hook*.mp4`, with:
  - "I'll just set up my own AI agent." (main)
  - "Step 4 of 11."
  - "Day 3 of setting up my AI."

**Seamless loop:** the last frame rebuilds the exact first frame. Every ambient motion repeats every 72 units, and the music fades to silence on a bar line before the song's soft intro starts again.

```bash
python3 timeline.py                                   # cues -> timeline.json
python3 build_audio.py path/to/Kavkaz.mp3             # -> audio/mix.wav (-14 LUFS, <= -1 dBTP)
node render.cjs --format square|feed|portrait         # [--hook "Step 4 of 11." --tag hook2] [--stills 7.7,13.0]
```

## Music: "Kavkaz" (from 0:02.627)
- **Grid:** 0.326 s per unit (a 92 BPM half-beat). One bar is 8 units (2.609 s).
- **Cut:** song 2.627 to 26.105 s, cut sample-exact on the grid. No speed or pitch change.
- **Structure and mixing:**

  | Units | What happens |
  |---|---|
  | u0–24 | Full beat, with the beat dropping in at u8 |
  | u24–26 | True silence on the freeze |
  | u26–40 | Song muffled under a 650 Hz low-pass while the sentence is typed. The filter opens over u38.5–40 |
  | **u40** | Full song back on the COLLAPSE downbeat |
  | u55 | Half-beat drop-out |
  | **u56** | The drop, under the approval chimes (G minor: G, B♭, D, high G) |
  | u66–72 | Fade to zero for the loop |

- **Sound design:** synthesized for this video: dull window pops, off-key dings, error buzzes, a spinner, key clicks, the suck into the box, the thunk + bloom, card thunks, taps and chimes, whips, and the boom on the logo.

## Cut list (u × 0.326 s)
| u | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "I'll just set up my own AI agent." A buzzing phone and a blank chatbot on a laptop. This is the only place the chatbot logo appears |
| 4 | 1.30 | Camera pushes into the laptop, into the grey **maze** of generic setup windows (one per half-beat) |
| 10 / 16 / 20 | 3.3 / 5.2 / 6.5 | **11 steps.** / **Still not working.** / **Day 3.** Errors flash red on u18, 21 and 23. A cursor chases a spinner |
| 24 | 7.83 | **Freeze + silence.** The maze turns to ghosts and the world goes white |
| 26–27 | 8.5 | The glass chat box rises. **Or.** |
| 28.5–38.3 | 9.3–12.5 | One sentence is typed: *Set me up for Sunday's open house at 48 Coral Palm Way, Naples, and follow up with everyone from last week.* Send |
| 39–40 | 12.7 | The ghost windows re-saturate and spiral into the box |
| **40** | **13.04** | **COLLAPSE:** squash, bloom, shockwave. The box becomes the Mila phone |
| 41 / 44 / 47 / 50 | 13.4–16.3 | Mila features: **Open house. Ready.** (event card + checklist), **Posts.** (carousel fans out), **Emails.** (draft types itself), **Follow-ups.** (3 texts queued) |
| 53–54.5 | 17.3 | **Ready for approval:** 4 cards land. Drop-out at u55 |
| **56–57.5** | **18.26** | **DROP:** approve, approve, approve, approve. Count 4 → 0 |
| 58 | 18.9 | **Already set up.** |
| 61–63 | 19.9–20.5 | Whip-pans through Florida homes in glass cards: Sarasota, Delray Beach, Tampa, Fort Lauderdale |
| **64** | **20.87** | **Mila** wordmark, then the tagline, then *Comment "Mila" for a 7-day free trial.* |
| 70–72 | 22.8–23.5 | Loop tail: the end card dissolves back into the hook's frame 0 |

## Notes
- **Addresses:** all are fictional.
- **Brand safety:** the maze is invented generic UI. It has no logos, no vendor names and no URLs. Mila is never shown with an error state or claiming it connects to everything.
- **Photos:** the user's Florida photos. The Naples hero is used inside the app. The other four are used in the whips.

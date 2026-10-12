# Mila film #11: "Running Late"

18.75 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), -14 LUFS AAC 320k.

**Output:** `out/mila_film11_1080x1350_60fps.mp4`

```bash
python3 timeline.py && python3 build_audio.py path/to/Too_Much_For_Me_Extended.mp3
node render.cjs --format feed
```

## The voice
- **What she says:**
  > "Hey Mila, I'm running late. Book my two o'clock showing on Sea Grape, and text the Ellises I'll be five minutes late. My closing ran long."
- **How it was made:** generated with Kokoro TTS (Apache-2.0 model `kokoro-v1.0.int8.onnx`, voice `af_heart`, speed 1.12) by `tools/voice_tts.py`, one phrase per file in `assets/voice/`. The phrase timings drive the on-screen transcript and the inserts.
- **Voice chain:** high-pass, presence lift, soft compression and a small room.
- **Mixing against the song:** the song is sidechain-ducked about 9 dB under the voice, which sits about 10 dB over the reverb bed between phrases.

## Music: "Too Much For Me (Extended)" (0:35.74 to 0:54.49)
- **Tempo:** 128.0 BPM, one beat = 0.46875 s. Three sections agree.
- **Drop:** the bass drop lands on song beat 96 (0:45.12, a 16-bar line), which is video beat 20.
- **b0–18.5, the voice:** the song's breakdown is low-passed, thrown into a 4.5 s hall and ducked under the voice.
- **b18.5–19.5, the cool drop:** "On it, Rachel." The filter opens and the song stutters in eight 1/8-beat re-triggers.
- **b19.5–20:** a half-beat of silence filled by a reverse-reverb swell of the drop.
- **b20, the full drop:** dry and full-range, while the phone gets to work.

## Cut list (b × 0.46875 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "Running late to a showing?" Clock 1:52 PM, countdown ring, "8 MIN · Showing 2:00 PM · 1207 Sea Grape Ln" |
| 0.9–18 | 0.4–8.4 | **Mila · listening.** The orb reacts to her real voice envelope, with a live word-by-word transcript and a hard camera cut on every phrase. Inserts pop on her words: 1:53 PM chip, "2:00 PM showing", the house card on "Sea Grape", "Dana & Mark Ellis" on "Ellises", "+5 MIN" on "five", the closing that ran 15 min long on "closing" |
| 18.5 | 8.67 | **"On it, Rachel."** with the stutter strobe |
| 19.5 | 9.14 | Silence: the orb collapses to a point, then a flash |
| **20** | **9.38** | **DROP:** whip-cuts on the beat |
| 20–29.5 | 9.4–13.8 | Showing booked 2:00 PM (confirmed) → listing agent notified → text to the Ellises, drafted by Mila → **Send** (b23.5, delivered) → reply "No worries at all, see you soon!" (b24.5) → directions "Leave now · 14 min" → showing notes ready → calendar updated → 4 tiles: Booked, Texted, Ready, Prepped |
| 29.5 | 13.83 | **You talk. Mila handles it.** |
| 32 | 15.0 | **Mila** end card, the tagline, then *Comment "Mila" for a 7-day free trial.* |
| 39–40 | 18.3–18.75 | Loop tail back to the frame-0 clock |

## Notes
- **Data:** names and addresses are fictional.
- **What Mila is shown doing:** it drafts the text, and the agent taps Send.

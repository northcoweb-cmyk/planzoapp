# Mila film #15: "Pay Attention"

25.5 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), −14 LUFS AAC 320k. A hype-edit style video.

**Output:** `out/mila_film15_1080x1350_60fps.mp4`

```bash
# 1. instrumental: separate the reference audio (UVR MDX-Net Inst HQ3, ONNX from github.com/TRvlvr/model_repo releases)
python3 tools/mdx.py UVR-MDX-NET-Inst_HQ_3.onnx 6144 1.022 reference.wav audio/inst.wav
# 2. voice (Kokoro am_fenrir), timeline, mix, render
python3 timeline.py && python3 build_audio.py && node render.cjs --format feed
```

## Audio
- **Beat:** the beat from the reference edit the user supplied, with its original speech **removed by stem separation**. Leftover voice in the instrumental is 55–75 dB down. No speed or pitch change.
- **Voice:** a new Mila voiceover in the same slots and cadence as the original speech: *"And I'll tell you what. Every agent needs to start paying attention, because there's something going on… in real estate."* In the break: *"Her name's Mila."*
- **Voice processing:** high-pass, presence boost, 4:1 compression and light saturation. The beat ducks about 4.5 dB under the voice.
- **Reverb:** throws on "attention," on "in real estate." (washing into the drop and ducked when it lands) and on "Mila." (a long hall in the break).
- **Final hit:** a reversed-reverb swell and a sub boom lead into the final hit at 22.33 s. Its hall tail carries the end card and wraps onto the start for the loop.
- **Timing:** the edit is swung, at about 134.2 BPM. Every cut is snapped to the instrumental's actual kick and snare hits.

## Structure (seconds)
| t | Shot |
|---|---|
| 0–7.3 | **Intro, letterboxed:** slow pushes over Malibu at dusk, then Manhattan, the Mila orb, then the palm estate. Word-by-word captions of the voiceover. "real estate." lands as huge photo-filled type, and the camera pushes into it |
| **7.31** | **DROP:** the bars snap open, with camera shake on every kick. Slam words alternate with Mila doing the work: **LISTINGS. / listing copy drafted / WRITTEN. / DMs. / replies drafted / ANSWERED. / SHOWINGS. / weekend booked / BOOKED. / FOLLOW-UPS. / queued / SENT.** |
| 12.7 | Photo strobe on half-beats |
| 14.5 | "6 drafts." **Approve all**, then **All approved ✓** |
| 14.9 | **ONE TAP. / ZERO STRESS. / NO DAYS OFF.** on the brand gradient |
| 16.3 | City montage: Malibu, Manhattan, Naples, Austin, New York, Sarasota, Hill Country |
| 18.0 | **EVERY LISTING. / EVERY LEAD. / EVERY DAY.** |
| 19.6 | **Break:** black. The orb rises: "Her name's **Mila**." Then it inhales to a point |
| **22.33** | **HIT:** the **Mila** wordmark slams in with a ring burst and flash. Tagline, then *Comment "Mila" for a 7-day free trial.* |
| 24.7–25.5 | Loop tail back to the frame-0 hook |

## Notes
- The reference audio, its stems and the mix are kept local (`audio/*.wav` is gitignored).
- All data is fictional.
- What Mila is shown doing: everything is drafted for approval.

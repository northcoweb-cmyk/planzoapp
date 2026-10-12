# Mila film #10: "Departures"

18.46 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), -14 LUFS AAC 320k.

**Output:** `out/mila_film10_1080x1350_60fps.mp4`

```bash
python3 timeline.py && python3 build_audio.py path/to/It_Goes_Like_Nanana.mp3
node render.cjs --format feed
```

## Music: "It Goes Like Nanana" (2:13.05 to 2:31.51)
- **Tempo:** 130 BPM, one beat = 0.4615 s. The grid fits 0:00–1:56.
- **Drop:** the kick build starts at 2:18.6 (video beat 12). The full bass drop lands on song beat 304 (2:20.44, a 16-bar line), which is video beat 16, where the board flips to "ALL ON TIME".
- **The build:** the breakdown and kick build are low-passed and sit 4–5 dB lower, opening up over b11–15.25.
- **The reverb emphasis, "airplane mode":** on b15.25 the dry song cuts out. The beat before it is thrown into a 4.5 s hall, so the build hangs in reverb under the airplane-mode toggle until the drop.
- **Sound effects:** split-flap clatter made from real leaf-click physics (short bursts of hundreds of clicks), an airport PA chime, message pings, typing, the toggle, a jet swell, card thunks and chimes. The end reverb tail is wrapped to the start.

## Cut list (b × 0.4615 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "Your flight's boarding. Your work isn't." Gate D7 MIA → NAS. The split-flap **DEPARTURES** board lists your to-dos as flights, all DELAYED / NOT READY, and RACHEL → NASSAU is BOARDING |
| 1–10 | 0.5–4.6 | Client texts pile up. Rows flip to CANCELLED / DELAYED 2H, and your flight goes to **FINAL CALL** (b8) |
| 12–14.75 | 5.5–6.8 | Kick build: type to Mila, "Flying out. Cover everything till Monday.", then send |
| 15.25 | 7.04 | **Airplane mode ON:** desaturate, push in, the dry song cuts to the reverb hang |
| **16** | **7.38** | **DROP:** the whole board scrambles to **ALL ON TIME**, the gate shows DEPARTED, and "Wheels up." over the take-off |
| 17.6–29.6 | 8.1–13.7 | Seat-back flight map MIA → NAS (altitude, speed, ETA). Results land every 2 beats: lead reply, showing, open house, buyer email, follow-ups, listing post (**READY ✓**) |
| 30 | 13.85 | **Landed.** The board flips to ARRIVALS / READY ✓ |
| 31 | 14.31 | "6 ready for you, Rachel · Approve all" is tapped, and the board flips to **DONE ✓** |
| 32 | 14.77 | **You traveled. Mila worked.** |
| 35 | 16.15 | **Mila** end card. **COMMENT "MILA" / 7-DAY FREE TRIAL** flaps in on split-flaps |
| 39–40 | 18.0–18.46 | Loop tail back to the frame-0 board |

## Notes
- **Data:** names, flights and addresses are fictional.
- **What Mila is shown doing:** it only drafts and queues work for approval.

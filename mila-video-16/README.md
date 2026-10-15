# Mila film #16: "On the Calendar"

20.3 s, 1080×1350 (4:5 feed), 60 fps, H.264 High (CRF 12), −14 LUFS AAC 320k.

```bash
python3 timeline.py && python3 build_audio.py path/to/90s_Legacy.mp3 && node render.cjs --format feed
```

## Music: "90s Legacy" (1:51.72 to 2:12.03)
- **Tempo:** 130.0 BPM, phase 0.028 s.
- **Drop:** the main drop is song beat 258 (1:59.10), exactly 192 beats after the first drop. It lands on **video beat 16**.
- **The build:** the song's breakdown, which goes almost silent for its last 3 beats. A high-pass sweep thins it out, and the last loud beat is thrown into a 4.5 s hall so it hangs through the gap after the "Add to calendar" tap. A reversed-reverb swell leads into the drop.
- **Sound effects (G major pentatonic):** a hit and a notification for every client text, keys for the typing, pops as Mila finds each event, a whip and a check as each event lands in the week, notifications on the lock screen.

## Cut list (b × 0.4615 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook (letterboxed):** "Still adding these by hand?" A client text with the time highlighted |
| 2–6 | 0.9–2.8 | One text per beat over listing photos: the inspection, the appraisal, the closing, the open house, the walkthrough. They pile up |
| 7 | 3.23 | **"6 events. 0 on your calendar."** |
| 8–10.75 | 3.7–5.0 | "Or just tell Mila." *Put all of these on my calendar.* |
| 11 | 5.08 | Mila found 6 events. From 6 texts |
| 13.5–15 | 6.2–6.9 | **Add 6 events?** Google Calendar ✓ and Apple Calendar ✓ are switched on, then the **Add to calendar** tap and the hang |
| **16** | **7.38** | **DROP:** the bars snap open to a bright world. The **Google Calendar** and **Apple Calendar** icons slam in: **Synced.** |
| 17–22 | 7.8–10.2 | **On your calendar.** A week view. Each event lands on its beat, with a toast reading "Added to Google Calendar ✓" or "Added to Apple Calendar ✓" |
| 24–28 | 11.1–12.9 | **Reminders, handled.** Lock-screen notifications: Calendar, Google Calendar, Mila |
| 28–32 | 12.9–14.8 | **Texted. Scheduled. Synced. Reminded.** |
| 32–34 | 14.8–15.7 | "You just say it. / Mila puts it on *the calendar.*" |
| 34 | 15.69 | End card, then *Comment "Mila" for a 7-day free trial.* "Works with Google Calendar · Apple Calendar" |
| 42.5–44 | 19.6–20.3 | Loop tail back to the frame-0 hook |

## Notes
- **Google Calendar icon:** the official 2020 icon, from `@iconify-json/logos`.
- **Apple Calendar icon:** recreated (white squircle, red weekday, black date) to match the iOS app icon.
- **Fictional data:** names, addresses and times are fictional.
- **What Mila is shown doing:** Mila finds the events and you approve them ("Add 6 events?") before they're added.

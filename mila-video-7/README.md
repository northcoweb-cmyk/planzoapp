# Mila film #7: "Close Every Tab"

18.41 s, 60 fps, H.264 High (CRF 12, BT.709), -14 LUFS AAC 320k. The film is pure motion graphics. Every app in the switcher is generic and invented: no real logos or product names.

**Outputs:**
- `out/mila_film7_1080x1350_60fps.mp4` (4:5 feed)
- `out/mila_film7_1080x1920_60fps.mp4` (9:16 Reels)
- `out/mila_film7_1080x1080_60fps.mp4` (1:1)
- 4:5 hook variants: `_hook2` ("Close every tab.") and `_hook3` ("My phone during a showing.")
- Covers: `out/cover_{square,feed,portrait}.png`
- The main hook is "12 apps to sell one house."

**Seamless loop:** the last frame rebuilds the exact first frame (the switcher with 3 apps open). The end reverb tail is wrapped onto the start.

```bash
python3 timeline.py                                    # cues -> timeline.json
python3 build_audio.py path/to/Money_Talks.mp3         # -> audio/mix.wav
node render.cjs --format square|feed|portrait          # [--hook "..." --tag hook2] [--stills 5.3,7.4]
```

## Music: "Money Talks" (0:36.46 to 0:54.87)
- **Grid:** 130.4 BPM, one beat = 0.4602 s. The cut starts 16 beats before the drop, so the song's drop (bass onset 0:43.83) lands on video beat 16 (7.36 s).
- **Silent beat:** the song's own near-silent beat at video beat 7 freezes the switcher.
- **Reverb:** a convolution hall and room. The UI sounds (pops, swipes, chimes, taps) go to the room. A short reverse-reverb swell rises into the drop, and the end tail is wrapped to the start.

## Cut list (b × 0.4602 s)
| b | Time | Shot |
|---|---|---|
| 0 | 0.00 | **Hook:** "12 apps to sell one house." App switcher showing Mila, Inbox, Calendar and Texts, with "3 apps open" |
| 1–10 | 0.5–4.6 | Apps pile in on the beat: CRM, Notes, Docs, Design, Listings, Spreadsheet, Browser, Social, E-sign. Badges climb, and red hits land on b5.5, 6.5 and 10.5. Freeze on b7 |
| 12–15.5 | 5.5–7.1 | **Close every tab.** All 12 apps are swiped away, faster and faster. The counter counts down to "Only Mila open" |
| **16** | **7.36** | **DROP:** Mila opens and the world turns white |
| 16–28 | 7.4–12.9 | **Leads.** (reply drafted) → **Calendar.** (Saturday showings set) → **Emails.** (just-listed email types itself) → **Follow-ups.** (3 queued) → **Posts.** (carousel fans out) → **Approvals.** (3 taps). Each feature absorbs the old app icon |
| 28–30 | 12.9–13.8 | **12 apps.** A ring of icons spirals into the Mila icon. **One app.** |
| 32 | 14.73 | **Mila** wordmark, then the tagline and *Comment "Mila" for a 7-day free trial.* |
| 39–40 | 17.9–18.4 | Loop tail back to the frame-0 switcher |

## Notes
- **Addresses:** all are fictional.
- **What Mila is shown doing:** it only drafts and queues work for approval.

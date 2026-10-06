# Mila film #2: "A NYC agent's day, handled."

25 s, 1080×1080, 60 fps. One agent's day from 7:42 AM to 9:15 PM. A sun/moon arc runs across the top of every frame, and the app's theme flips from day to night on the song's drop.

Built the same way as video #1 (`../mila-launch-video`): every frame is a pure function of time, cut to a fitted beat grid, captured at 120 fps and averaged to 60 fps for a 180° shutter.

```bash
python3 timeline.py                         # cue sheet -> timeline.json
python3 build_audio.py path/to/song.mp3     # -> audio/mix.wav (-14 LUFS, <= -1 dBTP, 48 kHz)
node render.cjs --format square             # -> out/mila_film2_1080x1080_60fps.mp4
node render.cjs --format square --stills 12.7,22.2
```

Preview: run `python3 -m http.server`, then open `http://localhost:8000/` (it plays with audio and has a scrubber).

## Song analysis: "Let's Do It"
- **152.03 BPM**: beat 0.39467 s, bar 1.5787 s. The grid is a least-squares fit to 511 detected beats, with a mean error of 8 ms. It feels like half-time trap at 76 BPM.
- **Key:** about F major. The chimes are on F / A / C and the logo boom is on F.
- **Structure:** a quiet intro from 0 to 12.77 s, then a **single drop at 12.770 s** (grid beat 32). After that the energy stays flat until the outro at about 3:12. This is the only build and drop in the song.
- **Window:** 0:00.141 → 0:25.400, grid beats 0 → 64 (16 bars). It's trimmed on downbeats with no stretching or pitch change.
- **Drop = video beat 32 = 12.629 s.** That's where day turns to night.
- **The calm:** a 2nd-order low-pass dives to 420 Hz on beat 48. A noise and sine riser starts on beat 52, and the filter snaps fully open on the **final downbeat, beat 56 = 22.101 s**, the logo. The fade-out over the last bar reaches silence on beat 64.
- **Checked on the cut:** bass energy goes from 98 to 916 exactly on beat 32. High-frequency energy falls from about 1000 to about 40–120 during beats 49–55 and comes back on beat 56. The grid lines up within one frame.

## Cut list

b = video beat. Time = b × 0.39467 s. Frames are at 60 fps.

| Beat | Time | Frame | Clock | Shot | Transition | Photo / grade |
|---|---|---|---|---|---|---|
| 0 | 0.000 | 0 | 7:42 AM | Rack focus from a sharp window mullion to the phone (light theme, "Good morning, Sarah."). The sun sits at the left of the arc | fade from black, anamorphic flare | white loft · morning |
| 2 | 0.789 | 47 | | **"7 AM"** behind the phone. Typing "Set me up for 245 W 19th St, New York. Showing at 3." | masked rise | |
| 6 | 2.368 | 142 | 7:48 AM | Send. The address autocompletes to "New York, NY 10011" on a Manhattan line map | **vertical slat wipe** | map |
| 7 | 2.763 | 166 | | Pin lands. **"Chelsea."** | drop + ripple | |
| 8 | 3.157 | 189 | 8:30 AM | Listing brief: 4 photos pulled in, ring fills, rows tick on 9 / 10 / 11 | **window-pane mask** | white loft · midday |
| 9 | 3.552 | 213 | | **"Ready."** | | |
| 12 | 4.736 | 284 | 10:15 AM | **Split screen:** carousel on the left (swipes on 13 / 14 / 15), Instagram story on the right. **"Posted."** | hard vertical split | loft (+ dusk, night thumbnails) |
| 16 | 6.315 | 379 | 11:40 AM | **The building:** one continuous downward camera move, landing on a floor every 3 beats. Email: subject and body type out, then signature "Sarah Bennett". **"11:40 / Sent."** | the frame keeps scrolling down | sky: midday |
| 19 | 7.499 | 450 | 12:40 PM | Texts to Jordan Ellis, Priya Shah and the Coopers, each marked Queued. **"Queued."** | floor landing | |
| 22 | 8.683 | 521 | 1:30 PM | *New:* pipeline with stage chips. "Who should I follow up with?" → "Jordan and Priya." | floor landing | |
| 25 | 9.867 | 592 | 3:00 PM | Calendar: the 3 PM showing drops in, tasks tick to 8 of 12. **"Showing."** | floor landing | sky: afternoon |
| 28 | 11.051 | 663 | 4:30 PM | *New:* transaction checklist for 88 Horatio St (contract, inspection, appraisal ✓). **"Closing."** | floor landing | sky: golden |
| 31 | 12.235 | 734 | 5:58 PM | Fly through a window into the dusk apartment. The approval stack is still in day theme | **window-frame mask** | dusk sofa · golden |
| **32** | **12.629** | **758** | 6:05 PM | **DROP:** the first Approve tap. **Day → night** in one move: the night sky opens out from the moon inside the app, the UI turns to dark glass with stars, the sun sets on the arc and the moon rises, and the photo regrades from golden to blue hour. Brand-gradient pulse. **"Approved."** | theme shift | dusk → blue hour |
| 33 / 34 / 35 | 13.024 / 13.419 / 13.813 | 781 / 805 / 829 | 6:40 / 7:10 / 7:30 | Three more taps, each with a check, a chime and a gradient pulse. Cards sweep away, then "All approved" | | → night |
| 35.5–36 | | | | **Match cut:** the last tap rings out like a doorbell | expanding rings | |
| 36 | 14.208 | 852 | 7:52 PM | *New:* voice log in a cab. A taxi light streak crosses the frame and becomes the note card's glow. The waveform listens | **match cut** (taxi light → card glow) | night kitchen (blurred city) + cab window frame |
| 38 | 14.997 | 900 | | The waveform collapses into a clean note ("Wants a 2BR under $1.3M"). **"Logged."** | | |
| 40 | 15.787 | 947 | 8:40 PM | *New:* week overview. Pipeline value ticks from $2.40M to $3.65M, bars grow. **"Pipeline up."** | **3D cube rotate** | night kitchen |
| 44 | 17.365 | 1042 | 9:15 PM | "What am I forgetting today?" ✓ 45, ✓ 45.5, ✓ 46, then **"All clear."** on 47 | cube + **window-pane mask** | night living (lit skyline) |
| 48 | 18.944 | 1137 | 9:15 PM | **The calm:** low-pass filter, city bokeh, skyline pulls into focus. **"Goodnight."** behind the phone | rack focus | |
| 52 | 20.523 | 1231 | | Riser builds | | |
| **56** | **22.101** | **1326** | — | **Final downbeat:** white, then the Mila wordmark rises in white from the city light with a bloom, on the brand gradient. The moon stays on the arc | light bloom | brand gradient + skyline glow |
| 57 / 58 / 58.5 | 22.496 / 22.891 / 23.088 | | | Tagline, then Comment "Mila" / for a 7-day free trial | masked line reveals | |
| 61.5–64 | 24.272–25.259 | 1456–1515 | | Frozen hold of 1 s or more. Silence lands on beat 64 | hold | |

## Notes
- **Listing:** 245 W 19th St, Apt 6B, New York, NY 10011, for sale at $1,250,000 (2 bd / 2 ba / 1,140 sq ft). Every name, price, address and phone number is fictional, using 555 numbers.
- **Photos are kept true to their time of day.** The white loft carries every daytime scene; it's graded morning, then midday. The dusk sofa covers golden hour into blue hour. The two night photos stay night. The sources are 331–440 px wide; they're upscaled with Lanczos plus denoise and sit mostly behind shallow depth of field.
- **No URL, vendor names, API names or error states** appear anywhere.
- **Branding** matches film #1: Instrument Serif wordmark at −2% tracking, white on the #8FB4FF → #A68CFF → #FFC9A8 gradient.

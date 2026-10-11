"""Video #9 "Patch" - single source of truth.
b = one beat of "Patch" at 130 BPM (0.46150 s). seconds = b * BEAT.
Grid fitted to the onsets of all three full-energy sections (0:30-0:58, 1:30-1:56, 2:28-2:56): identical period.
"""
import json

BEAT = 0.46150
PHASE = 0.0140               # song time of grid beat 0
DROP_SONG_BEAT = 64          # 0:29.55 = the first bass hit of the drop
DROP_B = 16                  # ... lands on video beat 16 = "100% · Installed"
TOTAL_B = 40                 # 10 bars = 18.46 s
START_BEAT = DROP_SONG_BEAT - DROP_B          # song beat 48 = 0:22.17, inside the melodic breakdown
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

NOTES = ["+ Drafts replies to every new lead", "+ Books showings on your calendar", "+ Writes the listing copy", "+ Builds the Instagram carousel",
         "+ Emails your buyer list", "+ Queues every follow-up", "- Removed: 12 apps"]
NOTE_B = [5, 6, 7, 8, 9, 10, 11]
NODES = ["Calendar", "Email", "CRM", "MLS", "Social", "Texts"]
CARDS = [  # [beat, title, detail, icon]
    [18, "Lead reply drafted", "Jordan · 48 Coral Palm Way", "msg"],
    [20, "Showing booked", "Sat 11 AM · 1207 Sea Grape Ln", "cal"],
    [22, "Listing copy written", "48 Coral Palm Way · Naples", "doc"],
    [24, "Carousel built", "3 slides · Just listed", "photo"],
    [26, "Buyer email ready", "31 buyers · Naples", "mail"],
    [28, "9 follow-ups queued", "Everyone from Sunday", "users"],
]

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT,
    "drop": DROP_B, "stuck": 15, "notes": NOTES, "noteBeats": NOTE_B, "nodes": NODES, "nodeBeats": [16.5, 17, 17.5, 18, 18.5, 19], "cards": CARDS,
    "approve": 30, "patched": 32, "logo": 35, "loopTail": [39, 40],
    "sfx": [
        [0.0, "glitch"], [1.0, "err"], [2.0, "err"], [3.0, "err"], [3.5, "glitch"],
        [4.0, "chime_lo"], *[[b, "tick"] for b in NOTE_B],
        *[[12 + k * 0.25, "data"] for k in range(12)], [14.0, "glitch"], [14.5, "glitch"],
        [15.0, "freeze"],
        [16.0, "boom"], [16.0, "bloom"], [16.0, "sparkle"],
        *[[b, "node"] for b in [16.5, 17, 17.5, 18, 18.5, 19]],
        *[[c[0], "card"] for c in CARDS], *[[c[0] + 0.5, "chime"] for c in CARDS],
        [30.0, "tap"], [30.0, "chime_hi"], [30.0, "sparkle"],
        [32.0, "through"], [35.0, "boom"], [35.0, "sparkle"], [36.0, "chime"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f | video %.4f s | stuck@99 %.3f | DROP %.3f | logo %.3f"
      % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, 15 * BEAT, DROP_B * BEAT, 35 * BEAT))

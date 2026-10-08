"""Video #7 "Close Every Tab" - single source of truth.
b = one beat of "Money Talks" (130.4 BPM, 0.4602 s). seconds = b * BEAT.
Read by scene.js (picture) and build_audio.py (sound).
"""
import json

BEAT = 0.460200             # grid fitted to the onsets over 0:44-1:10
PHASE = 0.1074              # song time of grid beat 0
START_BEAT = 79             # 0:36.463; the drop (bass onset 0:43.83) is song beat 95 = video b16
TOTAL_B = 40                # 10 bars = 18.408 s; ends where the song breaks (0:54.9)
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

# apps piling into the switcher during the build (generic names + icons only): [name, icon, badge, beat]
APPS = [["Inbox", "mail", 41, -1], ["Calendar", "cal", 9, -1], ["Texts", "msg", 23, -1], ["CRM", "users", 12, 1.0], ["Notes", "note", 0, 2.0],
        ["Docs", "doc", 3, 3.0], ["Design", "brush", 0, 4.0], ["Listings", "home", 6, 5.0], ["Spreadsheet", "grid", 0, 6.0], ["Browser", "globe", 47, 8.0],
        ["Social", "heart", 18, 9.0], ["E-sign", "pen", 4, 10.0]]
SWIPES = [12.0, 12.5, 13.0, 13.5, 14.0, 14.25, 14.5, 14.75, 15.0, 15.25, 15.375, 15.5]     # all 12 apps swiped away, accelerating
FEATS = [16, 18, 20, 22, 24, 26]          # Leads, Calendar, Emails, Follow-ups, Posts, Approvals

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT,
    "drop": 16, "feats": FEATS, "oneApp": 28, "logo": 32, "loopTail": [39, 40], "apps": APPS, "swipes": SWIPES,
    "sfx": [
        *[[a[3], "pop"] for a in APPS if a[3] >= 0],
        [0.5, "ding"], [1.5, "ding"], [2.5, "ding"], [3.5, "ding"], [5.5, "ding"], [6.5, "ding"], [9.5, "ding"], [10.5, "ding"],
        *[[s, "swipe"] for s in SWIPES],
        [15.75, "suck"],
        [16.0, "boom"], [16.0, "bloom"], [16.0, "sparkle"],
        *[[f, "absorb"] for f in FEATS[1:]], *[[f + 0.5, "chime"] for f in FEATS],
        [26.5, "tap"], [27.0, "tap"], [27.5, "tap"],
        [28.0, "through"], [32.0, "boom"], [32.0, "sparkle"], [34.0, "chime_hi"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f | video %.4f s | drop %.3f | one app %.3f | logo %.3f"
      % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, 16 * BEAT, 28 * BEAT, 32 * BEAT))

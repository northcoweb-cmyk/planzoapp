"""Video #13 "Viral" - single source of truth.
b = one beat of "Can You Just Relax" at 128.0 BPM (0.46875 s). seconds = b * BEAT.
Grid: onset-strength search over the whole song and over both drops independently gives 128.00 BPM, phase 0.012 s.
The song's breakdown starts at song beat 272 (2:07.51, everything but pads and vocal drops out) and the main drop's first
kick is song beat 288 (2:15.01), with a natural half-beat of silence at 287.0 and a pickup at 287.5.
Video beat 0 = song beat 272, so the whole breakdown is the build and the drop lands on video beat 16.
"""
import json

BEAT = 60 / 128
PHASE = 0.012
DROP_SONG_BEAT = 288
DROP_B = 16
TOTAL_B = 44                       # 11 bars = 20.6 s
START_BEAT = DROP_SONG_BEAT - DROP_B
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

# build: notifications on the post, one per beat
NOTIFS = [[2, "jordan.ellis", "liked your post"], [3, "priya.shah", "shared your post"], [4, "marcus.lee", "saved your post"],
          [5, "dana.ellis", "“Is this still available?”"], [6, "k.morgan", "shared your post"], [7, "sam.ortiz", "and 86 others liked your post"]]
CAROUSEL = [[2.5, 1], [3.5, 2], [4.5, 3], [5.5, 4], [7.5, 0]]           # beat, photo index (b7.5 = fast rewind to the hero)
HEAD = [[0, "You post one listing."], [4, "People start sharing it."], [8, "Then their friends do."], [12, "And theirs."], [14.5, "And then…"]]
KICK_DROP = [[16, "Shared."], [17, "Saved."], [18, "Sent."], [19, "Everywhere."]]
DMS = [["jordan.ellis", "Is this still available??"], ["priya.shah", "Can we tour this weekend?"], ["marcus.lee", "Pre-approved. Cash. Call me."],
       ["dana.ellis", "What are the HOA fees?"], ["k.morgan", "Is the seller flexible?"], ["alex.rivera", "Sent this to my husband 😍"],
       ["sam.ortiz", "Can I bring my agent?"], ["t.nguyen", "Any open house?"], ["j.brooks", "Still on the market?"], ["m.castillo", "Saturday works for us!"]]
SHOWINGS = [[24 + i * 0.5, r] for i, r in enumerate(["Sat · 10:00 AM · Jordan Ellis", "Sat · 11:30 AM · Priya Shah", "Sat · 2:00 PM · Marcus Lee",
            "Sun · 10:00 AM · Dana & Mark", "Sun · 1:00 PM · Sam Ortiz", "Sun · 3:30 PM · Kate Morgan"])]
KICKER = [["Posted.", 28, "cliff_sunset"], ["Shared.", 29, "palm_estate"], ["Answered.", 30, "conservatory"], ["Booked.", 31, "living_room"]]

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
    "notifs": NOTIFS, "carousel": CAROUSEL, "head": HEAD, "kickDrop": KICK_DROP, "dms": DMS, "showings": SHOWINGS, "kicker": KICKER,
    "pullBack": [8, 14], "hang": 15.0, "snap": 20, "sort": 21, "draft": 22, "approve": 23, "approveTap": 23.5, "booked": 27,
    "onePost": 32, "rest": 33, "logo": 34, "loopTail": [42, 44],
    "sfx": [
        *[[n[0], "notif"] for n in NOTIFS], *[[c[0], "swipe"] for c in CAROUSEL[:-1]], [7.5, "rewind"],
        *[[8 + i * 0.5, "ping"] for i in range(8)], *[[12 + i * 0.25, "ping"] for i in range(8)], *[[14 + i * 0.125, "ping"] for i in range(8)],
        [11.0, "riser"], [14.5, "air"],
        [16.0, "boom"], [16.0, "swarm"], [16.0, "bloom"], [17.0, "hit"], [18.0, "hit"], [19.0, "hit"], [17.0, "swarm"], [18.0, "swarm"], [19.0, "swarm"],
        [19.75, "zoomin"], [20.0, "snap"], *[[20 + i * 0.125, "tick"] for i in range(8)], [21.0, "card"], [21.0, "whip"], [22.0, "whip"],
        *[[22.1 + i * 0.06, "tick"] for i in range(6)], [23.0, "whip"], [23.5, "tap"], [23.5, "chime_hi"], [23.5, "sparkle"],
        [24.0, "whip"], *[[s[0], "pop"] for s in SHOWINGS], [27.0, "hit"], [27.0, "chime"], [27.0, "sparkle"],
        *[[k[1], "whip"] for k in KICKER], *[[k[1], "hit"] for k in KICKER],
        [32.0, "hit"], [33.0, "boom"], [33.0, "bloom"], [34.0, "chime"], [35.5, "chime"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1, ensure_ascii=False)
print("song %.4f -> %.4f | video %.4f s | DROP %.3f s | snap %.3f | logo %.3f" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT, 20 * BEAT, 34 * BEAT))

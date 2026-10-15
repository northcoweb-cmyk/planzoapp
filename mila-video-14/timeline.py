"""Video #14 "The Match" - single source of truth.
b = one beat of "Real Love" at 128.0 BPM (0.46875 s). seconds = PHASE + b * BEAT from the song start.
Grid: the intro kicks fit 128.00 BPM with 0.1 ms residual; a fixed-tempo phase search over the intro and both drops gives
0.026-0.062 s, so PHASE = 0.045. The main drop's first kick is song beat 206 (1:36.61), exactly 128 beats after the first drop.
Song beats 201.5-205.5 have no kick (the pre-drop riser). Video beat 0 = song beat 190, so the drop lands on video beat 16.
"""
import json, random

BEAT = 60 / 128
PHASE = 0.045
DROP_SONG_BEAT = 206
DROP_B = 16
TOTAL_B = 52                       # 13 bars = 24.4 s
START_BEAT = DROP_SONG_BEAT - DROP_B
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

REQS = [[1.0, "budget", "$5,000 – $6,000 / mo"], [2.0, "chip", "1–2 bed"], [2.5, "chip", "Natural light"], [3.0, "chip", "Doorman"],
        [3.5, "chip", "In-unit laundry"], [4.0, "chip", "Near the subway"], [4.5, "chip", "Dog-friendly"]]
PROMPT = "Find Maya a place in Manhattan. $5–6K, lots of light, doorman, W/D."
def typing(text, b0, b1, seed):
    rnd = random.Random(seed); gaps = [rnd.uniform(0.6, 1.3) * (1.3 if i and text[i - 1] == " " else 1) for i, _ in enumerate(text)]
    tot, t, out = sum(gaps), b0, []
    for g in gaps: out.append(round(t, 4)); t += g / tot * (b1 - b0)
    return out
FUNNEL = [[8.0, 4812, "Manhattan listings"], [9.5, 612, "In budget"], [11.0, 38, "Every must-have"], [12.5, 3, "Best fits"]]
MATCHES = [
    {"b": 16, "photo": "chelsea_living", "hood": "Chelsea", "addr": "W 22nd St · #14C", "bed": "1 bd · 1 ba", "price": "$5,450", "pct": 92},
    {"b": 17, "photo": "village_kitchen", "hood": "West Village", "addr": "Perry St · #5F", "bed": "1 bd · 1 ba", "price": "$5,800", "pct": 94},
    {"b": 18, "photo": "nassau_dining", "hood": "Financial District", "addr": "Nassau St · #18A", "bed": "2 bd · 1 ba", "price": "$5,950", "pct": 98},
]
GALLERY = [[24, "nassau_living"], [25, "nassau_kitchen"]]          # pop in over the hero; b26 they settle into a grid
KICKER = [["Budget.", 32, "chelsea_living"], ["Wishlist.", 33, "village_kitchen"], ["Matched.", 34, "nassau_living"], ["Toured.", 35, "nassau_dining"]]

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
    "reqs": REQS, "prompt": PROMPT, "keyBeats": typing(PROMPT, 5.6, 7.55, 14), "send": 7.75, "funnel": FUNNEL, "found": 14, "hang": 15.0,
    "matches": MATCHES, "shortlist": 19, "sent": 20, "typingDots": 21, "reply": 21.75, "pick": 22.5, "gallery": GALLERY, "arrange": 26, "checks": 27,
    "tour": 30, "kicker": KICKER, "outro": 36, "logo": 38, "loopTail": [50, 52],
    "sfx": [
        [0.0, "none"], *[[r[0], "pop"] for r in REQS], [1.0, "hit"],
        *[[k, "tick"] for k in typing(PROMPT, 5.6, 7.55, 14)[::2]], [7.75, "send"], [5.0, "whip"],
        [8.0, "whip"], *[[f[0], "hit"] for f in FUNNEL], *[[8 + i * 0.25, "ping"] for i in range(24)], [10.0, "riser"],
        [14.0, "chime"], [15.0, "air"],
        [16.0, "boom"], [16.0, "bloom"], [16.0, "sparkle"], [17.0, "whip"], [17.0, "hit"], [18.0, "whip"], [18.0, "hit"],
        [19.0, "whip"], *[[19 + i * 0.25, "pop"] for i in range(3)], [20.0, "send"], [20.0, "chime"], [21.0, "tick"], [21.75, "notif"],
        [22.5, "tap"], [22.5, "chime_hi"], [22.5, "sparkle"], [23.0, "whip"],
        *[[g[0], "pop"] for g in GALLERY], *[[g[0], "hit"] for g in GALLERY], [23.25, "bloom"], [26.0, "whip"], [27.0, "card"], *[[27.25 + i * 0.25, "check"] for i in range(6)],
        [30.0, "whip"], [30.0, "stamp"], [30.5, "chime"],
        *[[k[1], "whip"] for k in KICKER], *[[k[1], "hit"] for k in KICKER],
        [36.0, "boom"], [36.0, "bloom"], [37.0, "hit"], [38.0, "chime"], [39.5, "chime"],
    ],
}
timeline["sfx"] = [s for s in timeline["sfx"] if s[1] != "none"]
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1, ensure_ascii=False)
print("song %.4f -> %.4f | video %.4f s | DROP %.3f s | pick %.3f | logo %.3f" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT, 22.5 * BEAT, 38 * BEAT))

"""Video #5 "Maze to One Sentence" - single source of truth.
u = one grid unit = half a beat of "Kavkaz" (92 BPM feel, 184 grid). seconds = u * U.
Read by scene.js (picture) and build_audio.py (sound).
"""
import json, random

U = 0.326083                 # half-beat (grid unit); a bar = 8 u = 2.609 s
GRID_PHASE = 0.018           # song time of grid unit 0
START_UNIT = 8               # 0:02.627, the bar line closest to 0:03
TOTAL_U = 72                 # 9 bars = 23.478 s -> the loop restarts on a bar line
SONG_START = GRID_PHASE + U * START_UNIT
FPS = 60

LINES = ["Set me up for Sunday's open house", "at 48 Coral Palm Way, Naples,", "and follow up with everyone", "from last week."]
PROMPT = "\n".join(LINES)
TYPE0, TYPE1 = 28.5, 38.3


def typing(text, u0, u1, seed):
    rnd = random.Random(seed); gaps = []
    for i, ch in enumerate(text):
        g = rnd.uniform(0.6, 1.3)
        if ch == "\n": g *= 2.4
        elif i and text[i - 1] in " ,'": g *= 1.25
        gaps.append(g)
    tot, t, out = sum(gaps), u0, []
    for g in gaps: out.append(round(t, 4)); t += g / tot * (u1 - u0)
    return out


timeline = {
    "unit": U, "fps": FPS, "songStart": SONG_START, "totalUnits": TOTAL_U, "duration": TOTAL_U * U,
    "beatDrop": 8, "freeze": 24, "silence": [24, 26], "calm": [26, 40], "collapse": 40, "dropout": 55, "drop": 56, "logo": 64,
    "loopTail": [70, 72],
    "prompt": PROMPT, "keyUnits": typing(PROMPT, TYPE0, TYPE1, 21),
    "emailType": [47.4, 49.6],
    "sfx": [
        [0.5, "buzz"], [2.0, "buzz"], [1.0, "ding"], [3.0, "ding"],
        *[[u, "win"] for u in range(4, 24)],
        *[[u + 0.5, "win"] for u in range(18, 24)],
        [9.0, "ding"], [12.0, "ding"], [14.0, "ding"], [15.0, "ding"], [17.0, "ding"],
        [18.0, "err"], [21.0, "err"], [23.0, "err"],
        [20.0, "spin"],
        [24.0, "freeze"],
        [26.0, "air"], [27.0, "chime_g"],
        [38.9, "send"], [39.0, "suck"],
        [40.0, "thunk"], [40.0, "bloom"],
        [41.0, "through"], [42.0, "tick"], [42.5, "tick"], [43.0, "tick"],
        [44.0, "through"], [44.5, "swish"], [45.0, "swish"],
        [47.0, "through"],
        [50.0, "through"], [50.5, "pop"], [51.0, "pop"], [51.5, "pop"],
        [53.0, "card"], [53.5, "card"], [54.0, "card"], [54.5, "card"],
        [56.0, "tap"], [56.0, "chime_g"], [56.0, "bloom"],
        [56.5, "tap"], [56.5, "chime_bb"],
        [57.0, "tap"], [57.0, "chime_d"],
        [57.5, "tap"], [57.5, "chime_g_hi"], [57.5, "sparkle"],
        [61.0, "whip"], [62.0, "whip"], [62.5, "whip"], [63.0, "whip"],
        [64.0, "boom"], [64.0, "sparkle"],
        [66.0, "chime_d"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f | video %.4f s | freeze %.3f | collapse %.3f | drop %.3f | logo %.3f"
      % (SONG_START, SONG_START + TOTAL_U * U, TOTAL_U * U, 24 * U, 40 * U, 56 * U, 64 * U))

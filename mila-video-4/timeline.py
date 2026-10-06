"""Video #4 "Chaos to Calm" (Maryland) - single source of truth for every cue.
Times are video beats (b); seconds = b * BEAT. Read by scene.js and build_audio.py.
"""
import json, random

BEAT = 0.44444                       # 135.00 BPM (grid fitted on the drum sections)
BPM = 60.0 / BEAT
GRID_PHASE = 0.2400                  # song time of grid beat 0
START_INDEX = 35                     # 0:15.795, a downbeat
TOTAL_BEATS = 48                     # 21.333 s
SONG_START = GRID_PHASE + BEAT * START_INDEX
FPS = 60

# typed in four short lines so it reads easily
LINES = ["Set me up for Sunday's open house", "at 27 Fernwood Hollow Ct, Germantown,", "and follow up with everyone", "from last week."]
TYPE_START, TYPE_END = 6.0, 11.2


def typing(text, b0, b1, seed):
    rnd = random.Random(seed); gaps = []
    for i, ch in enumerate(text):
        g = rnd.uniform(0.6, 1.3)
        if ch == "\n": g *= 2.6               # tiny pause at each line break
        elif i and text[i - 1] in " ,'": g *= 1.25
        gaps.append(g)
    tot, t, out = sum(gaps), b0, []
    for g in gaps: out.append(round(t, 4)); t += g / tot * (b1 - b0)
    return out


PROMPT = "\n".join(LINES)
timeline = {
    "bpm": BPM, "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_BEATS, "duration": TOTAL_BEATS * BEAT,
    "snap": 12, "drop": 28, "logo": 40,
    "prompt": PROMPT, "keyBeats": typing(PROMPT, TYPE_START, TYPE_END, 9),
    "emailType": [20.3, 21.8],
    "duck": [4.0, 4.15, 4.55, 5.0],          # half-beat of silence on the white
    "sfx": [
        [0.0, "ping"], [0.5, "buzz"], [1.0, "ping"], [1.5, "ping"], [2.0, "buzz"], [2.25, "ping"], [2.5, "ping"], [2.75, "buzz"],
        [3.0, "ping"], [3.25, "ping"], [3.5, "ping"], [3.75, "ping"],
        [4.0, "freeze"],
        [11.5, "send"],
        [12.0, "snap"], [13.0, "snap"], [14.0, "snap"], [15.0, "snap"], [15.5, "snap_last"],
        [16.0, "through"], [16.5, "tick"], [17.0, "tick"], [17.5, "tick"],
        [18.0, "through"], [18.5, "swish"], [19.0, "swish"],
        [20.0, "through"],
        [22.0, "through"], [22.5, "pop"], [23.0, "pop"], [23.5, "pop"],
        [24.0, "through"], [24.5, "thock"], [25.5, "tick"], [26.0, "tick"], [26.5, "tick"],
        [27.0, "freeze"],
        [28.0, "tap"], [28.0, "chime_e"], [28.0, "bloom"],
        [29.0, "tap"], [29.0, "chime_g"],
        [30.0, "tap"], [30.0, "chime_b"],
        [31.0, "tap"], [31.0, "chime_e_hi"],
        [32.0, "tap"], [32.0, "chime_b_hi"], [32.0, "sparkle"],
        [34.0, "whip"], [35.0, "whip"], [36.0, "whip"], [37.0, "whip"],
        [38.0, "swell"],
        [40.0, "boom"], [40.0, "sparkle"],
        [42.0, "chime_e"],
        [46.0, "tick"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f | video %.4f s | snap %.4f s | drop %.4f s | logo %.4f s" % (SONG_START, SONG_START + TOTAL_BEATS * BEAT, TOTAL_BEATS * BEAT, 12 * BEAT, 28 * BEAT, 40 * BEAT))

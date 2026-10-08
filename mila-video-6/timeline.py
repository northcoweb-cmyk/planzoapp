"""Video #6 "Out of Office" - single source of truth.
b = one beat of "Could Be Wrong" (86.0 BPM, 0.6977 s). seconds = b * BEAT.
Read by scene.js (picture) and build_audio.py (sound).
"""
import json, random

BEAT = 0.697700             # grid fitted to the onsets over 0:44-1:44
PHASE = 0.0449              # song time of grid beat 0
START_BEAT = 52             # 0:36.325, a bar line in the hi-hat build; the drop (0:44.70) is song beat 64 = video b12
TOTAL_B = 28                # 7 bars = 19.536 s, the loop restarts on a bar line
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

PROMPT = "I'm off till Monday.\nKeep everything moving."
TYPE0, TYPE1 = 6.6, 10.2


def typing(text, b0, b1, seed):
    rnd = random.Random(seed); gaps = []
    for i, ch in enumerate(text):
        g = rnd.uniform(0.6, 1.3)
        if ch == "\n": g *= 2.6
        elif i and text[i - 1] in " ,.'": g *= 1.3
        gaps.append(g)
    tot, t, out = sum(gaps), b0, []
    for g in gaps: out.append(round(t, 4)); t += g / tot * (b1 - b0)
    return out


# calendar events that pile on during the build: [day 0-6, start hour, hours, label, tone, drop beat]
rnd = random.Random(6)
LABELS = ["Showing", "Showing", "Showing", "Inspection", "Call back", "Listing photos", "Open house prep", "Buyer consult", "Appraisal",
          "Closing", "Follow-ups", "Showing", "Offer review", "Lender call", "Walkthrough", "Seller update", "Showing", "Price review"]
EVENTS = []
pre = 12                                            # already on the calendar at frame 0
for i in range(46):
    d, h = rnd.randrange(7), rnd.choice(range(8, 19))
    dur = rnd.choice([1, 1, 1, 1.5, 2])
    at = -1 if i < pre else round(0.25 + 5.3 * ((i - pre) / (46 - pre)) ** 0.75, 3)
    EVENTS.append([d, h, dur, rnd.choice(LABELS), rnd.randrange(3), at])

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT,
    "freeze": 6, "drop": 12, "logo": 24, "loopTail": [27, 28],
    "prompt": PROMPT, "keyBeats": typing(PROMPT, TYPE0, TYPE1, 6), "events": EVENTS,
    "sfx": [
        *[[e[5], "drop"] for e in EVENTS if e[5] >= 0],
        [1.0, "ding"], [2.5, "ding"], [3.5, "ding"], [4.25, "ding"], [4.75, "ding"], [5.25, "ding"], [5.5, "err"],
        [6.0, "freeze"], [6.1, "air"],
        [10.8, "send"], [11.0, "suck"],
        [12.0, "boom"], [12.0, "bloom"], [12.0, "sparkle"],
        [13.25, "toggle"], [13.25, "chime_e"],
        [14.0, "card"], [14.0, "chime_b"], [15.5, "card"], [15.5, "chime_b"], [17.0, "card"], [17.0, "chime_b"], [18.5, "card"], [18.5, "chime_b"],
        [19.5, "swish"],
        [20.0, "tap"], [20.0, "chime_e"], [20.25, "chime_g"], [20.5, "chime_b"], [20.75, "chime_e_hi"], [20.75, "sparkle"],
        [21.5, "through"], [22.0, "swish"], [22.5, "swish"], [23.0, "swish"], [23.5, "swish"],
        [24.0, "boom"], [24.0, "sparkle"], [25.5, "chime_b"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f | video %.4f s | freeze %.3f | drop %.3f | logo %.3f"
      % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, 6 * BEAT, 12 * BEAT, 24 * BEAT))

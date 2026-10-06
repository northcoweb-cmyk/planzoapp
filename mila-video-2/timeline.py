"""Video #2 ("A NYC agent's day, handled") - single source of truth for every cue.

Read by index.html/scene.js (picture) and build_audio.py (sound). Times are in
video beats (b); seconds = b * BEAT.
"""
import json, random

# --- Song analysis: "Let's Do It" (see README) ---------------------------------
BPM = 152.02735668968282
BEAT = 60.0 / BPM                  # 0.39467 s
GRID_PHASE = 0.1409456817848936    # song time of grid beat 0 (a downbeat)
START_INDEX = 0                    # window starts on the first downbeat
DROP_INDEX = 32                    # 12.770 s, the only build -> drop in the song
TOTAL_BEATS = 64                   # 16 bars = 25.259 s
SONG_START = GRID_PHASE + BEAT * START_INDEX
FPS = 60

PROMPT = "Set me up for 245 W 19th St, New York. Showing at 3."
TYPE_START, TYPE_END = 1.5, 5.6


def human_typing(text, b0, b1, seed):
    rnd = random.Random(seed)
    gaps = []
    for i, _ in enumerate(text):
        g = rnd.uniform(0.6, 1.4)
        if i and text[i - 1] in " ,.":
            g *= 1.4
        gaps.append(g)
    total, t, out = sum(gaps), b0, []
    for g in gaps:
        out.append(round(t, 4)); t += g / total * (b1 - b0)
    return out


timeline = {
    "bpm": BPM, "beat": BEAT, "fps": FPS,
    "songStart": SONG_START, "totalBeats": TOTAL_BEATS, "duration": TOTAL_BEATS * BEAT,
    "drop": DROP_INDEX - START_INDEX,
    "prompt": PROMPT,
    "keyBeats": human_typing(PROMPT, TYPE_START, TYPE_END, 3),
    "emailType": [16.3, 18.4],
    # low-pass "calm" on b48-56 with a riser into the logo downbeat (b56)
    "filter": {"down": [48.0, 48.75], "riseStart": 52.0, "open": 56.0, "cutoffLow": 420, "cutoffRise": 2600},
    # clock jumps (beat, label) - every jump is on a cut
    "clock": [[0, "7:42 AM"], [6, "7:48 AM"], [8, "8:30 AM"], [12, "10:15 AM"], [16, "11:40 AM"], [19, "12:40 PM"],
              [22, "1:30 PM"], [25, "3:00 PM"], [28, "4:30 PM"], [31, "5:58 PM"], [32, "6:05 PM"], [33, "6:40 PM"],
              [34, "7:10 PM"], [35, "7:30 PM"], [36, "7:52 PM"], [40, "8:40 PM"], [44, "9:15 PM"]],
    "sfx": [
        [0.0, "bloom"],
        [6.0, "send"], [6.0, "slats"],
        [7.0, "pop"],
        [8.0, "whoosh_soft"],
        [9.0, "tick"], [10.0, "tick"], [11.0, "tick"],
        [12.0, "split"],
        [13.0, "swish"], [14.0, "swish"], [15.0, "swish"],
        [16.0, "whoosh_down"], [19.0, "floor"], [22.0, "floor"], [25.0, "floor"], [28.0, "floor"],
        [18.4, "tick"], [20.0, "pop"], [20.5, "pop"], [21.0, "pop"],
        [23.5, "tick"], [26.0, "tick"], [29.0, "tick"], [29.5, "tick"], [30.0, "tick"],
        [31.0, "whoosh_soft"],
        [32.0, "tap"], [32.0, "chime_f"], [32.0, "sweep_night"],
        [33.0, "tap"], [33.0, "chime_a"],
        [34.0, "tap"], [34.0, "chime_c"],
        [35.0, "tap"], [35.0, "chime_f_hi"], [35.5, "doorbell"],
        [36.0, "taxi"],
        [38.0, "tick"], [38.0, "chime_c"],
        [40.0, "cube"],
        [44.0, "whoosh_soft"],
        [45.0, "tick"], [45.5, "tick"], [46.0, "tick"], [47.0, "chime_a"],
        [52.0, "riser"],
        [56.0, "boom"], [56.0, "sparkle"],
        [58.0, "chime_f"],
    ],
}

with open("timeline.json", "w") as f:
    json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f s | video %.4f s | drop at video %.4f s | logo at %.4f s"
      % (SONG_START, SONG_START + TOTAL_BEATS * BEAT, TOTAL_BEATS * BEAT, 32 * BEAT, 56 * BEAT))

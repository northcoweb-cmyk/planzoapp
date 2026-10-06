"""Generate timeline.json - the single source of truth for every cue.

The video (index.html) and the audio mix (build_audio.py) both read this file,
so a cue can never drift between picture and sound. All cue times are in
video beats (b); seconds = b * BEAT.
"""
import json, random

# --- Song analysis (Desire.mp3, see README "Song analysis") ---------------
BPM = 136.03485143926838
BEAT = 60.0 / BPM                    # 0.44106 s
GRID_PHASE = 4.432929750846893       # song time of grid beat #10 (first full-band beat)
DROP_INDEX = 279                     # grid beat of drop 2 (123.079 s)
LEAD_IN_BEATS = 8                    # 2 bars of build before the drop
SONG_START = GRID_PHASE + BEAT * (DROP_INDEX - LEAD_IN_BEATS - 10)
TOTAL_BEATS = 46                     # 11.5 bars = 20.289 s
FPS = 60

# --- Typing: "Set me up for my open house ..." ------------------------------
PROMPT = "Set me up for my open house at 26110 Pacific Coast Hwy, Malibu."
TYPE_START, TYPE_END = 1.75, 6.5     # beats


def human_typing(text, b0, b1, seed):
    rnd = random.Random(seed)
    gaps = []
    for i, ch in enumerate(text):
        g = rnd.uniform(0.65, 1.35)
        if i and text[i - 1] in " ,":
            g *= 1.35                # tiny hesitation after a space/comma
        gaps.append(g)
    total = sum(gaps)
    t, out = b0, []
    for g in gaps:
        out.append(round(t, 4))
        t += g / total * (b1 - b0)
    return out


timeline = {
    "bpm": BPM,
    "beat": BEAT,
    "fps": FPS,
    "songStart": SONG_START,
    "totalBeats": TOTAL_BEATS,
    "duration": TOTAL_BEATS * BEAT,
    "prompt": PROMPT,
    "keyBeats": human_typing(PROMPT, TYPE_START, TYPE_END, 7),
    # Email body types at high speed between these beats
    "emailType": [20.35, 22.35],
    # SFX cue sheet (beats). Kinds are synthesised in build_audio.py.
    "sfx": [
        [0.5, "whoosh_soft"],
        [7.0, "tap"],
        [7.55, "riser"],
        [8.0, "whoosh_big"],
        [10.0, "pop"],
        [11.0, "whoosh_soft"],
        [12.5, "tick"], [13.0, "tick"], [13.5, "tick"], [14.0, "tick"],
        [15.0, "chime_d"],
        [16.0, "whip"],
        [17.0, "swish"], [18.0, "swish"], [19.0, "swish"],
        [20.0, "whoosh_soft"],
        [22.75, "tap"],
        [23.0, "whip"],
        [23.0, "pop"], [23.75, "pop"], [24.5, "pop"],
        [25.0, "tick"],
        [26.0, "whoosh_soft"],
        [26.5, "tap"], [26.5, "chime_g"],
        [27.0, "tap"], [27.0, "chime_bb"],
        [27.5, "tap"], [27.5, "chime_d"],
        [28.0, "tap"], [28.0, "chime_g_hi"], [28.0, "sparkle"],
        [30.0, "whip"], [30.0, "thock"],
        [31.0, "tick"], [31.5, "tick"], [32.0, "tick"], [32.5, "tick"],
        [33.0, "whip"],
        [35.0, "pop"],
        [36.0, "whoosh_soft"],
        [36.5, "tick"], [37.0, "tick"], [37.5, "tick"],
        [38.5, "tick"], [39.0, "tick"], [39.25, "tick"],
        [38.0, "swell"],
        [40.0, "boom"], [40.0, "sparkle"],
        [42.0, "chime_g"],
    ],
}

with open("timeline.json", "w") as f:
    json.dump(timeline, f, indent=1)
print("song window %.4f -> %.4f s, video %.4f s, drop at video %.4f s"
      % (SONG_START, SONG_START + TOTAL_BEATS * BEAT, TOTAL_BEATS * BEAT, LEAD_IN_BEATS * BEAT))

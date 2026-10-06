"""Video #3 "Contract to Keys" (Texas) - single source of truth for every cue.
Times are video beats (b); seconds = b * BEAT. Read by scene.js and build_audio.py.
"""
import json

BPM = 60.0 / 0.4410859271367018      # 136.03
BEAT = 0.4410859271367018
GRID_PHASE = 0.12931972789115662     # song time of grid beat 0 (a downbeat)
START_INDEX = 296                    # 2:10.693, a downbeat
DROP_INDEX = 320                     # 2:21.277, after the one-beat bass drop-out on 319
TOTAL_BEATS = 48                     # 12 bars = 21.172 s
SONG_START = GRID_PHASE + BEAT * START_INDEX
FPS = 60

timeline = {
    "bpm": BPM, "beat": BEAT, "fps": FPS, "songStart": SONG_START,
    "totalBeats": TOTAL_BEATS, "duration": TOTAL_BEATS * BEAT, "drop": DROP_INDEX - START_INDEX,
    "followUp": "Marcus, ready to write an offer on Bluebonnet?",
    "followType": [14.1, 15.2],
    "sfx": [
        [0.0, "kick"], [0.0, "buzz"], [1.0, "buzz"],
        [2.0, "stamp"],
        [4.0, "through"], [5.0, "tick"],
        [6.0, "roll"], [7.0, "lock"], [7.0, "flap"], [7.5, "flap"],
        [8.0, "whip"],
        [9.0, "tick"], [10.0, "tick"], [10.5, "tick"], [11.0, "tap"], [11.25, "send"],
        [12.0, "stamp"], [12.0, "burn"],
        [14.0, "through"], [15.0, "whip"], [16.0, "through"], [17.0, "whip"],
        [18.0, "tick"], [18.5, "tick"], [19.0, "tick"],
        [20.0, "whip"], [21.0, "whip"], [22.0, "whip"],
        [22.5, "riser"],
        [23.0, "burn"],
        [24.0, "stamp_big"], [24.0, "flap"],
        [25.0, "tick"], [25.5, "tick"], [26.0, "tick"], [26.5, "tick"],
        [26.0, "flap"], [27.0, "flap"], [28.0, "flap"], [29.0, "flap"],
        [30.0, "through"], [30.0, "keys"],
        [31.5, "tap"], [31.5, "chime_g"],
        [32.0, "stamp_big"], [32.0, "flash"],
        [36.0, "stamp"],
        [38.0, "burn_long"],
        [40.0, "boom"], [40.0, "chime_d"],
        [42.0, "chime_g_hi"],
    ],
}
with open("timeline.json", "w") as f:
    json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f | video %.4f s | drop at %.4f s | logo at %.4f s" % (SONG_START, SONG_START + TOTAL_BEATS * BEAT, TOTAL_BEATS * BEAT, 24 * BEAT, 40 * BEAT))

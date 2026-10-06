"""East Coast Hockey - single source of truth.
The music is composed for this video (compose.py), so the beat grid is exact by construction.
Times are beats (b); seconds = b * BEAT.
"""
import json

BPM = 140.0
BEAT = 60.0 / BPM          # 0.428571 s
TOTAL_BEATS = 48           # 20.571 s
FPS = 60

timeline = {
    "bpm": BPM, "beat": BEAT, "fps": FPS, "totalBeats": TOTAL_BEATS, "duration": TOTAL_BEATS * BEAT,
    # song form (compose.py builds the music to this)
    "sections": {"hook": [0, 2], "build": [2, 8], "gap": [7.75, 8], "dropA": [8, 24], "fill": [23, 24], "dropB": [24, 40], "outro": [40, 48]},
    "hits": {"puck": 0, "dropA": 8, "slap": 14, "stop": 23.5, "horn1": 24, "dropB": 24, "logo": 40, "horn2": 40},
}
with open("timeline.json", "w") as f:
    json.dump(timeline, f, indent=1)
print("duration %.3f s | drop A %.3f s | drop B (skates) %.3f s | logo %.3f s" % (TOTAL_BEATS * BEAT, 8 * BEAT, 24 * BEAT, 40 * BEAT))

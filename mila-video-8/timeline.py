"""Video #8 "Speedrun" (retro 8-bit) - single source of truth.
b = one beat of "How Deep Is Your Love (UK House)" at 128 BPM (0.46875 s). seconds = b * BEAT.
Grid anchored on the drop's first kick (0:32.065); tempo measured drop-to-drop = 128.0 BPM.
"""
import json

BEAT = 60 / 128
DROP_SONG = 32.065           # first kick of the drop
DROP_B = 12                  # the drop lands on video beat 12 = "GO!"
TOTAL_B = 40                 # 10 bars = 18.75 s
SONG_START = DROP_SONG - DROP_B * BEAT       # 0:26.440, a bar line in the pre-drop groove
FPS = 60

SPLITS = [  # [label, end beat] - the run starts on GO (b12); each split = 3 beats
    ["LISTING COPY", 15], ["PHOTOS", 18], ["IG CAROUSEL", 21], ["BUYER EMAIL", 24], ["OPEN HOUSE", 27], ["FOLLOW-UPS", 30]]
CONNECTORS = ["CALENDAR", "EMAIL", "CRM", "MLS", "SOCIAL", "TEXTS"]
CHECK_B = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0]

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT,
    "go": DROP_B, "splits": SPLITS, "connectors": CONNECTORS, "checkBeats": CHECK_B,
    "record": 30, "approve": 32, "board": 33.5, "logo": 36, "loopTail": [39.1, 40],
    "sfx": [
        [2.0, "blip"], [3.5, "coin"], [4.0, "select"],
        *[[c, "check%d" % i] for i, c in enumerate(CHECK_B)], [7.5, "allset"],
        [8.0, "ready"], [9.0, "beep"], [10.0, "beep"], [11.0, "beep"], [12.0, "go"], [12.0, "boom"],
        *[[s[1], "split"] for s in SPLITS[:-1]], [30.0, "record"], [30.0, "boom"],
        *[[30.25 + i * 0.125, "coin"] for i in range(6)],
        [31.75, "blip"], [32.0, "approve"], [33.5, "select"], [34.0, "blip"], [34.5, "blip"],
        [36.0, "boom"], [36.0, "coin"], [37.0, "blip"], [37.5, "blip"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1)
print("song %.4f -> %.4f | video %.4f s | GO %.3f | final split %.3f (run time %.2f s) | logo %.3f"
      % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT, 30 * BEAT, (30 - DROP_B) * BEAT, 36 * BEAT))

"""TikTok #1 "Stop sending this text" — 18 s, 1080x1920, original motion graphics, SFX only (no music). Times in seconds."""
import json
D = 18.0
tl = {"beat": 1.0, "fps": 60, "duration": D, "totalBeats": D,
      "sfx": [[2.2, "whip"], *[[2.35 + i * 0.14, "pop"] for i in range(7)], [5.0, "whip"], [5.6, "pop"], *[[7.2 + i * 0.55, "scribble"] for i in range(3)],
              [10.0, "whip"], *[[10.5 + i * 0.09, "tap"] for i in range(16)], [12.2, "send"], [12.45, "pop"], [14.0, "whip"], [16.0, "pop"], [17.85, "whip"]]}
json.dump(tl, open("timeline.json", "w"), indent=1)

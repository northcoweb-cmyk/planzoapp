"""Video #15 "Pay Attention" - single source of truth. Times are SECONDS (this beat is a swung hip-hop edit, so cuts are
snapped to the instrumental's real kick/snare hits instead of a rigid grid).
Audio: the instrumental of the reference edit, separated with UVR MDX-Net Inst HQ3 (tools/mdx.py); the original speech is gone.
Grid fit over the drop: 134.2 BPM (0.44706 s). Structure of the edit:
  0-7.3 intro (the new Mila voice-over sits here) · 7.306 DROP · 19.6 the bass drops out · 22.33 final hit · rings to the end.
"""
import json, numpy as np, soundfile as sf

BEAT = 0.44706
DROP = 7.306
BREAK = 19.6
HIT = 22.329
DUR = 25.5
FPS = 60
# onsets measured on the instrumental (low-passed kicks and high-passed snares/hats)
KICKS = [7.306, 7.623, 7.85, 8.057, 8.308, 8.647, 8.855, 9.094, 9.414, 9.636, 9.985, 10.435, 10.881, 11.193, 11.421, 11.772, 12.217, 12.427, 12.664,
         12.976, 13.207, 13.557, 14.007, 14.453, 14.766, 14.992, 15.205, 15.438, 15.789, 15.993, 16.237, 16.553, 16.779, 16.982, 17.226, 17.578,
         18.024, 18.338, 18.564, 18.915, 19.384, 19.593]
HATS = [7.3, 7.454, 7.718, 8.051, 8.39, 8.552, 8.727, 8.879, 9.054, 9.211, 9.508, 9.666, 9.816, 9.969, 10.121, 10.346, 10.512, 10.699, 10.864,
        11.029, 11.187, 11.347, 11.498, 11.725, 11.959, 12.145, 12.299, 12.452, 12.629, 12.78, 13.076, 13.232, 13.407, 13.745, 13.914, 14.084,
        14.269, 14.433, 14.59, 14.77, 15.038, 15.194, 15.528, 15.698, 15.869, 16.052, 16.219, 16.372, 16.649, 16.819, 16.979, 17.313, 17.468,
        17.655, 17.81, 17.986, 18.154, 18.305, 18.469, 18.62, 19.127, 19.281, 19.464]
ALL = np.array(sorted(KICKS + HATS))
def snap(t, win=0.06):
    d = np.abs(ALL - t); i = d.argmin(); return round(float(ALL[i]), 3) if d[i] < win else round(t, 3)
def beat(k): return snap(DROP + k * BEAT)          # k beats after the drop, snapped to the nearest real hit

# the Mila voice-over (am_fenrir), placed in the original speech's slots
VO = [[0.15, "p0", "And I'll tell you what.", "line"], [1.8, "p1", "Every agent needs to start paying attention,", "line"],
      [4.75, "p2", "because there's something going on", "words"], [6.1, "p3", "in real estate.", "words"], [19.9, "p4", "Her name's Mila.", "words"]]
INTRO = [[0.0, "cliff_sunset"], [1.8, "nassau_living"], [3.35, "orb"], [4.75, "palm_estate"], [6.1, "type"]]
# the drop: [beat, kind, payload]
DROPSEQ = [
    [0, "slam", ["LISTINGS.", "cliff_pool"]], [1, "ui", "copy"], [2, "slam", ["WRITTEN.", "nassau_dining"]],
    [3, "slam", ["DMs.", "chelsea_living"]], [4, "ui", "dms"], [5, "slam", ["ANSWERED.", "palm_estate"]],
    [6, "slam", ["SHOWINGS.", "conservatory"]], [7, "ui", "cal"], [8, "slam", ["BOOKED.", "living_room"]],
    [9, "slam", ["FOLLOW-UPS.", "village_kitchen"]], [10, "ui", "follow"], [11, "slam", ["SENT.", "hero_waterfront"]],
    *[[12 + i * 0.5, "strobe", p] for i, p in enumerate(["malibu_pool", "nyc_night", "lauderdale_tiki", "austin_ext", "sarasota_bridgepool", "nyc_loft", "tampa_rockpool", "malibu_sunset"])],
    [16, "ui", "approve"], [17, "kick", "ONE TAP."], [18, "kick", "ZERO STRESS."], [19, "kick", "NO DAYS OFF."],
    *[[20 + i * 0.5, "mont", m] for i, m in enumerate([["cliff_pool", "MALIBU"], ["nassau_living", "MANHATTAN"], ["hero_waterfront", "NAPLES"], ["austin_ext", "AUSTIN"],
       ["palm_estate", "MALIBU"], ["nyc_night", "NEW YORK"], ["sarasota_bridgepool", "SARASOTA"], ["hill_ranch", "HILL COUNTRY"]])],
    [24, "slam", ["EVERY LISTING.", "cliff_sunset"]], [25, "slam", ["EVERY LEAD.", "conservatory"]], [26, "slam", ["EVERY DAY.", "malibu_firepit"]], [27, "dark", None],
]
def words(t0, name, text):                         # word-by-word caption cues, spread over the clip by length
    d = sf.info(f"assets/voice/{name}.wav").duration; ws = text.split(); w = [len(x) + 2 for x in ws]; tot = sum(w); out, t = [], t0
    for x, k in zip(ws, w): out.append([round(t, 3), x]); t += d * k / tot
    return round(d, 3), out
VO = [v + list(words(v[0], v[1], v[2])) for v in VO]
seq = [[beat(k), kind, pay] for k, kind, pay in DROPSEQ]
for i in range(len(seq)): seq[i].append(seq[i + 1][0] if i + 1 < len(seq) else BREAK)

timeline = {
    "fps": FPS, "duration": DUR, "beat": BEAT, "drop": DROP, "break": BREAK, "hit": HIT, "vo": VO, "intro": INTRO, "seq": seq,
    "kicks": KICKS, "approveTap": snap(DROP + 16.5 * BEAT), "loopTail": [24.7, DUR],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1)
print(f"{len(seq)} drop shots, first {seq[0][0]} last {seq[-1][0]} | approve tap {timeline['approveTap']} | dur {DUR}")

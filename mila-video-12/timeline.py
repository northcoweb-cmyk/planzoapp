"""Video #12 "Launch" - single source of truth.
b = one beat of "1997 (Extended Mix)" at 132.0 BPM (0.45445 s). seconds = b * BEAT.
Grid fitted to individual kick onsets in three sections (0:00-0:26, 0:29-1:24, 2:25-3:20): all 132.0 BPM, and the main drop's
first kick (2:25.48) sits exactly 256 beats after the 0:29.14 kick. The main drop is song beat 320 = video beat 16.
"""
import json, random

BEAT = 0.45445
PHASE = 0.0535
DROP_SONG_BEAT = 320         # 2:25.478
DROP_B = 16
TOTAL_B = 44                 # 11 bars = 20.0 s
START_BEAT = DROP_SONG_BEAT - DROP_B          # song beat 304 = 2:18.2, inside the build
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

TODO1 = [["Photos.", 2, "hero_waterfront"], ["Copy.", 3, "malibu_pool"], ["Instagram.", 4, "lauderdale_tiki"], ["Email blast.", 5, "nyc_night"],
         ["Open house.", 6, "sarasota_bridgepool"], ["Showings.", 7, "austin_ext"], ["Follow-ups.", 8, "malibu_sunset"]]
TODO2 = [[w, 9 + i * 0.5] for i, w in enumerate(["Flyers.", "Texts.", "Calendar.", "CRM.", "Feedback.", "Reminders."])]
STROBE = [[12 + i * 0.25, p] for i, p in enumerate(["tampa_rockpool", "nyc_loft", "hill_ranch", "beach_boardwalk", "malibu_firepit", "austin_int", "md_cabin", "malibu_hillside"])]
PROMPT = "Launch my new listing."
def typing(text, b0, b1, seed):
    rnd = random.Random(seed); gaps = [rnd.uniform(0.6, 1.3) * (1.3 if i and text[i - 1] == " " else 1) for i, _ in enumerate(text)]
    tot, t, out = sum(gaps), b0, []
    for g in gaps: out.append(round(t, 4)); t += g / tot * (b1 - b0)
    return out
MONTAGE = [[25 + i * 0.5, p, l] for i, (p, l) in enumerate([("malibu_sunset", "MALIBU · CA"), ("sarasota_bridgepool", "SARASOTA · FL"), ("nyc_night", "NEW YORK · NY"), ("austin_ext", "AUSTIN · TX"),
           ("lauderdale_tiki", "FT. LAUDERDALE · FL"), ("hill_ranch", "HILL COUNTRY · TX"), ("malibu_pool", "MALIBU · CA"), ("tampa_rockpool", "TAMPA · FL")])]
KICKER = [["Listed.", 29, "hero_waterfront"], ["Posted.", 30, "lauderdale_tiki"], ["Booked.", 31, "malibu_pool"], ["Followed up.", 32, "nyc_loft"]]

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
    "todo1": TODO1, "todo2": TODO2, "strobe": STROBE, "prompt": PROMPT, "keyBeats": typing(PROMPT, 14.45, 15.15, 12), "send": 15.25, "hang": 15.5,
    "shots": [16, 17, 18, 19, 20, 21, 22, 23, 24], "montage": MONTAGE, "kicker": KICKER, "launched": 33, "logo": 34.5, "loopTail": [43, 44],
    "sfx": [
        *[[w[1], "hit"] for w in TODO1], *[[w[1], "tick"] for w in TODO2], *[[s[0], "shutter"] for s in STROBE],
        [11.0, "riser"], [14.0, "air"], *[[0, "none"]][:0],
        [15.25, "send"], [16.0, "boom"], [16.0, "bloom"], [16.0, "sparkle"],
        [17.0, "whip"], [18.0, "whip"], *[[18 + i * 0.125, "shutter"] for i in range(9)], [19.0, "whip"], [20.0, "whip"], [21.0, "stamp"], [22.0, "whip"],
        *[[22 + i * 0.25, "pop"] for i in range(4)], [23.0, "whip"], *[[23.1 + i * 0.25, "pop"] for i in range(3)],
        [24.0, "whip"], [24.5, "tap"], [24.5, "chime_hi"], [24.5, "sparkle"],
        *[[m[0], "whip"] for m in MONTAGE], *[[k[1], "hit"] for k in KICKER],
        [33.0, "boom"], [33.0, "bloom"], [34.5, "chime"], [36.0, "chime"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1, ensure_ascii=False)
print("song %.4f -> %.4f | video %.4f s | DROP %.3f s | launched %.3f | logo %.3f" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT, 33 * BEAT, 34.5 * BEAT))

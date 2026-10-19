"""Video #17 "Worth the Wait" (launch delay) - single source of truth.
b = one beat of "Da Fonk (feat. Joni)" at 127.1 BPM (0.47207 s), local grid fitted around the drop and anchored on its first hit.
The big drop is song beat-time 166.300 s (2:46.30), out of the long breakdown; the song goes silent ~2 beats before it
(video b12-14) with two pickup hits (b14, b15). Video beat 0 = 16 beats before the drop, so the drop lands on video b16.
"""
import json
BPM = 127.1; BEAT = 60 / BPM; DROP_SONG = 166.300; DROP_B = 16; TOTAL_B = 44; FPS = 60
SONG_START = DROP_SONG - DROP_B * BEAT
WORDS = [["Smarter.", 8, "cliff_sunset"], ["Faster.", 9, "nassau_living"], ["Sharper.", 10, "malibu_pool"]]
STROBE = [[11 + i * 0.25, p] for i, p in enumerate(["palm_estate", "nyc_night", "sarasota_bridgepool", "conservatory"])]
FEATS = [17, 18, 19, 20, 21, 22, 23, 24]
MONTAGE = [[25 + i * 0.5, p, l] for i, (p, l) in enumerate([("cliff_pool", "MALIBU · CA"), ("nassau_living", "NEW YORK · NY"), ("hero_waterfront", "NAPLES · FL"),
           ("austin_ext", "AUSTIN · TX"), ("palm_estate", "MALIBU · CA"), ("chelsea_living", "NEW YORK · NY"), ("lauderdale_tiki", "FT. LAUDERDALE · FL"), ("cliff_sunset", "MALIBU · CA")])]
KICKER = [["Listings.", 29, "cliff_pool"], ["Leads.", 30, "nyc_loft"], ["Showings.", 31, "sarasota_bridgepool"], ["Handled.", 32, "conservatory"]]
tl = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
    "words": WORDS, "strobe": STROBE, "feats": FEATS, "montage": MONTAGE, "kicker": KICKER,
    "sorryB": 0, "notB": 2, "dateB": 4, "flipB": 5, "reasonB": 6, "hang1": 12, "hang2": 13, "pick1": 14, "pick2": 15, "worth": 33, "logo": 34.5, "loopTail": [42, 44],
    "sfx": [[2, "whip"], [4, "card"], [5, "flip"], [6, "whip"], *[[w[1], "hit"] for w in WORDS], *[[s[0], "shutter"] for s in STROBE], [12, "air"], [13.5, "riser"],
            [16, "boom"], [16, "bloom"], [16, "sparkle"], *[[b, "whip"] for b in FEATS], [18.05, "shutter"], [20.3, "pop"], [20.55, "pop"], [21.2, "chime"], [22.2, "pop"], [22.45, "pop"],
            [24.5, "tap"], [24.5, "chime_hi"], [24.5, "sparkle"], *[[m[0], "whip"] for m in MONTAGE], *[[k[1], "hit"] for k in KICKER],
            [33, "boom"], [33, "bloom"], [34.5, "chime"], [36, "chime"]],
}
json.dump(tl, open("timeline.json", "w"), indent=1, ensure_ascii=False)
print("song %.3f -> %.3f | %.2f s | drop %.3f s | logo %.3f s" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT, 34.5 * BEAT))

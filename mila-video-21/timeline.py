"""Video #21 "Mila is live." (launch day, 4:5 feed) - single source of truth.
b = one beat of "I Follow Rivers" (Lykke Li, The Magician remix, as in La Vie d'Adele) at 122.0 BPM (0.4918 s), A minor.
The cut is 2:20.016 -> 2:53.459 (song beats 284-352 on the 0.344 + k*B grid, which holds through the beatless breakdown).
  b0-7     the breakdown's pad, no drums                    -> the problem
  b7.12-11.72  the tom fill (onsets measured on the 40-200 Hz band) -> the countdown
  b13.0    "I follow..." - the chorus vocal enters (2:26.39)   -> MILA IS LIVE
  b28+     the tom groove (hits on k, k+1, k+1.75, k+2.5, k+3)  -> features cut on the hits
Vocal phrases restart every 8 beats (b13, 21, 29, ...); b68 sits in a phrase gap, so the loop seam is clean.
"""
import json
BEAT = 60 / 122; SONG_START = 140.016; TOTAL_B = 68; FPS = 60; REVEAL = 13
FILL = [7.12, 7.98, 8.65, 9.42, 10.02, 10.53, 11.27, 11.72]
GROOVE = sorted({round(k + d, 2) for k in range(29, 66, 4) for d in (0, 1, 1.75, 2.5, 3)} | {28.0})
PAINS = [[2, "Who was that Zillow lead again?", "LEADS"], [3, "Double-booked · Sat 1:00 PM", "CALENDAR"], [4, "Did I send Dana the comps?", "REMINDER"],
         [5, "Flyer copy due tonight", "LISTINGS"], [6, "23 follow-ups · not sent", "MESSAGES"]]
WORDS = [[7.12, "Leads.", "village_kitchen"], [7.98, "Showings.", "nassau_living"], [8.65, "Offers.", "palm_estate"], [9.42, "Posts.", "cliff_pool"], [10.02, "Follow-ups.", "hero_waterfront"]]
COUNT = [[10.53, "3"], [11.27, "2"], [11.72, "1"]]
ASK = "new lead from Zillow, Priya Shah, buyer, 600k, wants Bethesda. call her tmrw at 2"
STROBE = [[43.0, "Contacts.", "chelsea_living"], [43.5, "Calendar.", "conservatory"], [44.0, "Deals.", "palm_estate"], [44.5, "Posts.", "malibu_pool"],
          [45.0, None, None]]
MONT = [[45 + i * 0.5, p] for i, p in enumerate(["cliff_sunset", "nyc_loft", "sarasota_bridgepool", "austin_ext", "malibu_hillside", "village_kitchen", "hero_waterfront", "nyc_night"])]
tl = {"beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "reveal": REVEAL,
      "fill": FILL, "groove": GROOVE, "pains": PAINS, "words": WORDS, "count": COUNT, "ask": ASK, "askB": [17.05, 18.55], "send": 18.7,
      "strobe": STROBE, "mont": MONT, "end": 61, "loopTail": [66, 68], "hang": [12.15, 12.9],
      "sfx": [*[[p[0], "notif"] for p in PAINS], [6.6, "glitch"], *[[w[0], "whip"] for w in WORDS], *[[c[0], "tick"] for c in COUNT], *[[c[0], "hit"] for c in COUNT],
              [12.2, "air"], [13, "boom"], [13, "bloom"], [13, "sparkle"], [13.05, "chime_hi"], [15, "whip"],
              *[[17.05 + i * 0.25, "tap"] for i in range(6)], [18.7, "send"], [19.0, "chime"], [19.25, "pop"], [19.75, "pop"], [20.25, "pop"],
              [21, "whip"], [21.55, "error"], [22.2, "tap"], [22.45, "chime"], [23, "whip"], [23.15, "pop"], [23.3, "pop"], [24, "whip"], [24.45, "chime"],
              [25, "whip"], *[[25.25 + i * 0.25, "tick"] for i in range(6)], [26.8, "chime"], [27, "whip"], [27.3, "card"],
              [29, "whip"], [30, "whip"], [30.75, "whip"], [31.5, "chime"], [32, "whip"], [32.4, "pop"], [32.9, "stamp"], [33, "whip"], *[[33.3 + i * 0.2, "pop"] for i in range(5)],
              [35, "whip"], [35.3, "card"], [37, "whip"], *[[37.2 + i * 0.15, "tick"] for i in range(8)], [39, "whip"], *[[39.2 + i * 0.3, "pop"] for i in range(3)],
              [41, "whip"], [41.6, "chime"], *[[s[0], "whip"] for s in STROBE[:4]], *[[m[0], "shutter"] for m in MONT], [45, "hit"], [47, "hit"], [49, "whip"], [51, "tap"], [51, "chime_hi"], [51, "sparkle"],
              [53, "boom"], [53, "bloom"], *[[54 + i * 0.75, "pop"] for i in range(4)], [56.6, "stamp"], [57, "hit"], [59, "hit"], [63.4, "pop"], [61, "chime"], [62, "chime"]]}
json.dump(tl, open("timeline.json", "w"), indent=1, ensure_ascii=False)
print("song %.3f -> %.3f | %.2f s | reveal %.3f s" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, REVEAL * BEAT))

"""Video #19 "Your Day, Handled" - single source of truth.
b = one beat of "Good Girl" (Cloonee & Prospa ft. Tristan Henry) at 128.0 BPM (0.46875 s). A local grid fit on the kick band
after the drop puts the kicks on 76.196 + k*B; the drop's first kick is 1:15.727 (bass onset 1:15.703).
Before it: the song stops dead for a beat (drop-6 beats = video b10), then a quiet vocal breakdown, near-silence at drop-1 beat
(video b15) and a pickup. Video beat 0 = 16 beats before the drop, so the drop lands on video b16.
"""
import json
BEAT = 60 / 128; DROP_SONG = 75.727; DROP_B = 16; TOTAL_B = 44; FPS = 60
SONG_START = DROP_SONG - DROP_B * BEAT
NOTIFS = [[2.5, "Leads", "12 new leads · sorted overnight"], [3.0, "Showings", "3 showings · confirmed for today"], [3.5, "Mila", "Your morning brief is ready ☀"]]
BRIEF = [[4.25, "9:30", "Showing · 48 Coral Palm Way"], [4.75, "11:00", "Listing photos due · Sea Grape Ln"], [5.25, "2:00", "Buyer call · Maya Chen"], [5.75, "5:30", "Open house prep · Sunday"]]
HOURS = [[8, "7:00 AM", "village_kitchen"], [8.5, "8:00 AM", "nassau_dining"], [9, "9:00 AM", "cliff_pool"], [9.5, "10:00 AM", "palm_estate"]]
FEATS = [[17, "8:02 AM"], [18, "9:15 AM"], [19, "10:30 AM"], [20, "11:45 AM"], [21, "1:00 PM"], [22, "2:30 PM"], [23, "4:00 PM"], [24, "6:00 PM"]]
MONTAGE = [[25 + i * 0.5, p, l] for i, (p, l) in enumerate([("cliff_pool", "8 AM · MALIBU"), ("nassau_living", "10 AM · NEW YORK"), ("hero_waterfront", "12 PM · NAPLES"),
           ("austin_ext", "2 PM · AUSTIN"), ("sarasota_bridgepool", "4 PM · SARASOTA"), ("chelsea_living", "6 PM · NEW YORK"), ("malibu_sunset", "7 PM · MALIBU"), ("nyc_night", "9 PM · NEW YORK")])]
KICKER = [["Morning.", 29, "village_kitchen"], ["Noon.", 30, "cliff_pool"], ["Night.", 31, "nyc_night"], ["Handled.", 32, "cliff_sunset"]]
tl = {"beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
      "notifs": NOTIFS, "brief": BRIEF, "hours": HOURS, "feats": FEATS, "montage": MONTAGE, "kicker": KICKER,
      "alarm": 1, "stop": 10, "day1": 11, "day2": 13, "ask": "Mila, run my day.", "askB": [14.1, 14.9], "send": 15.0, "hang": 15.5, "worth": 33, "logo": 34.5, "loopTail": [42, 44],
      "sfx": [[1, "chime"], [2, "whip"], *[[n[0], "notif"] for n in NOTIFS], [4, "whip"], *[[x[0], "pop"] for x in BRIEF], [6, "whip"], *[[h[0], "whip"] for h in HOURS], *[[h[0], "tick"] for h in HOURS],
              [10, "hit"], [11, "air"], [13, "whip"], [15.0, "send"], [16, "boom"], [16, "bloom"], [16, "sparkle"], *[[f[0], "whip"] for f in FEATS], *[[f[0] + 0.05, "tick"] for f in FEATS],
              [18.05, "shutter"], [20.3, "pop"], [20.55, "pop"], [21.3, "pop"], [21.55, "pop"], [22.2, "chime"], [23.2, "pop"], [23.45, "pop"], [24.5, "tap"], [24.5, "chime_hi"], [24.5, "sparkle"],
              *[[m[0], "whip"] for m in MONTAGE], *[[k[1], "hit"] for k in KICKER], [33, "boom"], [33, "bloom"], [34.5, "chime"], [36, "chime"]]}
json.dump(tl, open("timeline.json", "w"), indent=1, ensure_ascii=False)
print("song %.3f -> %.3f | %.2f s | drop %.3f s" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT))

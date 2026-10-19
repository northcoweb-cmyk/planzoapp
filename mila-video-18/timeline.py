"""Video #18 "DIY Agent" - single source of truth.
b = one beat of "Got Me Burnin'" at 128.00 BPM (0.46875 s). The grid search locks onto the off-beat hats (phase 0.242);
the kicks sit on 0.051 + k*B. The drop's first bass hit is 1:45.051 (the song drops identically at 0:30.05 and 3:00.05,
160 beats apart). Video beat 0 = 16 beats before the drop, so the drop lands on video b16. Vocals live only in the build.
"""
import json
BEAT = 60 / 128; DROP_SONG = 105.051; DROP_B = 16; TOTAL_B = 44; FPS = 60
SONG_START = DROP_SONG - DROP_B * BEAT
WIRES = [[2, "Gmail"], [2.5, "Calendar"], [3, "CRM"], [3.5, "MLS feed"]]
FAILS = [[4, "Gmail", "401 · Unauthorized", "OAuth token expired"], [5, "Calendar", "Webhook timed out", "504 after 30,000 ms"],
         [6, "CRM", "API key revoked", "Re-authenticate to continue"], [7, "MLS feed", "429 · Rate limit", "Retry in 3,600 s"]]
LOG = ["[03:07:12] agent.run() → connecting tools…", "[03:07:12] ✕ gmail.send  401 Unauthorized", "[03:07:13] retry 1/3…", "[03:07:15] ✕ calendar.sync  webhook timeout (30s)",
       "[03:07:16] ✕ crm.update  invalid_api_key", "[03:07:16] retry 2/3…", "[03:07:18] ✕ mls.fetch  429 Too Many Requests", "[03:07:19] ✕ followups.queue  undefined is not a function",
       "[03:07:19] retry 3/3…", "[03:07:21] ✕ agent crashed (exit code 1)", "[03:07:22] re-deploying…", "[03:07:24] ✕ gmail.send  401 Unauthorized"]
FEATS = [17, 18, 19, 20, 21, 22, 23, 24]
MONTAGE = [[25 + i * 0.5, p, l] for i, (p, l) in enumerate([("cliff_pool", "MALIBU · CA"), ("nassau_living", "NEW YORK · NY"), ("hero_waterfront", "NAPLES · FL"),
           ("austin_ext", "AUSTIN · TX"), ("palm_estate", "MALIBU · CA"), ("chelsea_living", "NEW YORK · NY"), ("lauderdale_tiki", "FT. LAUDERDALE · FL"), ("cliff_sunset", "MALIBU · CA")])]
KICKER = [["No setup.", 29, "cliff_pool"], ["No code.", 30, "nassau_living"], ["No 3 AM.", 31, "sarasota_bridgepool"], ["Just Mila.", 32, "conservatory"]]
tl = {"beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
      "wires": WIRES, "fails": FAILS, "log": LOG, "feats": FEATS, "montage": MONTAGE, "kicker": KICKER,
      "logB": 8, "lateB": 10, "glitch": [11, 12], "orB": 12, "skipB": 13, "ask": "Mila, handle my follow-ups.", "askB": [14.1, 15.0], "send": 15.2, "hang": 15.5,
      "worth": 33, "logo": 34.5, "loopTail": [42, 44],
      "sfx": [*[[w[0], "tick"] for w in WIRES], *[[f[0], "error"] for f in FAILS], *[[f[0], "hit"] for f in FAILS], [8, "whip"], *[[8 + i * 0.25, "tick"] for i in range(12)],
              *[[11 + i * 0.25, "glitch"] for i in range(4)], [12, "air"], [13, "whip"], [15.2, "send"], [16, "boom"], [16, "bloom"], [16, "sparkle"],
              *[[b, "whip"] for b in FEATS], [18.05, "shutter"], [20.3, "pop"], [20.55, "pop"], [21.2, "chime"], [22.2, "pop"], [22.45, "pop"], [24.5, "tap"], [24.5, "chime_hi"], [24.5, "sparkle"],
              *[[m[0], "whip"] for m in MONTAGE], *[[k[1], "hit"] for k in KICKER], [33, "boom"], [33, "bloom"], [34.5, "chime"], [36, "chime"]]}
json.dump(tl, open("timeline.json", "w"), indent=1, ensure_ascii=False)
print("song %.3f -> %.3f | %.2f s | drop %.3f s" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT))

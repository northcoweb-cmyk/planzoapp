"""Video #16 "On the Calendar" - single source of truth.
b = one beat of "90s Legacy" at 130.0 BPM (0.461538 s). seconds = b * BEAT.
Grid: onset-strength search over the whole song gives 130.00 BPM, phase 0.028 s. The first drop's kick lands on song beat 66 (30.49 s);
the main drop is song beat 258 (1:59.10), exactly 192 beats later, after ~1.5 s of near-silence (254.5-257.5).
Video beat 0 = song beat 242 (inside the breakdown), so the main drop lands on video beat 16.
"""
import json, random
BEAT = 60 / 130
PHASE = 0.028
DROP_SONG_BEAT = 258
DROP_B = 16
TOTAL_B = 44                      # 11 bars = 20.3 s
SONG_START = PHASE + BEAT * (DROP_SONG_BEAT - DROP_B)
FPS = 60
# the build: scheduling messages pile up, one per beat (all fictional)
MSGS = [[0, "Jordan Ellis", "Can we see 48 Coral Palm Saturday at 2?", "SAT · 2:00 PM", "Showing", "hero_waterfront"],
        [3, "Inspector · Gulf Home Co.", "Inspection confirmed Tue 10:30 AM", "TUE · 10:30 AM", "Inspection", "sarasota_bridgepool"],
        [4, "Lender · Priya Shah", "Appraisal booked Wednesday 1 PM", "WED · 1:00 PM", "Appraisal", "tampa_rockpool"],
        [5, "Title company", "Closing moved to Friday 4:00", "FRI · 4:00 PM", "Closing", "lauderdale_tiki"],
        [6, "Marcus Lee", "Open house Sunday 1–4 still on?", "SUN · 1–4 PM", "Open house", "malibu_pool"],
        [7, "Dana & Mark", "Final walkthrough Thu 9 AM works!", "THU · 9:00 AM", "Walkthrough", "cliff_pool"]]
PROMPT = "Put all of these on my calendar."
def typing(text, b0, b1, seed):
    rnd = random.Random(seed); gaps = [rnd.uniform(0.6, 1.3) * (1.3 if i and text[i - 1] == " " else 1) for i, _ in enumerate(text)]
    tot, t, out = sum(gaps), b0, []
    for g in gaps: out.append(round(t, 4)); t += g / tot * (b1 - b0)
    return out
# the drop: each event lands in the week, one per beat, alternating Google / Apple
EVENTS = [[17, "SAT", 14.0, 1.0, "Showing · 48 Coral Palm", "g"], [18, "TUE", 10.5, 1.5, "Inspection · Sea Grape Ln", "a"], [19, "WED", 13.0, 1.0, "Appraisal · Mangrove Bay", "g"],
          [20, "FRI", 16.0, 1.5, "Closing · Banyan Isle", "a"], [21, "SUN", 13.0, 3.0, "Open house · Coral Palm", "g"], [22, "THU", 9.0, 1.0, "Walkthrough · Seabreeze Ct", "a"]]
KICKER = [["Texted.", 28, "hero_waterfront"], ["Scheduled.", 29, "palm_estate"], ["Synced.", 30, "malibu_sunset"], ["Reminded.", 31, "nassau_living"]]
tl = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
    "msgs": MSGS, "prompt": PROMPT, "keyBeats": typing(PROMPT, 9.1, 10.6, 16), "send": 10.75, "parse": 11, "confirm": 13.5, "tap": 15.0, "hang": 15.0,
    "logos": 16, "events": EVENTS, "notifs": 24, "kicker": KICKER, "say": 32, "logo": 34, "loopTail": [42.5, 44],
    "sfx": [*[[m[0], "hit"] for m in MSGS[1:]], *[[m[0] + 0.02, "notif"] for m in MSGS[1:]], [7.0, "hit"], [7.0, "stamp"], [8.0, "whip"], *[[k, "tick"] for k in typing(PROMPT, 9.1, 10.6, 16)[::2]],
            [10.75, "send"], *[[11 + i * 0.25, "pop"] for i in range(6)], [12.5, "riser"], [13.5, "card"], [15.0, "tap"], [15.0, "chime_hi"], [15.25, "air"],
            [16.0, "boom"], [16.0, "bloom"], [16.0, "sparkle"], *[[e[0], "whip"] for e in EVENTS], *[[e[0] + 0.25, "check"] for e in EVENTS], *[[e[0] + 0.25, "pop"] for e in EVENTS],
            [24.0, "whip"], *[[24.25 + i * 0.5, "notif"] for i in range(4)], *[[k[1], "whip"] for k in KICKER], *[[k[1], "hit"] for k in KICKER],
            [32.0, "hit"], [33.0, "boom"], [33.0, "bloom"], [34.0, "chime"], [35.5, "chime"]],
}
json.dump(tl, open("timeline.json", "w"), indent=1, ensure_ascii=False)
print("song %.3f -> %.3f | video %.3f s | DROP %.3f s | logo %.3f s" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT, 34 * BEAT))

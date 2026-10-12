"""Video #10 "Departures" - single source of truth.
b = one beat of "It Goes Like Nanana" at 130 BPM (0.46150 s). seconds = b * BEAT.
Grid fitted to the onsets over 0:00-1:56 (two sections agree); the kick build starts 2:18.6 and the full drop lands on
song beat 304 (2:20.44), a 16-bar line.
"""
import json, random

BEAT = 0.46150
PHASE = 0.1400
DROP_SONG_BEAT = 304         # 2:20.436
DROP_B = 16
TOTAL_B = 40                 # 10 bars = 18.46 s
START_BEAT = DROP_SONG_BEAT - DROP_B          # 288 = 2:13.05, in the melodic breakdown
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

# board rows: time(5) flight(5) destination(15) status(10)
def row(time, flight, dest, status): return f"{time:<5} {flight:<5} {dest:<15} {status:<10}"
ROWS = [["09:02", "LD101", "LEAD · JORDAN"], ["11:00", "SH204", "SHOWING · SAT"], ["13:00", "OH310", "OPEN HOUSE PREP"],
        ["14:15", "EM412", "BUYER EMAIL ×31"], ["16:30", "FU518", "FOLLOW-UPS ×9"], ["18:00", "IG622", "LISTING POST"], ["07:40", "RB777", "RACHEL → NASSAU"]]
STATUS0 = ["DELAYED", "DELAYED", "NOT READY", "DELAYED", "DELAYED", "DELAYED", "BOARDING"]
# status changes: [beat, row, new status]
CHANGES = [[2, 3, "CANCELLED"], [4, 0, "DELAYED 2H"], [6, 4, "CANCELLED"], [8, 6, "FINAL CALL"], [10, 1, "CANCELLED"],
           *[[16 + i * 0.125, i, "ON TIME"] for i in range(6)], [16.75, 6, "DEPARTED"],
           *[[30 + i * 0.125, i, "READY ✓"] for i in range(6)], [30.75, 6, "ARRIVED"],
           *[[31 + i * 0.125, i, "DONE ✓"] for i in range(6)]]
HEADER = [[-1, "DEPARTURES"], [16, "ALL ON TIME"], [30, "ARRIVALS"]]
NOTIFS = [["Jordan Ellis", "is 48 Coral Palm still available??", -2], ["Seller · Kim", "any feedback from Saturday?", -1],
          ["Lender", "need the docs by 5 today", 1], ["3 new leads", "Naples · Sarasota · Tampa", 3], ["Priya Shah", "can we see it this weekend?", 5],
          ["Title company", "signature needed", 7], ["Marcus Lee", "what's the HOA?", 9]]
PROMPT = "Flying out. Cover everything till Monday."
TYPE0, TYPE1 = 12.2, 14.4

def typing(text, b0, b1, seed):
    rnd = random.Random(seed); gaps = []
    for i, ch in enumerate(text):
        g = rnd.uniform(0.6, 1.3)
        if i and text[i - 1] in " .,": g *= 1.3
        gaps.append(g)
    tot, t, out = sum(gaps), b0, []
    for g in gaps: out.append(round(t, 4)); t += g / tot * (b1 - b0)
    return out

CARDS = [  # in the air: [beat, title, detail, icon]
    [18, "Lead reply drafted", "Jordan · 48 Coral Palm Way", "msg"], [20, "Showing booked", "Sat 11 AM · 1207 Sea Grape Ln", "cal"],
    [22, "Open house prepped", "Sun 1–4 · 48 Coral Palm Way", "photo"], [24, "Buyer email ready", "31 buyers · Naples", "mail"],
    [26, "9 follow-ups queued", "Everyone from Sunday", "users"], [28, "Listing post ready", "3 slides · Just listed", "heart"]]

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT,
    "drop": DROP_B, "rows": ROWS, "status0": STATUS0, "changes": CHANGES, "header": HEADER, "notifs": NOTIFS,
    "prompt": PROMPT, "keyBeats": typing(PROMPT, TYPE0, TYPE1, 10), "send": 14.75, "airplane": 15.25, "cards": CARDS,
    "map": [17.6, 29.6], "approve": 31, "line": 32, "logo": 35, "cta": [35.75, 36.25], "loopTail": [39, 40],
    "sfx": [
        [0.5, "pa"], [8.0, "pa"],
        *[[n[2], "notif"] for n in NOTIFS if n[2] >= 0],
        *[[c[0], "flaps_s"] for c in CHANGES if c[0] < 16],
        [14.75, "send"], [15.25, "toggle"], [15.25, "airplane"],
        [16.0, "boom"], [16.0, "flaps_l"], [16.0, "sparkle"],
        [17.6, "jet"],
        *[[c[0], "card"] for c in CARDS], *[[c[0] + 0.5, "chime"] for c in CARDS],
        [29.6, "land"], [30.0, "flaps_l"], [31.0, "tap"], [31.0, "flaps_l"], [31.0, "chime_hi"], [31.0, "sparkle"],
        [32.0, "through"], [35.0, "boom"], [35.75, "flaps_m"], [36.25, "flaps_m"], [37.0, "chime"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1, ensure_ascii=False)
print("song %.4f -> %.4f | video %.4f s | airplane %.3f | DROP %.3f | logo %.3f"
      % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, 15.25 * BEAT, DROP_B * BEAT, 35 * BEAT))

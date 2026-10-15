"""Mila "weekend" TikTok - single source of truth. b = one beat of "Real Love" at 128 BPM (0.46875 s).
Song beat 206 (1:36.61) is the main drop; video beat 0 = song beat 194, so the drop lands on b12 ("Mila sends them.").
Song beats 201.5-205.5 have no kick: that pre-drop riser is the follow-up avalanche (b7.5-11.5)."""
import json
BEAT = 60 / 128; PHASE = 0.045; DROP_SONG_BEAT = 206; DROP_B = 12; TOTAL_B = 24
SONG_START = PHASE + BEAT * (DROP_SONG_BEAT - DROP_B)
CHIPS = [[2.5, "SAT · 1–4 PM", "Open house"], [3.0, "SUN · 12–3 PM", "Open house"], [4.5, "SAT · 10:00 AM", "Showing"], [5.0, "SAT · 4:30 PM", "Showing"], [5.5, "SUN · 11:00 AM", "Showing"]]
# follow-ups pile in faster and faster: 1/2 beat, then 1/4, then 1/8
FU = [7.5 + 0.5 * i for i in range(4)] + [9.5 + 0.25 * i for i in range(6)] + [11.0 + 0.0625 * i for i in range(8)]
NOTES = ["Thanks for coming Saturday!", "Hi Jordan, following up on the open house", "Priya, want a second look?", "Feedback request: Sat 10:00 showing",
         "Marcus, the disclosures are ready", "Did you like the kitchen?", "Quick follow-up from Sunday", "Here are the comps you asked for",
         "Dana, still relocating in March?", "Thanks for touring!", "Following up on 412 Oak", "Can I send similar homes?",
         "Re: open house questions", "HOA docs attached", "Sunday showing feedback", "Checking in!", "Second showing?", "New listing you might like"]
SCREENS = []
# the open-house photos only flash: ~0.3 s cards between the hits (clean upper crops, nothing private in frame)
FLASH = [[1.0, "kitchen-setup"], [3.4, "dining-setup"], [5.9, "listing-laptop"], [6.6, "living-room"]]
# after the drop: a fast "all sent" photo run
RUN = [[16.0, "kitchen-setup", "Open house follow-ups"], [16.5, "dining-setup", "Showing feedback"], [17.0, "listing-laptop", "Second-look invites"], [17.5, "living-room", "Thank-you notes"]]
tl = {"beat": BEAT, "fps": 60, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
      "chips": CHIPS, "fu": [[t, NOTES[i % len(NOTES)]] for i, t in enumerate(FU)], "screens": SCREENS, "flash": FLASH, "run": RUN, "loopTail": [22.5, 24],
      "sfx": [*[[c[0], "pop"] for c in CHIPS], [2, "whip"], [4, "whip"], [6, "whip"], [6, "hit"], [7, "hit"], *[[t, "notif"] for t in FU], [9.5, "riser"],
              [12, "boom"], [12, "bloom"], [12, "sparkle"], [12.25, "hit"], [14, "chime"], *[[f[0], "whip"] for f in FLASH], *[[r[0], "whip"] for r in RUN], *[[r[0] + 0.1, "check"] for r in RUN], [18, "chime"], [19.5, "chime"]]}
json.dump(tl, open("timeline.json", "w"), indent=1)
print("song %.3f, dur %.3f s, drop at %.3f s" % (SONG_START, TOTAL_B * BEAT, DROP_B * BEAT))

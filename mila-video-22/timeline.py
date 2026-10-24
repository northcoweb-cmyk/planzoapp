"""Video #22 "Listing to Sold" (4:5 feed, 25 s) - single source of truth.
b = one beat of "She's Gone, Dance On" (Disclosure) at 134.01 BPM (0.4477 s). The drop's first kick is 2:19.858 (bass onset
2:19.855); it lands on video b36 = "Mila... it SOLD." The 36 beats before it are the song's breakdown + build, the voice bed.
Voice: Kokoro af_bella (speed 1.06), one agent talking to Mila; times are in seconds from video start.
Drone: the client's own footage 0:03-0:08 only (1280x720, cropped 4:5, motion-interpolated to 60 fps), split b0-6.5 / b36-40.5.
"""
import json
BEAT = 60 / 134.01; DROP_SONG = 139.858; DROP_B = 36; TOTAL_B = 56; FPS = 60
SONG_START = DROP_SONG - DROP_B * BEAT
VOICE = [["l1", 0.35, "Hey Mila, new listing. 21 Sea Cliff Drive, Malibu. Six beds, eleven-nine."],
         ["l2", 6.2, "Um, actually… make that twelve-five."],
         ["l3", 8.85, "Open house Saturday, one to four."],
         ["l4", 11.1, "Private showing Sunday at ten. Oh, wait, no, make it eleven."],
         ["l5", 15.28, "Mila… it sold."],
         ["l6", 17.4, "Make me a Just Sold post."]]
B = lambda s: round(s / BEAT, 3)
tl = {"beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT, "drop": DROP_B,
      "voice": [[n, s, B(s), t] for n, s, t in VOICE], "drone1": [0, 6.5, 0], "drone2": [36, 40.5, 175], "droneN": 296,
      "addr": 2.6, "beds": 4.2, "price1": 5.0, "price2": 17.45, "oh": B(11.1) + 2.0 / BEAT * 1.0, "eleven": B(14.35), "uc": 33.9, "loopTail": [54.3, 56],
      "slides": [42, 43, 44, 45],
      "sfx": [[B(2.6), "pop"], [B(4.2), "pop"], [B(5.0), "tick"], [6.5, "whip"], [6.5, "shutter"], [13.5, "whip"], [17.45, "tick"], [17.6, "chime"],
              [19.5, "whip"], [20.2, "pop"], [20.7, "pop"], [21.2, "pop"], [21.7, "chime"], [24.5, "whip"], [25.2, "pop"], [29.9, "tap"], [32.05, "tick"], [32.3, "chime"],
              [33.5, "whip"], [33.9, "stamp"], [36, "boom"], [36, "stamp"], [36, "bloom"], [36, "sparkle"], [40.5, "whip"], [41.2, "card"], *[[s, "whip"] for s in [42, 43, 44, 45]],
              [46.3, "chime"], [50, "whip"], [50.2, "chime_hi"], [51.5, "chime"]]}
json.dump(tl, open("timeline.json", "w"), indent=1, ensure_ascii=False)
print("song %.3f -> %.3f | %.2f s | drop at %.3f s" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, DROP_B * BEAT))
for n, s, b, t in tl["voice"]: print(n, s, b)

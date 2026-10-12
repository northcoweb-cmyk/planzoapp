"""Video #11 "Running Late" - single source of truth.
b = one beat of "Too Much For Me (Extended)" at 128 BPM (0.46875 s). seconds = b * BEAT.
Grid fitted to three sections (0:00-0:14, 0:46-1:40, 1:52-2:40): identical 128.0 BPM; the bass drop lands on
song beat 96 (0:45.12), a 16-bar line, which is video beat 20.
The voice (Kokoro TTS, voice af_heart, see tools/voice_tts.py) sits over the song's breakdown.
"""
import json

BEAT = 60 / 128
PHASE = 0.115
DROP_SONG_BEAT = 96          # 0:45.115
DROP_B = 20
TOTAL_B = 40                 # 10 bars = 18.75 s
START_BEAT = DROP_SONG_BEAT - DROP_B          # song beat 76 = 0:35.74, inside the breakdown
SONG_START = PHASE + BEAT * START_BEAT
FPS = 60

PH = json.load(open("assets/voice/phrases.json"))
STARTS = [0.42, 1.24, 2.38, 4.52, 7.20]      # seconds: when each phrase begins
VOICE = []
for (text, dur), s in zip(PH, STARTS):
    words = text.split(); w = [len(x) + 2 for x in words]; tot = sum(w); t = s; ws = []
    for x, k in zip(words, w): ws.append([x, round(t / BEAT, 4)]); t += dur * k / tot
    VOICE.append({"text": text, "b0": round(s / BEAT, 4), "b1": round((s + dur) / BEAT, 4), "words": ws})
VOICE_END = VOICE[-1]["b1"]

timeline = {
    "beat": BEAT, "fps": FPS, "songStart": SONG_START, "totalBeats": TOTAL_B, "duration": TOTAL_B * BEAT,
    "drop": DROP_B, "voice": VOICE, "voiceStarts": STARTS, "voiceEnd": VOICE_END,
    "onIt": 18.5, "stutter": [18.5, 19.5], "gap": [19.5, 20.0],
    "cuts": [20, 21, 22, 23.5, 24.5, 25.5, 26.5, 27.5, 28.5],
    "send": 23.5, "reply": 24.5, "line": 29.5, "logo": 32, "loopTail": [39, 40],
    "sfx": [
        [0.0, "tick"], [0.5, "tick"],
        [0.75, "listen"], [18.5, "chime"], [18.5, "swoosh_up"],
        [20.0, "boom"], [20.0, "sparkle"],
        [21.0, "card"], [22.0, "card"], [23.5, "send"], [24.5, "pop"], [25.5, "card"], [26.5, "card"], [27.5, "card"], [28.5, "chime_hi"],
        [29.5, "through"], [32.0, "boom"], [32.0, "sparkle"], [33.5, "chime"],
    ],
}
with open("timeline.json", "w") as f: json.dump(timeline, f, indent=1, ensure_ascii=False)
print("song %.4f -> %.4f | video %.4f s | voice ends b%.2f (%.2f s) | DROP %.3f s" % (SONG_START, SONG_START + TOTAL_B * BEAT, TOTAL_B * BEAT, VOICE_END, VOICE_END * BEAT, DROP_B * BEAT))
for v in VOICE: print("  b%.2f-%.2f  %s" % (v["b0"], v["b1"], v["text"]))

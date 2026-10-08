# HouseDAW

A complete, **self-contained** browser DAW for making house music — arrangement timeline, piano roll, drum sequencer,
mixer, effects, synths, a built-in sound factory, AI producer, mastering and WAV/MP3 export.

**There is nothing to download or buy.** No sample packs, no APIs, no accounts, no internet. Every sound is generated
on your device by the built-in DSP engine, and projects are stored in your browser (IndexedDB).

## Run it

Double-click `index.html` (works from `file://`), or serve the folder with any static server:

```bash
cd housedaw && python3 -m http.server 8080     # then open http://localhost:8080
```

When served over http(s) a service worker caches the app, so it keeps working **offline** after the first load
(and can be installed as an app). No build step, no dependencies. Tested in Chromium; needs a modern browser with the
Web Audio API and IndexedDB.

## 60-second first track

1. Click **✦ NEW HOUSE TRACK** → choose Style, Mood, Energy, BPM → **GENERATE GROOVE**.
2. Press **Space**. You're hearing kick, clap, hats, open hat, percussion, bass, chords, pad, lead and FX.
3. Double-click any clip to edit it (piano roll for MIDI, step sequencer for drums). Drag sounds in from the left browser.
4. **🏗 Song Builder** turns it into a full 2–5 minute arrangement (Intro → Build → Drop → Break → Build → Drop 2 → Outro).
5. **⬇ Export** renders WAV (16/24-bit) or MP3 of the entire song, the loop region or the selected clips.

## What's built in (all procedural — see `js/lib.js`, `js/dsp.js`, `js/presets.js`, `js/music.js`)

| Content | Count |
|---|---|
| Kicks (Deep, Punchy, Tight, Sub-heavy, Club, Short, Long, Soft, Hard, Saturated) | 60 |
| Claps / Snares | 28 / 28 |
| Closed hats / Open hats | 34 / 28 |
| Percussion (shakers, rims, toms, congas, bongos, clicks, metal, cowbells, noise hits) | 60 |
| Crashes | 16 |
| Percussion loops (time-fitted to project tempo) | 8 |
| FX (risers, downlifters, impacts, sweeps, reverse transitions, sub drops, whooshes, hits, atmospheres) | 117 |
| Vocal-like sounds (formant-synth chops, pads, shouts, breaths) | 24 |
| Bass instruments (deep, sub, rolling, bouncy, funky, minimal, dark, acid, pluck, reese, …) | 14 |
| Synth instruments (plucks, piano/keys, stabs, chords, pads, leads, arps, bells, atmospheres) | 39 |
| Chord progressions (Deep, Dark, Soulful, Emotional, Euphoric, Minimal, Groovy, Piano house) → real MIDI | 36 |
| Drum patterns / bass patterns / melodies | 18 / 12 / 6 |

Sounds are *families of designed variations*, not random noise: e.g. a kick is a pitch-swept sine body + sub layer + click
transient + saturation + DC filtering, with per-family ranges for pitch, decay, click and drive. Rendering is
deterministic (same spec → same audio) and lazy, so the library costs a few kilobytes of code, not hundreds of megabytes.

## Vibes, auto-mix and reference matching (v2)

Generated tracks have a **Vibe** — a complete groove personality, not just a tempo:

| Vibe | Feel |
|---|---|
| **Bouncy** | Tech-house bounce: bass on the pickup 16ths, short stabs, vocal-chop hook |
| **Rolling** | Driving rolling bass, tight hats, minimal stabs |
| **Dusty** | Laid-back swung deep house, warm keys, soft hats, vinyl crackle |
| **Miami** | Bright bouncy bass house, claps, vocal chops |
| **Warehouse** | Dark driving groove, acid/growl bass, toms |
| **Sunset** | Melodic house with piano and a singing lead |

The vibes were built from measurements of three real reference house tracks (tempo ~128–134, continuous 16th hats with accented
off-beats, bass hits on the 16th *before* the beat, deep kick-ducking, a bass-heavy balance with a mono low end, 16–32 bar steady
drops with drop-outs before the drop). Only generic *statistics* were used — no audio, melodies or samples are copied.

* **Auto-mix** – after generating, the app renders a few bars, measures the frequency balance and nudges track levels toward the
  house reference profile, then settles on a club-typical loudness (≈ −10.7 dB RMS, crest ≈ 9 dB, so it stays punchy).
* **Reference A/B** (Master tab) – load any track you like; the app measures its balance (analysis only, nothing is stored or
  uploaded), shows it next to your mix and can **balance your mix to it** and copy its tempo.
* **Sample-accurate timing** – every track is delay-compensated (Web Audio compressors add 6 ms each) and exports are trimmed so the
  first kick sits exactly on beat 1; parallel paths are phase-aligned so the bass doesn't comb-filter.
* **Playable vocal chops** (sampler instruments) and a chop-riff generator for the hooks.

## Features

* **Engine** – Web Audio graph rebuilt from the project; look-ahead scheduler; sample-accurate loop; the playhead follows
  the audio clock. The *same* scheduling code drives playback and the offline export, so exports match what you hear.
* **Timeline** – audio / MIDI / drum clips, multiple tracks, drag, resize, split, duplicate (Alt-drag), loop by extending a clip,
  fades, gain, snap, zoom, scroll, section markers, loop region, marquee select, automation lanes (volume, pan, sends, any effect parameter).
* **Piano roll** – draw / select / move / resize / delete, velocity lane, quantize, humanize, scale highlighting, scale lock,
  chord assist, octave controls, copy/paste, audition through the track's instrument, playback cursor.
* **Drum sequencer** – per-step velocity and micro-timing, swing, per-row sound swap / volume / pan, humanize, load any pattern,
  split rows to separate tracks.
* **Instruments** – oscillators with unison, FM, custom wavetables, filter + envelopes, LFO, drive, compression and stereo width per preset.
* **Effects** (native nodes, identical live & offline) – Reverb (size, decay, pre-delay, damping, wet, dry), Delay (tempo-synced, feedback,
  stereo ping-pong, tone), EQ, Compressor, Saturation, Filter (LP/HP), Limiter, Chorus, Phaser, Distortion, Stereo Width and a
  tempo-locked **Pump** (sidechain-style ducking). 15 house FX presets (Deep House Reverb, Huge Club Reverb, Vocal Space, Dark Delay,
  Wide Synth, Punchy Kick, Bass Glue, House Master, Club Master, Dirty Bass, Bright Hats, Atmospheric, …).
* **Mixer** – volume, pan, mute/solo, real stereo meters, inserts, two send buses (reverb/echo), group routing, master channel.
* **Mastering** – Loudness, Bass, Treble, Punch, Stereo Width + Clean / Club / Deep / Punchy / Loud presets, live spectrum.
  Real DSP, but not a replacement for professional mastering.
* **Sound Generator** – KICK, CLAP, HAT, SNARE, PERCUSSION, BASS, SYNTH, FX with per-type controls, one-click variations, save to MY SOUNDS.
* **Import** – WAV, MP3, OGG, AAC, FLAC… (whatever your browser decodes) plus a built-in AIFF decoder. Decoded locally, analysed
  (duration, peak, RMS, tempo estimate), waveform drawn, stored in IndexedDB, draggable.
* **House Mode / Song Builder** – genre × mood × energy × tempo (× length) → editable tracks and clips.
* **AI Producer** – see below. **Undo/redo**, autosave, project manager, project file export/import.

## About the AI Producer (honest description)

It is a **local, rule-based assistant**, not a cloud LLM — that is what lets it work offline with no API. It parses plain-English
requests ("make this darker", "add a riser before the drop", "give me a deeper bass", "create a 16-bar intro"…) and performs real
edits to the project. Every reply is generated from the list of edits that were actually applied; if it can't do something, or
nothing needed changing, it says so.

**It can't make your track worse without telling you.** Edits are small, bounded and idempotent (asking twice doesn't stack
duplicates or runaway values). Around every edit it measures the mix before and after, re-balances levels against the reference
profile (shifted on purpose for "darker"/"brighter"…), matches loudness so the change isn't just "louder", and **automatically undoes
the edit** if the measured balance ends up clearly worse. All AI edits are one undo step. Type `help` in the panel for the list.

## Keyboard

`Space` play/stop · `Home` start · `Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z` undo/redo · `Ctrl/⌘+S` save · `S` split at playhead · `Ctrl/⌘+D` duplicate ·
`Delete` · `L` loop · `K` metronome · `C` split tool · `Ctrl+wheel` zoom · `Alt+drag` copy a clip · `Alt+Z S X D C V G B H N J M` play the selected instrument.

## Project layout

```
index.html            app shell            css/style.css   theme
js/util.js            helpers, RNG, peaks  js/state.js     project model, undo/redo
js/dsp.js             sample synthesis     js/engine.js    mixer graph + event scheduling + offline render
js/lib.js             sound catalogue      js/transport.js look-ahead scheduler
js/presets.js         instruments, FX defs js/fx.js        effects
js/music.js           chords/patterns      js/instruments.js synth voices
js/compose.js         House Mode, Vibes & Song Builder   js/ai.js  AI Producer
js/analysis.js        band-balance / loudness / tempo analysis   js/mix.js  Auto-mix + Reference A/B
js/actions.js         shared edit actions  js/import.js    audio import   js/gen.js  sound generator
js/store.js           IndexedDB            js/export.js    WAV/MP3        js/packs.js optional licensed packs
js/ui-*.js, dialogs.js, app.js   interface
js/vendor/lame.min.js MP3 encoder (lamejs, LGPL-3.0), bundled locally
sw.js / manifest.json offline + installable
```

## Adding licensed audio later

Drop files in `packs/` and list them in `packs/manifest.json` (see `packs/README.md`) — they appear in the browser with no code changes.

## Credits & licences

MP3 encoding uses **lamejs** (LGPL-3.0), vendored unmodified in `js/vendor/` with its licence. All built-in sounds are original,
procedurally generated audio; nothing is sampled from commercial products, packs or recordings.

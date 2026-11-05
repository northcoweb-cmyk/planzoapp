# Arena Tycoon

Run a hockey arena: walk it, watch the game, grow the business. Open `index.html` in a browser (no build step).

## Files — change one thing without touching the rest
| File | What it holds |
|---|---|
| `sim.js` | The rules: hockey (penalties, power plays, pulled goalie, 3-on-3 OT, shootout), fans, lines, security lanes, money, events, concourse upgrade catalog (`DECOR`) |
| `render.js` | Every visual: the 3-level bowl, seats and crowd, booths with working staff, security checkpoints, logo, post-game show, night lighting |
| `ui.js` | Controls, HUD, menus, boot |
| `index.html` | Page layout and styles |

## People & social media
* Every seat holds the same person every game: a name, a handle and a personality (die-hard, casual, foodie, big spender, penny pincher, grump, family, college kid) with loyalty, temper, patience and a **price tolerance**. Click any fan to see them.
* Raise prices and the people who can't stomach them refuse to buy, get mad, post about it, and show a red **!** over their head in the crowd.
* **Chirp** (tab or `K`): live fan posts, trending hashtags and a sentiment meter. Net buzz moves hype and reputation after each game.

## Controls
WASD walk (Shift run) · click ground to walk · click/E inspect · wheel zoom · O overview · **L cycle stadium levels** · V fan-mood heat map · B/P/M/F menus · Space pause · 1-4 speed · N skip downtime/intermissions.

## Tuning knobs
* `FPA` (sim.js) — fans each little person represents (lower = denser concourse, slower)
* `homeEdge()` (sim.js) — home-ice advantage
* penalty rate: `penaltyT` in `hockey()`; early-exit rate: `stepAgents()` "blowouts"
* look: `PX` (render.js) = pixel chunkiness; seat/stand colors in `addRow`

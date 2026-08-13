# Flight Simulator 2026

A realistic **2D side-view flight simulator** that runs entirely in the browser —
**no Node.js, no build step, no dependencies**. Pick an airline, an aircraft, and a
route between real-world airports, then fly it: takeoff, climb, cruise, and land.

## Play

Just open `index.html` in any modern browser (double-click it, or drag it into a
browser window). That's it.

> Optional: if you prefer serving it locally, run
> `python3 -m http.server 8177` in this folder and open
> <http://localhost:8177>.

## Controls

Pitch is **yoke-style (inverted)**: pull back to climb.

| Key             | Action                             |
| --------------- | ---------------------------------- |
| `↓` / `S`       | Pitch nose **UP** (pull to climb)  |
| `↑` / `W`       | Pitch nose **DOWN** (push to dive) |
| `D` / `→`       | Throttle up                        |
| `A` / `←`       | Throttle down                      |
| `F` / `R`       | Flaps extend / retract             |
| `G`             | Landing gear toggle                |
| `Space` (hold)  | Wheel brakes (on the ground)       |
| `P`             | Pause                              |
| `Esc`           | Back to menu                       |

## How to fly

1. **Takeoff:** Set flaps (press `F` once or twice), throttle to 100% (`D`), and
   let the aircraft accelerate. Near rotation speed (V<sub>R</sub>, shown per
   aircraft), ease the nose up by **pulling back** (`↓` / `S`).
2. **Climb:** Retract gear (`G`), hold ~9° nose-up, and climb toward cruise.
   Watch the **STALL** warning if you pull too hard — angle of attack matters.
3. **Descend & land:** Reduce throttle, extend flaps, lower gear (`G`), and aim
   for a gentle descent. Touch down on the destination runway at **under ~3 m/s
   vertical speed** for a good score. Brake with `Space` to stop on the runway.

## What's simulated

- **Aerodynamics:** lift and drag from air density, dynamic pressure, wing area,
  and a lift-curve with a real **stall** past the critical angle of attack.
- **Forces:** thrust along the nose, lift perpendicular to the flight path,
  induced + parasite drag, and gravity — integrated as a point mass.
- **Atmosphere:** air density falls off with altitude, so climb performance
  degrades up high.
- **Ground handling:** rolling resistance, wheel braking, rotation, and
  hard-landing / gear-up / overrun detection.

## Content

- **12 real airlines** with approximate liveries (American, Delta, United,
  Southwest, JetBlue, British Airways, Lufthansa, Air France, KLM, Emirates,
  Singapore Airlines, Qantas) — tail color, cheatline, and logo shown on the
  aircraft.
- **5 aircraft** with realistic-ish specs and distinct side-view models
  (prop / turboprop / twinjet / widebody): Cessna 172, Dash 8 Q400, Airbus A320,
  Boeing 737-800, Boeing 777-300ER.
- **12 real-world airports**, each with its **own look** — terrain palette, sky
  tint, and a recognizable landmark:
  - JFK New York — city skyline · LAX — palms · ORD Chicago — skyline
  - SFO — Golden Gate bridge · LHR London — Big Ben + the Eye · CDG — Eiffel Tower
  - FRA Frankfurt — skyline · DXB Dubai — desert + tall spire · HND Tokyo — Mt Fuji
  - SIN Singapore — Marina Bay + palms · SYD — Opera House + Harbour Bridge · GRU — hills
  
  Real great-circle distances are shown; the flown distance is compressed so a
  leg lasts minutes, not hours, and the scenery blends from departure to arrival.

## Project structure

```
index.html        # markup: menu + game canvas + HUD
css/style.css     # all styling
js/
  data.js         # airlines, airports, aircraft specs + math helpers
  physics.js      # atmosphere + aerodynamic coefficients
  camera.js       # world <-> screen mapping, smooth follow
  aircraft.js     # flight dynamics (the physics core)
  world.js        # sky, terrain, runways, clouds
  input.js        # keyboard handling
  hud.js          # instruments overlay
  game.js         # game loop, rendering, outcomes
  menu.js         # airline/aircraft/route selection
  main.js         # bootstrap
```

Scripts are plain classic `<script>` files (shared global scope), which is why
the game works straight from `file://` with no bundler.

## Roadmap ideas

- Weather: wind, gusts, crosswind landings, turbulence.
- ATC / flight-plan phases and waypoints.
- Terrain elevation differences between departure and arrival.
- Fuel burn and payload affecting performance.
- Airline management layer (fleet, routes, economy).
- Sound (engines, stall horn, gear, touchdown).
- Touch / on-screen controls for mobile.

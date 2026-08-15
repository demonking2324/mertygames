/* ============================================================
 * Flight Simulator 2026 — Game Data
 * Airlines, airports, and aircraft types.
 * All specs are realistic-ish (simplified for a 2D sim).
 * ============================================================ */

/* Shared math helpers (used across data + physics). */
function rad(deg) { return (deg * Math.PI) / 180; }
function deg(rad) { return (rad * 180) / Math.PI; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

/* Real airlines with current-style liveries.
 * fuselage / belly / tail / engine = paint. cheat = window-line style.
 * tailMark = distinctive fin artwork drawn in game.js. */
const AIRLINES = [
  { id: "aal", name: "American Airlines",  code: "AA", fuselage: "#c8ccd1", belly: "#b0b5bb", tail: "#0a3161",
    accent: "#c8102e", accent2: "#f4f6f8", cheat: "none", titles: "American", titleColor: "#5c6570",
    tailMark: "aa-flag", engine: "#c8ccd1" },
  { id: "dal", name: "Delta Air Lines",    code: "DL", fuselage: "#f4f7fa", belly: "#e6ebf1", tail: "#0b1f47",
    accent: "#e31837", cheat: "none", titles: "DELTA", titleColor: "#0b1f47",
    tailMark: "widget", engine: "#0b1f47" },
  { id: "ual", name: "United Airlines",    code: "UA", fuselage: "#f4f7fa", belly: "#0a3161", tail: "#0033a0",
    accent: "#143c8a", cheat: "none", titles: "UNITED", titleColor: "#0033a0",
    tailMark: "globe", engine: "#0033a0" },
  { id: "swa", name: "Southwest Airlines", code: "WN", fuselage: "#304cb2", belly: "#e31837", tail: "#e31837",
    accent: "#ffb81c", cheat: "split", titles: "Southwest", titleColor: "#ffffff",
    tailMark: "heart", engine: "#304cb2" },
  { id: "jbu", name: "JetBlue",            code: "B6", fuselage: "#f7f9fc", belly: "#00205b", tail: "#00205b",
    accent: "#68b8e8", cheat: "none", titles: "jetBlue", titleColor: "#00205b",
    tailMark: "mosaic", engine: "#00205b" },
  { id: "baw", name: "British Airways",    code: "BA", fuselage: "#f4f7fa", belly: "#e6ebf0", tail: "#012169",
    accent: "#c8102e", accent2: "#ffffff", cheat: "ribbon", titles: "BRITISH", titleColor: "#012169",
    tailMark: "union", engine: "#c5ccd4" },
  { id: "dlh", name: "Lufthansa",          code: "LH", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#05164d",
    accent: "#f7c600", cheat: "none", titles: "Lufthansa", titleColor: "#05164d",
    tailMark: "crane", engine: "#f4f7fa" },
  { id: "afr", name: "Air France",         code: "AF", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#002157",
    accent: "#ef3340", accent2: "#ffffff", cheat: "none", titles: "AIRFRANCE", titleColor: "#002157",
    tailMark: "tricolor", engine: "#002157" },
  { id: "klm", name: "KLM",                code: "KL", fuselage: "#00a1de", belly: "#0089c4", tail: "#0066a1",
    accent: "#ffffff", cheat: "none", titles: "KLM", titleColor: "#ffffff",
    tailMark: "crown", engine: "#00a1de" },
  { id: "uae", name: "Emirates",           code: "EK", fuselage: "#f4f7fa", belly: "#eee6d4", tail: "#d71a21",
    accent: "#c8a24a", cheat: "band", titles: "Emirates", titleColor: "#c8a24a",
    tailMark: "arabic", engine: "#d71a21" },
  { id: "sia", name: "Singapore Airlines", code: "SQ", fuselage: "#f4f7fa", belly: "#ece4cc", tail: "#1b2c5e",
    accent: "#c5a35a", cheat: "band", titles: "SINGAPORE", titleColor: "#1b2c5e",
    tailMark: "bird", engine: "#c5a35a" },
  { id: "qfa", name: "Qantas",             code: "QF", fuselage: "#f4f7fa", belly: "#eceff2", tail: "#e4002b",
    accent: "#e4002b", cheat: "none", titles: "QANTAS", titleColor: "#e4002b",
    tailMark: "roo", engine: "#e4002b" },
  { id: "jal", name: "Japan Airlines",     code: "JL", fuselage: "#f4f7fa", belly: "#eceff2", tail: "#ffffff",
    accent: "#b0132b", cheat: "thin", titles: "JAL", titleColor: "#1a1a1a",
    tailMark: "tsuru", engine: "#b0132b" },
  { id: "aca", name: "Air Canada",         code: "AC", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#1d1d1f",
    accent: "#e31837", cheat: "none", titles: "AIR CANADA", titleColor: "#1d1d1f",
    tailMark: "maple", engine: "#1d1d1f" },
  { id: "eth", name: "Ethiopian Airlines", code: "ET", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#078930",
    accent: "#fcd116", accent2: "#da121a", cheat: "flag3", titles: "ETHIOPIAN", titleColor: "#078930",
    tailMark: "eth-flag", engine: "#078930" },
  { id: "kqa", name: "Kenya Airways",      code: "KQ", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#e31837",
    accent: "#e31837", cheat: "thin", titles: "Kenya Airways", titleColor: "#1a1a1a",
    tailMark: "kq", engine: "#e31837" },
  { id: "pgt", name: "Pegasus Airlines",   code: "PC", fuselage: "#f4f7fa", belly: "#fff6d6", tail: "#ffcc00",
    accent: "#1a1a1a", cheat: "none", titles: "pegasus", titleColor: "#1a1a1a",
    tailMark: "pegasus", engine: "#ffcc00" },
  { id: "thy", name: "Turkish Airlines",   code: "TK", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#c8102e",
    accent: "#c8102e", cheat: "none", titles: "TURKISH", titleColor: "#c8102e",
    tailMark: "thy", engine: "#c8102e" },
  { id: "pvt", name: "Private",             code: "N",  fuselage: "#f2f4f6", belly: "#d9dee4", tail: "#c5ccd4",
    accent: "#2f5f8a", cheat: "thin", titles: "", titleColor: "#2f5f8a",
    tailMark: "none", engine: "#c5ccd4" },
];

/* Aircraft aerodynamic + performance model.
 * Units: SI. mass kg, wingArea m^2, thrust N.
 * clSlope: lift-curve slope per radian.  alphaStall: stall angle (rad).
 * clMax: peak lift coefficient (flaps up).  flapCl: extra Cl per flap notch.
 * cd0: parasite drag.  induced: induced-drag factor k in Cd = cd0 + k*Cl^2.
 * vRotate / vApproach given in knots for reference in the UI.
 */
const AIRCRAFT_TYPES = [
  {
    id: "c172",
    name: "Cessna 172",
    class: "General Aviation",
    length: 8.3,
    mass: 1111,
    wingArea: 16.2,
    maxThrust: 2600,
    clSlope: 5.7,
    clMax: 1.6,
    alphaStall: rad(16),
    flapCl: 0.35,
    flapNotches: 3,
    cd0: 0.032,
    induced: 0.055,
    pitchAuthority: 1.5,
    vRotate: 55,
    vApproach: 65,
    cruiseAlt: 3000,
    engineType: "prop",
    engineCount: 1,
    highWing: true,
    fixedGear: true,
    winglets: false,
  },
  {
    id: "dash8",
    name: "Dash 8 Q400",
    class: "Regional Turboprop",
    length: 32.8,
    mass: 29000,
    wingArea: 63.1,
    maxThrust: 62000,
    clSlope: 5.9,
    clMax: 1.5,
    alphaStall: rad(15),
    flapCl: 0.45,
    flapNotches: 4,
    cd0: 0.028,
    induced: 0.045,
    pitchAuthority: 1.1,
    vRotate: 120,
    vApproach: 125,
    cruiseAlt: 7600,
    engineType: "turboprop",
    engineCount: 2,
    highWing: true,
    fixedGear: false,
    winglets: false,
  },
  {
    id: "a320",
    name: "Airbus A320",
    class: "Narrow-body Jet",
    length: 37.6,
    mass: 68000,
    wingArea: 122.6,
    maxThrust: 220000,
    clSlope: 6.0,
    clMax: 1.45,
    alphaStall: rad(15),
    flapCl: 0.5,
    flapNotches: 4,
    cd0: 0.022,
    induced: 0.043,
    pitchAuthority: 0.85,
    vRotate: 145,
    vApproach: 138,
    cruiseAlt: 11000,
    engineType: "jet",
    engineCount: 2,
    highWing: false,
    fixedGear: false,
    winglets: true,
  },
  {
    id: "b738",
    name: "Boeing 737-800",
    class: "Narrow-body Jet",
    length: 39.5,
    mass: 70000,
    wingArea: 125.0,
    maxThrust: 240000,
    clSlope: 6.0,
    clMax: 1.45,
    alphaStall: rad(15),
    flapCl: 0.5,
    flapNotches: 5,
    cd0: 0.022,
    induced: 0.043,
    pitchAuthority: 0.85,
    vRotate: 150,
    vApproach: 142,
    cruiseAlt: 11500,
    engineType: "jet",
    engineCount: 2,
    highWing: false,
    fixedGear: false,
    winglets: true,
  },
  {
    id: "b77w",
    name: "Boeing 777-300ER",
    class: "Wide-body Jet",
    length: 73.9,
    mass: 300000,
    wingArea: 436.8,
    maxThrust: 1140000,
    clSlope: 6.1,
    clMax: 1.4,
    alphaStall: rad(14),
    flapCl: 0.55,
    flapNotches: 5,
    cd0: 0.020,
    induced: 0.040,
    pitchAuthority: 0.6,
    vRotate: 165,
    vApproach: 150,
    cruiseAlt: 11800,
    engineType: "jet",
    engineCount: 2,
    highWing: false,
    fixedGear: false,
    winglets: false,
    wide: true,
  },
  {
    id: "e175",
    name: "Embraer E175",
    class: "Regional Jet",
    length: 31.7,
    mass: 38000,
    wingArea: 72.7,
    maxThrust: 128000,
    clSlope: 6.0,
    clMax: 1.45,
    alphaStall: rad(15),
    flapCl: 0.5,
    flapNotches: 5,
    cd0: 0.023,
    induced: 0.044,
    pitchAuthority: 0.9,
    vRotate: 135,
    vApproach: 130,
    cruiseAlt: 11000,
    engineType: "jet",
    engineCount: 2,
    highWing: false,
    fixedGear: false,
    winglets: false,
  },
  {
    id: "b789",
    name: "Boeing 787-9 Dreamliner",
    class: "Wide-body Jet",
    length: 62.8,
    mass: 230000,
    wingArea: 377.0,
    maxThrust: 640000,
    clSlope: 6.1,
    clMax: 1.4,
    alphaStall: rad(14),
    flapCl: 0.55,
    flapNotches: 5,
    cd0: 0.019,
    induced: 0.038,
    pitchAuthority: 0.65,
    vRotate: 160,
    vApproach: 150,
    cruiseAlt: 12000,
    engineType: "jet",
    engineCount: 2,
    highWing: false,
    fixedGear: false,
    winglets: true,
    wide: true,
  },
];

/* Real-world airports (subset). elevation in meters, runway length in meters.
 * lat/lon used to compute great-circle route distance.
 * theme drives the scenery: terrain = [grassTop, grassBottom], sky = [top, bottom],
 * landmark = a recognizable silhouette drawn near the field. */
const AIRPORTS = [
  { icao: "KJFK", iata: "JFK", name: "New York JFK",        city: "New York",     lat: 40.6413,  lon: -73.7781, elevation: 4,   runway: 4423,
    theme: { terrain: ["#4f7a3a", "#2f4d24"], sky: ["#7aa7d6", "#b9d3ea"], landmark: "nyc" } },
  { icao: "KLGA", iata: "LGA", name: "New York LaGuardia",  city: "New York",     lat: 40.7769,  lon: -73.8740, elevation: 6,   runway: 2134,
    theme: { terrain: ["#4f7a3a", "#2f4d24"], sky: ["#7aa7d6", "#b9d3ea"], landmark: "nyc" } },
  { icao: "KLAX", iata: "LAX", name: "Los Angeles Intl",    city: "Los Angeles",  lat: 33.9416,  lon: -118.4085, elevation: 38,  runway: 3939,
    theme: { terrain: ["#8a9a52", "#5f6f33"], sky: ["#6db4e6", "#ffd9a0"], landmark: "palms" } },
  { icao: "KORD", iata: "ORD", name: "Chicago O'Hare",      city: "Chicago",      lat: 41.9742,  lon: -87.9073,  elevation: 205, runway: 3962,
    theme: { terrain: ["#5c7f3c", "#3a5626"], sky: ["#8fb0cf", "#c6d7e6"], landmark: "skyline" } },
  { icao: "KSFO", iata: "SFO", name: "San Francisco Intl",  city: "San Francisco",lat: 37.6213,  lon: -122.3790, elevation: 4,   runway: 3618,
    theme: { terrain: ["#7d8a4a", "#586b30"], sky: ["#9ab8cf", "#dfe8ee"], landmark: "bridge" } },
  { icao: "CYVR", iata: "YVR", name: "Vancouver Intl",      city: "Vancouver",    lat: 49.1947,  lon: -123.1792, elevation: 4,   runway: 3318,
    theme: { terrain: ["#3f6e3a", "#244a22"], sky: ["#8aa8c0", "#d4e0e8"], landmark: "mountains" } },
  { icao: "EGLL", iata: "LHR", name: "London Heathrow",     city: "London",       lat: 51.4700,  lon: -0.4543,   elevation: 25,  runway: 3902,
    theme: { terrain: ["#3e6f39", "#274b22"], sky: ["#9fb0bd", "#cbd6dd"], landmark: "bigben" } },
  { icao: "EGCC", iata: "MAN", name: "Manchester",          city: "Manchester",   lat: 53.3537,  lon: -2.2750,   elevation: 78,  runway: 3050,
    theme: { terrain: ["#4a6b3a", "#2d4522"], sky: ["#9aafbd", "#cdd6dd"], landmark: "mills" } },
  { icao: "EHAM", iata: "AMS", name: "Amsterdam Schiphol",  city: "Amsterdam",    lat: 52.3105,  lon: 4.7683,    elevation: -3,  runway: 3800,
    theme: { terrain: ["#4e7f39", "#2c4a20"], sky: ["#9db3c2", "#cdd8df"], landmark: "windmill" } },
  { icao: "LFPG", iata: "CDG", name: "Paris Charles de G.", city: "Paris",        lat: 49.0097,  lon: 2.5479,    elevation: 119, runway: 4215,
    theme: { terrain: ["#5d8140", "#3b5528"], sky: ["#8fb4d6", "#cfe0ee"], landmark: "eiffel" } },
  { icao: "EDDF", iata: "FRA", name: "Frankfurt",           city: "Frankfurt",    lat: 50.0379,  lon: 8.5622,    elevation: 111, runway: 4000,
    theme: { terrain: ["#4d7538", "#314e22"], sky: ["#93b2cd", "#c9d8e4"], landmark: "skyline" } },
  { icao: "EDDM", iata: "MUC", name: "Munich",              city: "Munich",       lat: 48.3538,  lon: 11.7861,   elevation: 453, runway: 4000,
    theme: { terrain: ["#4a7540", "#2f4e28"], sky: ["#8fb4d0", "#d5e4ee"], landmark: "alpine" } },
  { icao: "EPWA", iata: "WAW", name: "Warsaw Chopin",       city: "Warsaw",       lat: 52.1657,  lon: 20.9671,   elevation: 110, runway: 3690,
    theme: { terrain: ["#4d7538", "#314e22"], sky: ["#93b2cd", "#c9d8e4"], landmark: "palace" } },
  { icao: "OMDB", iata: "DXB", name: "Dubai Intl",          city: "Dubai",        lat: 25.2532,  lon: 55.3657,   elevation: 19,  runway: 4447,
    theme: { terrain: ["#d8b676", "#a9863f"], sky: ["#7fc0e8", "#f4e2b0"], landmark: "burj" } },
  { icao: "RJTT", iata: "HND", name: "Tokyo Haneda",        city: "Tokyo",        lat: 35.5494,  lon: 139.7798,  elevation: 6,   runway: 3360,
    theme: { terrain: ["#587f3d", "#385426"], sky: ["#8fb6d8", "#d8e6f0"], landmark: "fuji" } },
  { icao: "WSSS", iata: "SIN", name: "Singapore Changi",    city: "Singapore",    lat: 1.3644,   lon: 103.9915,  elevation: 7,   runway: 4000,
    theme: { terrain: ["#3f8a4a", "#256b34"], sky: ["#77bfe6", "#dff0e8"], landmark: "marina" } },
  { icao: "YSSY", iata: "SYD", name: "Sydney Kingsford S.", city: "Sydney",       lat: -33.9399, lon: 151.1753,  elevation: 6,   runway: 3962,
    theme: { terrain: ["#6f9a44", "#4a6b2c"], sky: ["#7fbce8", "#dcefff"], landmark: "opera" } },
  { icao: "SBGR", iata: "GRU", name: "São Paulo Guarulhos", city: "São Paulo",    lat: -23.4356, lon: -46.4731,  elevation: 750, runway: 3700,
    theme: { terrain: ["#3f7e3a", "#255022"], sky: ["#8ab6d0", "#cfe0e8"], landmark: "hills" } },
  { icao: "CYYZ", iata: "YYZ", name: "Toronto Pearson",     city: "Toronto",      lat: 43.6777,  lon: -79.6248,  elevation: 173, runway: 3389,
    theme: { terrain: ["#4f7a3a", "#2f4d24"], sky: ["#8fb0cf", "#c6d7e6"], landmark: "skyline" } },
  { icao: "LEMD", iata: "MAD", name: "Madrid Barajas",      city: "Madrid",       lat: 40.4936,  lon: -3.5668,   elevation: 610, runway: 4350,
    theme: { terrain: ["#8a9a52", "#5f6f33"], sky: ["#8fb4d6", "#e8d9a0"], landmark: "hills" } },
  { icao: "VHHH", iata: "HKG", name: "Hong Kong Intl",      city: "Hong Kong",    lat: 22.3080,  lon: 113.9185,  elevation: 9,   runway: 3800,
    theme: { terrain: ["#3f7e3a", "#255022"], sky: ["#77bfe6", "#dff0e8"], landmark: "marina" } },
  { icao: "HAAB", iata: "ADD", name: "Addis Ababa Bole",    city: "Addis Ababa",  lat: 8.9779,   lon: 38.7993,   elevation: 2334, runway: 3800,
    theme: { terrain: ["#b89a4e", "#7a6224"], sky: ["#8fb8d8", "#e6dcc0"], landmark: "africa" } },
  { icao: "HKJK", iata: "NBO", name: "Nairobi Jomo Kenyatta", city: "Nairobi",    lat: -1.3192,  lon: 36.9278,   elevation: 1624, runway: 4117,
    theme: { terrain: ["#a89a54", "#6f6228"], sky: ["#8fbad6", "#e3ddc4"], landmark: "africa" } },
  { icao: "LTFJ", iata: "SAW", name: "Istanbul Sabiha Gökçen", city: "Istanbul", lat: 40.8986,  lon: 29.3092,   elevation: 95,  runway: 3000,
    theme: { terrain: ["#6f8a44", "#4a6228"], sky: ["#7eb6d8", "#e4d6a8"], landmark: "mosque" } },
];

/* Airlines commonly seen parked at each airport (id → count), used to
 * populate the background gates. Rough real-world hub presence. */
const AIRLINE_BY_ID = Object.fromEntries(AIRLINES.map((a) => [a.id, a]));

/* Which of our airlines actually operate each type (mainline / regional
 * affiliate). Used so the livery picker only offers realistic paint. */
const AIRCRAFT_OPERATORS = {
  c172:  ["pvt"],
  dash8: ["aca", "qfa", "eth"],
  a320:  ["aal", "dal", "ual", "jbu", "baw", "dlh", "afr", "aca", "pgt", "thy"],
  b738:  ["aal", "dal", "ual", "swa", "klm", "qfa", "jal", "aca", "eth", "kqa"],
  b77w:  ["aal", "ual", "baw", "afr", "klm", "uae", "sia", "qfa", "jal", "aca", "eth", "kqa", "thy"],
  e175:  ["aal", "dal", "ual", "aca", "klm"],
  b789:  ["aal", "ual", "baw", "dlh", "afr", "klm", "sia", "qfa", "jal", "aca", "eth", "kqa", "thy"],
};

function liveriesForAircraft(spec) {
  const ids = (spec && AIRCRAFT_OPERATORS[spec.id]) || [];
  const list = [];
  for (const id of ids) {
    const al = AIRLINE_BY_ID[id];
    if (al) list.push(al);
  }
  return list;
}

const AIRPORT_FLEETS = {
  JFK: [["dal", 5], ["jbu", 4], ["aal", 3], ["ual", 1], ["baw", 1], ["afr", 1], ["dlh", 1], ["aca", 1], ["thy", 1]],
  LGA: [["dal", 5], ["aal", 3], ["jbu", 3], ["swa", 2], ["ual", 1]],
  SAW: [["pgt", 6], ["thy", 3], ["dlh", 1], ["afr", 1], ["baw", 1]],
  LAX: [["aal", 3], ["ual", 3], ["dal", 3], ["swa", 2], ["jbu", 1], ["qfa", 1], ["aca", 1]],
  ORD: [["ual", 6], ["aal", 4], ["swa", 2], ["dlh", 1], ["aca", 1]],
  SFO: [["ual", 6], ["aal", 1], ["dal", 1], ["sia", 1], ["uae", 1], ["aca", 1]],
  YVR: [["aca", 7], ["ual", 2], ["aal", 1], ["dal", 1], ["jal", 1], ["qfa", 1]],
  FRA: [["dlh", 6], ["ual", 1], ["baw", 1], ["sia", 1], ["uae", 1], ["aca", 1], ["eth", 1], ["thy", 1]],
  MUC: [["dlh", 7], ["ual", 1], ["baw", 1], ["afr", 1], ["klm", 1], ["aca", 1], ["eth", 1], ["thy", 1]],
  LHR: [["baw", 6], ["dlh", 2], ["klm", 1], ["afr", 2], ["aal", 1], ["uae", 1], ["aca", 1], ["eth", 1], ["kqa", 1], ["thy", 1]],
  MAN: [["baw", 4], ["uae", 2], ["thy", 2], ["dlh", 1], ["klm", 1], ["afr", 1]],
  WAW: [["dlh", 2], ["thy", 2], ["baw", 1], ["klm", 1], ["afr", 1], ["uae", 1]],
  CDG: [["afr", 6], ["klm", 2], ["dlh", 1], ["baw", 1], ["dal", 1], ["uae", 1], ["aca", 1], ["thy", 1]],
  AMS: [["klm", 6], ["afr", 2], ["dlh", 1], ["baw", 1], ["dal", 1], ["uae", 1], ["kqa", 1], ["pgt", 1], ["thy", 1]],
  DXB: [["uae", 7], ["baw", 1], ["sia", 1], ["qfa", 1], ["eth", 1], ["kqa", 1], ["thy", 1]],
  ADD: [["eth", 7], ["dlh", 1], ["uae", 1], ["baw", 1], ["afr", 1], ["klm", 1]],
  NBO: [["kqa", 7], ["klm", 1], ["eth", 1], ["baw", 1], ["dlh", 1], ["uae", 1]],
  HND: [["jal", 5], ["sia", 1], ["baw", 1], ["dlh", 1], ["ual", 1], ["qfa", 1], ["aca", 1]],
  SIN: [["sia", 6], ["uae", 1], ["baw", 1], ["qfa", 1], ["dlh", 1], ["jal", 1]],
  SYD: [["qfa", 6], ["uae", 1], ["sia", 1], ["ual", 1]],
  GRU: [["aal", 2], ["ual", 1], ["dlh", 1], ["afr", 1], ["klm", 1], ["uae", 1]],
  YYZ: [["aca", 7], ["ual", 1], ["aal", 1], ["baw", 1], ["dlh", 1], ["afr", 1]],
  MAD: [["afr", 2], ["baw", 2], ["dlh", 1], ["klm", 1], ["aal", 1], ["dal", 1]],
  HKG: [["sia", 2], ["uae", 1], ["baw", 1], ["qfa", 1], ["jal", 1], ["dlh", 1], ["aca", 1]],
};

/* Plain, liveryless aircraft scheme + a neutral field for Training Mode. */
const TRAINING_AIRLINE = {
  id: "train", name: "Training", code: "TRN",
  fuselage: "#d9dee4", belly: "#c5ccd4", tail: "#c2c8d0",
  accent: "#aeb6c1", cheat: "none", titles: "", titleColor: "#8a93a0",
  tailMark: "none", engine: "#c5ccd4",
};
const TRAINING_AIRPORT = {
  icao: "TRNG", iata: "TRN", name: "Training Field", city: "Training",
  lat: 0, lon: 0, elevation: 0, runway: 4000,
  theme: { terrain: ["#5c8a3c", "#33501e"], sky: ["#8fb6d8", "#cfe0ee"], landmark: "none" },
};

/* Expand an airport's fleet spec into a flat list of airline objects (cached). */
function airportFleet(airport) {
  if (airport._fleet) return airport._fleet;
  const spec = AIRPORT_FLEETS[airport.iata] || [];
  const list = [];
  for (const [id, count] of spec) {
    const al = AIRLINE_BY_ID[id];
    if (!al) continue;
    for (let i = 0; i < count; i++) list.push(al);
  }
  airport._fleet = list;
  return list;
}

/* Coarse continent per airport — used to decide when a route flies over
 * open ocean (e.g., JFK→LHR crosses the Atlantic). */
const AIRPORT_REGION = {
  KJFK: "na", KLGA: "na", KLAX: "na", KORD: "na", KSFO: "na", CYVR: "na", CYYZ: "na",
  EGLL: "eu", EGCC: "eu", LFPG: "eu", EDDF: "eu", EDDM: "eu", EHAM: "eu", LEMD: "eu", LTFJ: "eu", EPWA: "eu",
  OMDB: "me",
  RJTT: "asia", WSSS: "asia", VHHH: "asia",
  YSSY: "oceania",
  SBGR: "sa",
  HAAB: "af", HKJK: "af",
};

/* Continent zoom windows for the route map. lon/lat bounds in degrees. */
const MAP_ZOOMS = [
  { id: "na",  label: "North America", short: "N. America", lon0: -130, lon1: -65,  lat0: 24,  lat1: 55 },
  { id: "sa",  label: "South America", short: "S. America", lon0: -85,  lon1: -32,  lat0: -56, lat1: 14 },
  { id: "eu",  label: "Europe",        short: "Europe",     lon0: -12,  lon1: 36,   lat0: 35,  lat1: 61 },
  { id: "af",  label: "Africa",        short: "Africa",     lon0: -20,  lon1: 54,   lat0: -36, lat1: 38 },
  { id: "as",  label: "Asia",          short: "Asia",       lon0: 48,   lon1: 150,  lat0: -10, lat1: 50 },
  { id: "oc",  label: "Oceania",       short: "Oceania",    lon0: 110,  lon1: 180,  lat0: -48, lat1: -8 },
];

/* Region pairs that are joined by land (no ocean band between them). */
const LAND_CONNECTED = new Set(["eu|me", "asia|eu", "asia|me", "af|eu", "af|me", "af|asia"]);

/* True when the route between two airports crosses a major ocean. */
function routeCrossesOcean(a, b) {
  const ra = AIRPORT_REGION[a.icao];
  const rb = AIRPORT_REGION[b.icao];
  if (!ra || !rb || ra === rb) return false;
  const key = [ra, rb].sort().join("|");
  return !LAND_CONNECTED.has(key);
}

/* Great-circle distance in km between two airports. */
function routeDistanceKm(a, b) {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const la1 = rad(a.lat), la2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Loading-screen tips. `tags` let the loader prefer advice that matches
 * the upcoming flight (takeoff, landing, jet, training, etc.). */
const LOADING_TIPS = [
  { tags: ["pitch"], text: "Pitch is yoke-style: pull ↓ / S to raise the nose, push ↑ / W to lower it." },
  { tags: ["takeoff"], text: "Set takeoff flaps (F), spool to full throttle (D), then rotate near V_R — not before." },
  { tags: ["takeoff"], text: "Rotate too early and you'll stall on the runway. Wait for the airspeed tape to reach V_R." },
  { tags: ["takeoff", "climb"], text: "After a positive climb, retract the gear (G). Gear drag costs you climb rate." },
  { tags: ["landing"], text: "Aim for under ~3 m/s vertical speed at touchdown. Under 1.5 m/s is butter." },
  { tags: ["landing"], text: "On short final: gear down (G), full flaps (F), and a gentle flare in the last few meters." },
  { tags: ["landing"], text: "Gear-up landings always end the flight. Confirm GEAR DN before the threshold." },
  { tags: ["landing"], text: "Start braking (Space) as soon as the wheels are on — overrunning the far end is a failed landing." },
  { tags: ["landing"], text: "Reduce throttle before dumping full flaps on final, or you'll balloon above the glide path." },
  { tags: ["stall"], text: "If STALL flashes, ease the nose down and add throttle. Angle of attack matters more than speed." },
  { tags: ["jet", "climb"], text: "Jets climb best at a modest pitch (~8–12°). Hauling the nose up just bleeds energy." },
  { tags: ["climb"], text: "Air density falls with altitude, so climb performance fades as you get higher." },
  { tags: ["flaps"], text: "Flaps add lift for takeoff and landing, but also drag. Retract them once you're climbing cleanly." },
  { tags: ["ga"], text: "The Cessna 172 has fixed gear — no need to toggle G." },
  { tags: ["general"], text: "Hold Space for wheel brakes. They only work on the ground." },
  { tags: ["general"], text: "Press P to pause, Esc to return to the menu." },
  { tags: ["training"], text: "Training Mode lets you practice takeoffs and landings at a quiet field — no airline, no traffic." },
  { tags: ["training", "landing"], text: "Landing practice starts you on a ~3.5° final. Manage the descent; don't chase the runway." },
  { tags: ["general"], text: "On-screen touch controls (throttle slider + pitch stick) can be toggled from the main menu." },
  { tags: ["route"], text: "Transoceanic routes show land near each coast and open water in between. Short hops stay over terrain." },
  { tags: ["route"], text: "Great-circle distances are real; the flown distance is compressed so a leg lasts minutes, not hours." },
  { tags: ["score"], text: "Landing score starts at 100 and drops as touchdown vertical speed goes past 1.5 m/s." },
  { tags: ["general"], text: "After an off-airport landing you can throttle up and fly again — or roll to a stop and call it a day." },
];

let _lastLoadingTip = -1;

/* Pick a tip, preferring ones whose tags match the upcoming flight. */
function pickLoadingTip(config) {
  const wanted = new Set(["general"]);
  wanted.add("takeoff");
  wanted.add("landing");
  if (config.training) wanted.add("training");
  const spec = config.aircraft;
  if (spec) {
    if (spec.engineType === "jet") wanted.add("jet");
    if (spec.fixedGear) wanted.add("ga");
    wanted.add("flaps");
    wanted.add("stall");
    wanted.add("climb");
  }
  if (!config.training) wanted.add("route");
  wanted.add("score");
  wanted.add("pitch");

  const ranked = LOADING_TIPS.map((tip, i) => ({
    i, tip,
    hits: tip.tags.reduce((n, t) => n + (wanted.has(t) ? 1 : 0), 0),
  })).sort((a, b) => b.hits - a.hits);

  const top = ranked.filter((r) => r.hits >= ranked[0].hits - 1);
  let pick = top[Math.floor(Math.random() * top.length)];
  if (top.length > 1 && pick.i === _lastLoadingTip) {
    pick = top.find((r) => r.i !== _lastLoadingTip) || pick;
  }
  _lastLoadingTip = pick.i;
  return pick.tip.text;
}

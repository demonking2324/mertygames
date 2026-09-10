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
  /* D-ABYN “Niedersachsen” — 747-8 only. Dark blue XXL crane, 100 / 1926|2026. */
  { id: "dlh100", name: "Lufthansa 100 Years", code: "LH", fuselage: "#0a2156", belly: "#07183f", tail: "#06163f",
    accent: "#ffffff", cheat: "xxlcrane", titles: "", titleColor: "#ffffff",
    tailMark: "crane100", engine: "#d8dee8", networkOf: "dlh" },
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
  { id: "qtr", name: "Qatar Airways",      code: "QR", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#5c0a2c",
    accent: "#5c0a2c", cheat: "thin", titles: "QATAR", titleColor: "#5c0a2c",
    tailMark: "oryx", engine: "#5c0a2c" },
  { id: "ibe", name: "Iberia",             code: "IB", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#d7042c",
    accent: "#ffcc00", cheat: "none", titles: "IBERIA", titleColor: "#d7042c",
    tailMark: "iberia", engine: "#d7042c" },
  { id: "ryr", name: "Ryanair",            code: "FR", fuselage: "#073590", belly: "#052c70", tail: "#f1c40f",
    accent: "#f1c40f", cheat: "none", titles: "RYANAIR", titleColor: "#ffffff",
    tailMark: "harp", engine: "#073590" },
  { id: "lan", name: "LATAM",              code: "LA", fuselage: "#f4f7fa", belly: "#1a1a1a", tail: "#1a1a1a",
    accent: "#e0001b", cheat: "none", titles: "LATAM", titleColor: "#e0001b",
    tailMark: "latam", engine: "#1a1a1a" },
  { id: "kal", name: "Korean Air",         code: "KE", fuselage: "#8fd4ea", belly: "#f4f7fa", tail: "#6ec4e0",
    accent: "#c8102e", cheat: "none", titles: "KOREAN AIR", titleColor: "#0a3d6b",
    tailMark: "taegeuk", engine: "#6ec4e0" },
  { id: "sas", name: "SAS",                code: "SK", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#0c1c47",
    accent: "#c5a35a", cheat: "none", titles: "SAS", titleColor: "#0c1c47",
    tailMark: "sas", engine: "#0c1c47" },
  { id: "aic", name: "Air India",          code: "AI", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#c8102e",
    accent: "#e87722", cheat: "band", titles: "AIR INDIA", titleColor: "#c8102e",
    tailMark: "chakra", engine: "#c8102e" },
  { id: "amx", name: "Aeroméxico",         code: "AM", fuselage: "#f4f7fa", belly: "#00205b", tail: "#00205b",
    accent: "#c8102e", cheat: "none", titles: "AEROMEXICO", titleColor: "#00205b",
    tailMark: "eagle", engine: "#00205b" },
  { id: "cpa", name: "Cathay Pacific",     code: "CX", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#006564",
    accent: "#006564", cheat: "thin", titles: "CATHAY PACIFIC", titleColor: "#006564",
    tailMark: "brushwing", engine: "#006564" },
  { id: "ana", name: "ANA",                code: "NH", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#003da5",
    accent: "#003da5", cheat: "thin", titles: "ANA", titleColor: "#003da5",
    tailMark: "ana", engine: "#003da5" },
  { id: "ezy", name: "easyJet",            code: "U2", fuselage: "#ff6600", belly: "#e55c00", tail: "#ff6600",
    accent: "#ffffff", cheat: "none", titles: "easyJet", titleColor: "#ffffff",
    tailMark: "ezy", engine: "#1a1a1a" },
  { id: "vir", name: "Virgin Atlantic",    code: "VS", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#e10a17",
    accent: "#e10a17", cheat: "none", titles: "virgin atlantic", titleColor: "#e10a17",
    tailMark: "lady", engine: "#e10a17" },
  { id: "asa", name: "Alaska Airlines",    code: "AS", fuselage: "#f4f7fa", belly: "#01426a", tail: "#01426a",
    accent: "#6ea043", cheat: "none", titles: "ALASKA", titleColor: "#01426a",
    tailMark: "face", engine: "#01426a" },
  { id: "anz", name: "Air New Zealand",    code: "NZ", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#1a1a1a",
    accent: "#1a1a1a", cheat: "none", titles: "AIR NEW ZEALAND", titleColor: "#1a1a1a",
    tailMark: "koru", engine: "#1a1a1a" },
  { id: "tha", name: "Thai Airways",       code: "TG", fuselage: "#f4f7fa", belly: "#ece4cc", tail: "#4b0082",
    accent: "#c5a35a", cheat: "band", titles: "THAI", titleColor: "#4b0082",
    tailMark: "orchid", engine: "#4b0082" },
  { id: "msr", name: "EgyptAir",           code: "MS", fuselage: "#f4f7fa", belly: "#e8edf2", tail: "#1e90c6",
    accent: "#c8a24a", cheat: "thin", titles: "EGYPTAIR", titleColor: "#1e90c6",
    tailMark: "horus", engine: "#1e90c6" },
  { id: "ita", name: "ITA Airways",        code: "AZ", fuselage: "#0068b5", belly: "#00559a", tail: "#0068b5",
    accent: "#ffffff", cheat: "none", titles: "ITA Airways", titleColor: "#ffffff",
    tailMark: "ita", engine: "#0068b5" },
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
    rangeKm: 1200,
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
    rangeKm: 2500,
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
    rangeKm: 6200,
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
    rangeKm: 5400,
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
    rangeKm: 13600,
    engineType: "jet",
    engineCount: 2,
    highWing: false,
    fixedGear: false,
    winglets: false,
    wide: true,
  },
  {
    id: "b748",
    name: "Boeing 747-8",
    class: "Wide-body Jet",
    length: 76.3,
    mass: 350000,
    wingArea: 554.0,
    maxThrust: 1184000,
    clSlope: 6.1,
    clMax: 1.4,
    alphaStall: rad(14),
    flapCl: 0.55,
    flapNotches: 5,
    cd0: 0.021,
    induced: 0.040,
    pitchAuthority: 0.55,
    vRotate: 175,
    vApproach: 155,
    cruiseAlt: 12000,
    rangeKm: 14300,
    engineType: "jet",
    engineCount: 4,
    highWing: false,
    fixedGear: false,
    winglets: true,
    wide: true,
    hump: true,
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
    rangeKm: 4000,
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
    rangeKm: 14100,
    engineType: "jet",
    engineCount: 2,
    highWing: false,
    fixedGear: false,
    winglets: true,
    wide: true,
  },
  {
    id: "a359",
    name: "Airbus A350-900",
    class: "Wide-body Jet",
    length: 66.8,
    mass: 217000,
    wingArea: 442.0,
    maxThrust: 750000,
    clSlope: 6.1,
    clMax: 1.42,
    alphaStall: rad(14),
    flapCl: 0.55,
    flapNotches: 5,
    cd0: 0.018,
    induced: 0.037,
    pitchAuthority: 0.62,
    vRotate: 160,
    vApproach: 145,
    cruiseAlt: 12000,
    rangeKm: 15000,
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
  { icao: "LTFM", iata: "IST", name: "Istanbul Airport",     city: "Istanbul",    lat: 41.2753,  lon: 28.7519,   elevation: 99,  runway: 4100,
    theme: { terrain: ["#6f8a44", "#4a6228"], sky: ["#7eb6d8", "#e4d6a8"], landmark: "mosque" } },
  { icao: "OTHH", iata: "DOH", name: "Doha Hamad",          city: "Doha",         lat: 25.2731,  lon: 51.6080,   elevation: 4,   runway: 4850,
    theme: { terrain: ["#d2b176", "#a3843c"], sky: ["#7ec2e8", "#f3e2b4"], landmark: "dhow" } },
  { icao: "LIRF", iata: "FCO", name: "Rome Fiumicino",      city: "Rome",         lat: 41.8003,  lon: 12.2389,   elevation: 5,   runway: 3903,
    theme: { terrain: ["#6a8a44", "#445a28"], sky: ["#8fb6d6", "#dce8f0"], landmark: "colosseum" } },
  { icao: "FACT", iata: "CPT", name: "Cape Town Intl",      city: "Cape Town",    lat: -33.9648, lon: 18.6017,   elevation: 46,  runway: 3201,
    theme: { terrain: ["#7a8a48", "#4e5e2c"], sky: ["#7eb8e0", "#e8f0f6"], landmark: "table" } },
  { icao: "KMIA", iata: "MIA", name: "Miami Intl",          city: "Miami",        lat: 25.7959,  lon: -80.2870,  elevation: 3,   runway: 3962,
    theme: { terrain: ["#6a9a4a", "#3e6a2c"], sky: ["#6db4e6", "#ffe0b0"], landmark: "palms" } },
  { icao: "SAEZ", iata: "EZE", name: "Buenos Aires Ezeiza", city: "Buenos Aires", lat: -34.8222, lon: -58.5358,  elevation: 21,  runway: 3300,
    theme: { terrain: ["#4f7a3a", "#2f4d24"], sky: ["#8ab6d0", "#d5e4ee"], landmark: "obelisk" } },
  { icao: "NZAA", iata: "AKL", name: "Auckland Intl",       city: "Auckland",     lat: -37.0082, lon: 174.7917,  elevation: 7,   runway: 3635,
    theme: { terrain: ["#3f7e3a", "#255022"], sky: ["#7eb6d8", "#dff0e8"], landmark: "skytower" } },
  { icao: "RKSI", iata: "ICN", name: "Seoul Incheon",       city: "Seoul",        lat: 37.4602,  lon: 126.4407,  elevation: 7,   runway: 4000,
    theme: { terrain: ["#4d7538", "#314e22"], sky: ["#8fb6d8", "#d8e6f0"], landmark: "namsan" } },
  { icao: "MMMX", iata: "MEX", name: "Mexico City Intl",    city: "Mexico City",  lat: 19.4363,  lon: -99.0721,  elevation: 2230, runway: 3963,
    theme: { terrain: ["#8a9a52", "#5f6f33"], sky: ["#6db4e6", "#ffd9a0"], landmark: "pyramid" } },
  { icao: "EKCH", iata: "CPH", name: "Copenhagen Kastrup",  city: "Copenhagen",   lat: 55.6180,  lon: 12.6508,   elevation: 5,   runway: 3600,
    theme: { terrain: ["#4e7f39", "#2c4a20"], sky: ["#9db3c2", "#cdd8df"], landmark: "nyhavn" } },
  { icao: "VTBS", iata: "BKK", name: "Bangkok Suvarnabhumi", city: "Bangkok",     lat: 13.6900,  lon: 100.7501,  elevation: 2,   runway: 4000,
    theme: { terrain: ["#3f8a4a", "#256b34"], sky: ["#6db4e6", "#ffe0b0"], landmark: "wat" } },
  { icao: "KSEA", iata: "SEA", name: "Seattle-Tacoma Intl", city: "Seattle",      lat: 47.4502,  lon: -122.3088, elevation: 132, runway: 3627,
    theme: { terrain: ["#3f6e3a", "#244a22"], sky: ["#8aa8c0", "#d4e0e8"], landmark: "needle" } },
  { icao: "FAOR", iata: "JNB", name: "Johannesburg OR Tambo", city: "Johannesburg", lat: -26.1392, lon: 28.2460, elevation: 1694, runway: 4418,
    theme: { terrain: ["#a89a54", "#6f6228"], sky: ["#8fbad6", "#e3ddc4"], landmark: "highveld" } },
  { icao: "VIDP", iata: "DEL", name: "Delhi Indira Gandhi", city: "Delhi",        lat: 28.5562,  lon: 77.1000,   elevation: 237, runway: 4430,
    theme: { terrain: ["#b89a4e", "#7a6224"], sky: ["#8fb8d8", "#f0e0b8"], landmark: "indiagate" } },
  { icao: "ZSPD", iata: "PVG", name: "Shanghai Pudong",     city: "Shanghai",     lat: 31.1443,  lon: 121.8083,  elevation: 4,   runway: 4000,
    theme: { terrain: ["#4d7538", "#314e22"], sky: ["#8fb6d8", "#d8e6f0"], landmark: "pearl" } },
  { icao: "SCEL", iata: "SCL", name: "Santiago Intl",       city: "Santiago",     lat: -33.3930, lon: -70.7858,  elevation: 474, runway: 3800,
    theme: { terrain: ["#3f6e3a", "#244a22"], sky: ["#8aa8c0", "#d4e0e8"], landmark: "andes" } },
  { icao: "VABB", iata: "BOM", name: "Mumbai Chhatrapati S.", city: "Mumbai",     lat: 19.0896,  lon: 72.8656,   elevation: 11,  runway: 3445,
    theme: { terrain: ["#8a9a52", "#5f6f33"], sky: ["#6db4e6", "#ffd9a0"], landmark: "gateway" } },
  { icao: "EIDW", iata: "DUB", name: "Dublin Intl",         city: "Dublin",       lat: 53.4264,  lon: -6.2499,   elevation: 74,  runway: 2637,
    theme: { terrain: ["#3e6f39", "#274b22"], sky: ["#9fb0bd", "#cbd6dd"], landmark: "castle" } },
  { icao: "KBOS", iata: "BOS", name: "Boston Logan",        city: "Boston",       lat: 42.3656,  lon: -71.0096,  elevation: 6,   runway: 3069,
    theme: { terrain: ["#4f7a3a", "#2f4d24"], sky: ["#7aa7d6", "#b9d3ea"], landmark: "boston" } },
  { icao: "HECA", iata: "CAI", name: "Cairo Intl",          city: "Cairo",        lat: 30.1219,  lon: 31.4056,   elevation: 116, runway: 4000,
    theme: { terrain: ["#d8b676", "#a9863f"], sky: ["#7fc0e8", "#f4e2b0"], landmark: "giza" } },
  { icao: "YMML", iata: "MEL", name: "Melbourne Intl",      city: "Melbourne",    lat: -37.6733, lon: 144.8433,  elevation: 132, runway: 3657,
    theme: { terrain: ["#6f9a44", "#4a6b2c"], sky: ["#7fbce8", "#dcefff"], landmark: "spire" } },
];

/* How many runways the field has. Most hubs in this set have 2+; only
 * explicitly-marked single-strip airports (training) stay at 1.
 * In the 2D view, 2+ draws an arrival runway left of the terminal
 * and a departure runway to the right. */
function airportRunwayCount(ap) {
  if (!ap) return 1;
  if (ap.runways != null) return ap.runways;
  return 2;
}

/* Airlines commonly seen parked at each airport (id → count), used to
 * populate the background gates. Rough real-world hub presence. */
const AIRLINE_BY_ID = Object.fromEntries(AIRLINES.map((a) => [a.id, a]));

function airlineNetworkId(id) {
  const al = AIRLINE_BY_ID[id];
  return (al && al.networkOf) || id;
}

/* Which of our airlines actually operate each type (mainline / regional
 * affiliate). Used so the livery picker only offers realistic paint. */
const AIRCRAFT_OPERATORS = {
  c172:  ["pvt"],
  dash8: ["aca", "qfa", "eth"],
  a320:  ["aal", "dal", "ual", "jbu", "baw", "dlh", "afr", "aca", "pgt", "thy", "ibe", "qtr", "lan", "sas", "aic", "cpa", "ana", "ezy", "anz", "tha", "msr", "ita"],
  b738:  ["aal", "dal", "ual", "swa", "klm", "qfa", "jal", "aca", "eth", "kqa", "ryr", "amx", "asa", "msr"],
  b77w:  ["aal", "ual", "baw", "afr", "klm", "uae", "sia", "qfa", "jal", "aca", "eth", "kqa", "thy", "qtr", "kal", "aic", "cpa", "ana", "tha"],
  b748:  ["dlh", "dlh100", "kal"],
  e175:  ["aal", "dal", "ual", "aca", "klm"],
  b789:  ["aal", "ual", "baw", "dlh", "afr", "klm", "sia", "qfa", "jal", "aca", "eth", "kqa", "thy", "qtr", "ibe", "lan", "kal", "aic", "amx", "ana", "vir", "anz", "tha", "msr"],
  a359:  ["dal", "afr", "dlh", "sia", "qtr", "jal", "ibe", "thy", "aca", "qfa", "lan", "sas", "kal", "cpa", "ana", "vir", "tha", "ita"],
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
  JFK: [["dal", 4], ["jbu", 3], ["aal", 3], ["ual", 1], ["vir", 1], ["baw", 1], ["ita", 1], ["afr", 1], ["dlh", 1], ["aca", 1], ["qtr", 1], ["thy", 1]],
  LGA: [["dal", 5], ["aal", 3], ["jbu", 3], ["swa", 2], ["ual", 1]],
  MIA: [["aal", 4], ["jbu", 3], ["lan", 3], ["dal", 2], ["ual", 1], ["swa", 1], ["thy", 1]],
  IST: [["thy", 8], ["pgt", 2], ["dlh", 1], ["baw", 1], ["afr", 1], ["klm", 1], ["uae", 1], ["qtr", 1], ["sia", 1], ["ita", 1]],
  LAX: [["aal", 3], ["ual", 3], ["dal", 2], ["asa", 2], ["swa", 1], ["jbu", 1], ["qfa", 1], ["aca", 1], ["lan", 1], ["thy", 1]],
  ORD: [["ual", 6], ["aal", 4], ["swa", 2], ["dlh", 1], ["aca", 1], ["thy", 1]],
  SFO: [["ual", 6], ["aal", 1], ["dal", 1], ["sia", 1], ["uae", 1], ["aca", 1], ["thy", 1]],
  YVR: [["aca", 7], ["ual", 2], ["aal", 1], ["dal", 1], ["jal", 1], ["qfa", 1], ["thy", 1]],
  FRA: [["dlh", 6], ["dlh100", 1], ["ual", 1], ["baw", 1], ["sia", 1], ["uae", 1], ["aca", 1], ["eth", 1], ["thy", 1], ["qtr", 1]],
  MUC: [["dlh", 7], ["ual", 1], ["baw", 1], ["afr", 1], ["klm", 1], ["aca", 1], ["eth", 1], ["thy", 1], ["ryr", 1]],
  LHR: [["baw", 5], ["vir", 2], ["dlh", 2], ["klm", 1], ["afr", 1], ["aal", 1], ["ita", 1], ["uae", 1], ["aca", 1], ["aic", 1], ["thy", 1], ["qtr", 1]],
  MAN: [["baw", 3], ["ezy", 3], ["ryr", 2], ["uae", 1], ["thy", 1], ["dlh", 1]],
  WAW: [["dlh", 2], ["thy", 2], ["ryr", 2], ["baw", 1], ["klm", 1], ["afr", 1]],
  CDG: [["afr", 6], ["klm", 2], ["dlh", 1], ["baw", 1], ["dal", 1], ["uae", 1], ["aca", 1], ["thy", 1], ["ibe", 1]],
  AMS: [["klm", 6], ["afr", 2], ["dlh", 1], ["baw", 1], ["dal", 1], ["uae", 1], ["kqa", 1], ["pgt", 1], ["thy", 1]],
  DXB: [["uae", 7], ["baw", 1], ["sia", 1], ["qfa", 1], ["eth", 1], ["kqa", 1], ["thy", 1], ["qtr", 1]],
  DOH: [["qtr", 8], ["baw", 1], ["thy", 1], ["sia", 1], ["uae", 1]],
  FCO: [["ita", 5], ["ibe", 2], ["ezy", 2], ["ryr", 2], ["afr", 1], ["dlh", 1], ["pgt", 1], ["thy", 1]],
  CPT: [["baw", 2], ["qtr", 2], ["eth", 1], ["kqa", 1], ["dlh", 1], ["afr", 1], ["thy", 1]],
  ADD: [["eth", 7], ["dlh", 1], ["uae", 1], ["baw", 1], ["afr", 1], ["klm", 1], ["qtr", 1], ["thy", 1]],
  NBO: [["kqa", 7], ["klm", 1], ["eth", 1], ["baw", 1], ["dlh", 1], ["uae", 1], ["thy", 1]],
  HND: [["jal", 4], ["ana", 4], ["sia", 1], ["ual", 1], ["qtr", 1], ["cpa", 1], ["thy", 1]],
  SIN: [["sia", 6], ["uae", 1], ["baw", 1], ["qfa", 1], ["dlh", 1], ["jal", 1], ["qtr", 1], ["thy", 1]],
  SYD: [["qfa", 6], ["uae", 1], ["sia", 1], ["ual", 1], ["qtr", 1], ["thy", 1]],
  AKL: [["anz", 6], ["qfa", 2], ["sia", 1], ["ual", 1]],
  ICN: [["kal", 7], ["jal", 2], ["sia", 1], ["dlh", 1], ["ual", 1], ["qtr", 1], ["thy", 1]],
  MEX: [["amx", 6], ["aal", 2], ["ual", 1], ["lan", 1], ["dal", 1], ["thy", 1]],
  CPH: [["sas", 7], ["dlh", 1], ["baw", 1], ["klm", 1], ["afr", 1], ["thy", 1]],
  BKK: [["tha", 6], ["sia", 1], ["qtr", 1], ["kal", 1], ["qfa", 1], ["aic", 1], ["thy", 1]],
  SEA: [["asa", 6], ["ual", 2], ["aal", 1], ["dal", 1], ["aca", 1], ["thy", 1]],
  JNB: [["eth", 3], ["baw", 2], ["qtr", 2], ["kqa", 2], ["dlh", 1], ["afr", 1], ["thy", 1]],
  DEL: [["aic", 7], ["qtr", 2], ["uae", 1], ["baw", 1], ["sia", 1], ["thy", 1]],
  BOM: [["aic", 6], ["qtr", 2], ["uae", 1], ["sia", 1], ["baw", 1], ["thy", 1]],
  DUB: [["ryr", 4], ["ezy", 3], ["baw", 2], ["aal", 1], ["sas", 1], ["thy", 1]],
  BOS: [["jbu", 3], ["dal", 3], ["aal", 2], ["ual", 1], ["ita", 1], ["asa", 1], ["vir", 1], ["thy", 1]],
  CAI: [["msr", 6], ["uae", 1], ["qtr", 1], ["dlh", 1], ["afr", 1], ["thy", 1]],
  MEL: [["qfa", 5], ["anz", 2], ["sia", 1], ["uae", 1], ["tha", 1], ["thy", 1]],
  PVG: [["kal", 3], ["cpa", 2], ["jal", 1], ["sia", 1], ["ana", 1], ["qtr", 1], ["thy", 1]],
  SCL: [["lan", 6], ["ibe", 2], ["aal", 1], ["afr", 1], ["dal", 1], ["thy", 1]],
  GRU: [["lan", 5], ["aal", 2], ["ual", 1], ["dlh", 1], ["afr", 1], ["klm", 1], ["ibe", 1], ["thy", 1]],
  EZE: [["lan", 6], ["ibe", 2], ["aal", 1], ["afr", 1], ["qtr", 1], ["thy", 1]],
  YYZ: [["aca", 7], ["ual", 1], ["aal", 1], ["baw", 1], ["dlh", 1], ["afr", 1], ["thy", 1]],
  MAD: [["ibe", 5], ["ezy", 2], ["ryr", 2], ["afr", 1], ["baw", 1], ["lan", 1], ["thy", 1]],
  HKG: [["cpa", 6], ["sia", 1], ["uae", 1], ["qfa", 1], ["jal", 1], ["ana", 1], ["thy", 1]],
};

/* Types that actually operate at each field (subset of AIRCRAFT_TYPES). */
const AIRPORT_TYPES = {
  JFK: ["a320", "b738", "e175", "b789", "a359", "b77w", "b748"],
  LGA: ["a320", "b738", "e175"],
  MIA: ["a320", "b738", "b789", "b77w", "b748"],
  IST: ["a320", "b738", "b789", "a359", "b77w"],
  LAX: ["a320", "b738", "b789", "a359", "b77w", "b748"],
  ORD: ["a320", "b738", "e175", "b77w", "b789", "b748"],
  SFO: ["a320", "b738", "b789", "b77w", "a359", "b748"],
  YVR: ["a320", "b738", "dash8", "b789", "b77w"],
  FRA: ["a320", "b789", "a359", "b77w", "b748"],
  MUC: ["a320", "b738", "b789", "a359"],
  LHR: ["a320", "b789", "a359", "b77w"],
  MAN: ["a320", "b738", "b77w", "b789"],
  WAW: ["a320", "b738"],
  CDG: ["a320", "b77w", "b789", "a359"],
  AMS: ["b738", "a320", "e175", "b77w", "b789"],
  DXB: ["b77w", "b789", "a359", "b738"],
  DOH: ["a359", "b77w", "a320", "b789"],
  FCO: ["a320", "b738", "a359", "b789"],
  CPT: ["b789", "a359", "b77w", "a320"],
  ADD: ["b789", "b77w", "a359", "b738", "dash8"],
  NBO: ["b738", "b789", "b77w"],
  HND: ["a320", "b77w", "b789", "a359", "b748"],
  SIN: ["a359", "b77w", "b789", "b748"],
  SYD: ["b738", "b789", "a359", "b77w"],
  AKL: ["a320", "b789"],
  ICN: ["b77w", "b789", "a359", "a320", "b748"],
  MEX: ["b738", "b789", "a320", "b748"],
  CPH: ["a320", "a359", "b738"],
  BKK: ["a320", "b77w", "b789", "a359", "b748"],
  SEA: ["b738", "a320", "b77w", "b789"],
  JNB: ["b789", "a359", "b77w", "a320"],
  DEL: ["a320", "b789", "b77w", "b748"],
  BOM: ["a320", "b789", "b77w", "b748"],
  DUB: ["b738", "a320"],
  BOS: ["a320", "b738", "e175", "b789", "a359"],
  CAI: ["a320", "b738", "b77w", "b789"],
  MEL: ["b738", "b789", "a359"],
  GRU: ["a320", "b789", "a359", "b748"],
  EZE: ["a320", "b789"],
  YYZ: ["a320", "e175", "b789", "b77w", "dash8", "b748"],
  MAD: ["a320", "b738", "a359", "b789"],
  HKG: ["a359", "b77w", "a320", "b789", "b748"],
  PVG: ["a320", "b77w", "b789", "a359", "b748"],
  SCL: ["a320", "b789", "a359"],
};

/* Home fields — there the airline flies its mixed fleet. Elsewhere a
 * long-haul carrier only shows the widebodies it actually brings. */
const AIRLINE_HUBS = {
  aal: ["JFK", "LGA", "LAX", "ORD", "MIA", "BOS"],
  dal: ["JFK", "LGA", "LAX", "BOS", "SEA", "MIA"],
  ual: ["JFK", "LGA", "LAX", "ORD", "SFO", "SEA", "BOS"],
  jbu: ["JFK", "LGA", "BOS", "MIA"],
  swa: ["LAX", "ORD", "MIA", "LGA"],
  baw: ["LHR", "MAN"],
  vir: ["LHR"],
  ezy: ["MAN", "DUB", "FCO", "MAD"],
  ryr: ["DUB", "MAN", "WAW", "FCO", "MAD", "MUC"],
  dlh: ["FRA", "MUC"],
  dlh100: ["FRA"],
  afr: ["CDG"],
  klm: ["AMS"],
  uae: ["DXB"],
  sia: ["SIN"],
  qfa: ["SYD", "MEL"],
  jal: ["HND"],
  ana: ["HND"],
  aca: ["YVR", "YYZ"],
  eth: ["ADD"],
  kqa: ["NBO"],
  pgt: ["IST"],
  thy: ["IST"],
  qtr: ["DOH"],
  ibe: ["MAD"],
  lan: ["SCL", "GRU", "EZE", "MIA"],
  kal: ["ICN"],
  sas: ["CPH"],
  aic: ["DEL", "BOM"],
  amx: ["MEX"],
  cpa: ["HKG"],
  asa: ["SEA", "LAX"],
  anz: ["AKL"],
  tha: ["BKK"],
  msr: ["CAI"],
  ita: ["FCO"],
};

/* Real nonstop hops among airports in this sim.
 * Hub → dest only. Two outstations of the same hub are not a route
 * (Qatar JFK and LHR does not mean Qatar flies JFK–LHR).
 * Pegasus is based at SAW in real life; this sim’s Istanbul field is IST,
 * so their European network is attached there. Ryanair stays off IST. */
const AIRLINE_SPOKES = {
  aal: {
    JFK: ["LGA", "BOS", "MIA", "ORD", "LAX", "SFO", "LHR", "CDG", "MAD", "FCO", "DUB", "MEX", "GRU"],
    LGA: ["JFK", "BOS", "MIA", "ORD", "MEX", "YYZ"],
    LAX: ["JFK", "ORD", "SFO", "MIA", "LHR", "HND", "SYD", "MEX", "BOS"],
    ORD: ["JFK", "LGA", "LAX", "SFO", "MIA", "LHR", "CDG", "FRA", "MEX", "DUB"],
    MIA: ["JFK", "LGA", "LAX", "ORD", "MAD", "GRU", "EZE", "MEX", "LHR", "BOS"],
    BOS: ["JFK", "LGA", "LHR", "MIA", "LAX", "ORD", "DUB"],
  },
  dal: {
    JFK: ["LGA", "BOS", "MIA", "LAX", "SFO", "LHR", "CDG", "AMS", "FCO", "FRA", "DUB", "MEX"],
    LGA: ["JFK", "BOS", "MIA", "ORD", "MEX", "YYZ"],
    LAX: ["JFK", "SEA", "SFO", "HND", "SYD", "MEX"],
    BOS: ["JFK", "LGA", "AMS", "LHR", "DUB", "MIA"],
    SEA: ["LAX", "HND", "ICN", "AMS", "LHR", "JFK", "SFO"],
    MIA: ["JFK", "LGA", "LAX", "BOS"],
  },
  ual: {
    JFK: ["LHR", "FRA", "SFO", "LAX", "ORD"],
    LGA: ["ORD", "YYZ"],
    LAX: ["SFO", "ORD", "JFK", "HND", "SYD", "LHR", "FRA", "ICN", "MEX"],
    ORD: ["LHR", "FRA", "CDG", "FCO", "AMS", "LAX", "SFO", "JFK", "LGA", "MEX", "GRU"],
    SFO: ["LAX", "ORD", "JFK", "LHR", "FRA", "HND", "ICN", "SIN", "SYD"],
    SEA: ["SFO", "LAX", "ORD", "LHR", "FRA", "HND"],
    BOS: ["ORD", "LHR", "SFO", "LAX"],
  },
  swa: {
    LAX: ["LGA", "MIA", "BOS", "SEA", "SFO", "ORD"],
    LGA: ["LAX", "MIA", "BOS", "ORD"],
    MIA: ["LAX", "LGA", "BOS", "ORD"],
    BOS: ["LAX", "LGA", "MIA", "SEA", "ORD"],
    SEA: ["LAX", "BOS", "SFO"],
    SFO: ["LAX", "SEA"],
    ORD: ["LAX", "LGA", "MIA", "BOS"],
  },
  jbu: {
    JFK: ["LGA", "BOS", "MIA", "LAX", "SFO", "LHR", "CDG", "AMS", "DUB", "FCO", "MAD"],
    LGA: ["JFK", "BOS", "MIA"],
    BOS: ["JFK", "LGA", "MIA", "LHR", "DUB"],
    MIA: ["JFK", "LGA", "BOS", "LAX"],
  },
  baw: {
    LHR: ["JFK", "BOS", "MIA", "LAX", "SFO", "ORD", "SEA", "YVR", "YYZ", "MEX", "MAD", "FCO",
      "AMS", "CDG", "FRA", "MUC", "DUB", "CPH", "WAW", "IST", "DXB", "DOH", "HND", "SIN", "SYD",
      "HKG", "DEL", "BOM", "JNB", "CPT", "CAI", "GRU", "EZE", "BKK", "NBO", "MAN"],
    MAN: ["JFK", "DXB", "DUB", "AMS", "CDG", "MUC", "JNB", "LHR"],
  },
  vir: {
    LHR: ["JFK", "BOS", "LAX", "SFO", "MIA", "SEA", "DEL", "JNB", "CPT"],
  },
  ezy: {
    MAN: ["AMS", "CDG", "MUC", "FCO", "MAD", "DUB", "CPH", "WAW", "IST"],
    DUB: ["AMS", "CDG", "MAN", "FCO", "MAD", "MUC", "IST"],
    FCO: ["AMS", "CDG", "MAN", "DUB", "MAD", "MUC", "CPH"],
    MAD: ["AMS", "CDG", "FCO", "MAN", "DUB", "MUC"],
  },
  ryr: {
    FCO: ["DUB", "MAN", "MAD", "WAW", "MUC", "CPH"],
    DUB: ["MAN", "MAD", "WAW", "FCO", "MUC"],
    MAN: ["DUB", "MAD", "WAW", "FCO", "MUC"],
    MAD: ["DUB", "MAN", "WAW", "FCO", "MUC"],
    WAW: ["DUB", "MAN", "MAD", "FCO", "MUC"],
    MUC: ["DUB", "MAN", "MAD", "FCO", "WAW"],
  },
  dlh: {
    FRA: ["JFK", "BOS", "MIA", "LAX", "SFO", "ORD", "YYZ", "YVR", "LHR", "AMS", "CDG", "FCO",
      "MAD", "MUC", "DUB", "CPH", "WAW", "IST", "DXB", "DOH", "HND", "SIN", "ICN", "DEL", "BOM",
      "JNB", "CPT", "CAI", "GRU", "EZE", "BKK", "PVG", "ADD", "HKG", "MEX"],
    MUC: ["JFK", "BOS", "LAX", "SFO", "LHR", "AMS", "CDG", "FCO", "MAD", "FRA", "DUB", "CPH",
      "WAW", "IST", "DXB", "HND", "DEL", "CAI"],
  },
  afr: {
    CDG: ["JFK", "BOS", "MIA", "LAX", "SFO", "ORD", "YYZ", "LHR", "AMS", "FRA", "MUC", "FCO",
      "MAD", "DUB", "CPH", "WAW", "IST", "DXB", "DOH", "HND", "SIN", "DEL", "BOM", "JNB", "CPT",
      "CAI", "GRU", "EZE", "MEX", "ADD", "NBO", "BKK", "HKG"],
  },
  klm: {
    AMS: ["JFK", "BOS", "MIA", "LAX", "SFO", "ORD", "YYZ", "LHR", "CDG", "FRA", "MUC", "FCO",
      "MAD", "DUB", "CPH", "WAW", "IST", "DXB", "HND", "SIN", "DEL", "BOM", "JNB", "CPT", "CAI",
      "GRU", "MEX", "ADD", "NBO", "BKK", "HKG"],
  },
  uae: {
    DXB: ["JFK", "BOS", "LAX", "SFO", "ORD", "YYZ", "LHR", "MAN", "CDG", "AMS", "FRA", "MUC",
      "FCO", "MAD", "DUB", "CPH", "IST", "HND", "SIN", "SYD", "MEL", "AKL", "ICN", "HKG", "PVG",
      "BKK", "DEL", "BOM", "JNB", "CPT", "CAI", "ADD", "NBO", "GRU", "MEX"],
  },
  sia: {
    SIN: ["LHR", "CDG", "FRA", "AMS", "FCO", "IST", "JFK", "SFO", "LAX", "HND", "ICN", "HKG", "PVG",
      "BKK", "DEL", "BOM", "SYD", "MEL", "AKL", "DXB", "DOH", "JNB", "CPT"],
  },
  qfa: {
    SYD: ["MEL", "AKL", "SIN", "HKG", "HND", "LAX", "SFO", "YVR", "DXB", "BKK"],
    MEL: ["SYD", "AKL", "SIN", "HKG", "DXB", "LAX"],
  },
  jal: {
    HND: ["JFK", "BOS", "LAX", "SFO", "ORD", "YVR", "LHR", "CDG", "FRA", "SIN", "HKG",
      "ICN", "BKK", "SYD", "MEL", "AKL", "DXB"],
  },
  ana: {
    HND: ["JFK", "LAX", "SFO", "ORD", "SEA", "YVR", "LHR", "FRA", "MUC", "SIN", "HKG", "ICN",
      "BKK", "SYD", "MEL"],
  },
  aca: {
    YVR: ["YYZ", "LAX", "SFO", "SEA", "HND", "ICN", "SYD", "HKG", "LHR", "FRA", "CDG"],
    YYZ: ["YVR", "JFK", "LGA", "BOS", "ORD", "LAX", "MIA", "LHR", "CDG", "FRA", "FCO"],
  },
  eth: {
    ADD: ["JFK", "ORD", "LHR", "CDG", "FRA", "FCO", "AMS", "MAD", "IST", "DXB", "DOH", "NBO", "JNB",
      "CPT", "CAI", "BOM", "DEL", "BKK", "HKG", "GRU"],
  },
  kqa: {
    NBO: ["AMS", "LHR", "CDG", "FRA", "IST", "DXB", "DOH", "ADD", "JNB", "CPT", "CAI", "BOM"],
  },
  pgt: {
    IST: ["AMS", "FCO", "MUC", "MAD", "DUB", "CPH", "WAW", "MAN", "FRA", "CDG"],
  },
  thy: {
    IST: ["JFK", "BOS", "MIA", "LAX", "SFO", "ORD", "SEA", "YYZ", "YVR", "MEX",
      "LHR", "MAN", "AMS", "CDG", "FRA", "MUC", "WAW", "MAD", "FCO", "DUB", "CPH",
      "DXB", "DOH", "CAI", "ADD", "NBO", "JNB", "CPT",
      "HND", "SIN", "ICN", "HKG", "PVG", "BKK", "DEL", "BOM",
      "SYD", "MEL", "GRU", "EZE", "SCL"],
  },
  qtr: {
    DOH: ["JFK", "BOS", "MIA", "LAX", "SFO", "ORD", "YYZ", "LHR", "CDG", "AMS", "FRA", "MUC",
      "FCO", "MAD", "DUB", "CPH", "IST", "HND", "SIN", "SYD", "MEL", "AKL", "ICN", "HKG", "PVG",
      "BKK", "DEL", "BOM", "JNB", "CPT", "CAI", "ADD", "NBO", "GRU", "EZE", "MEX", "DXB"],
  },
  ibe: {
    MAD: ["JFK", "BOS", "MIA", "LAX", "MEX", "GRU", "EZE", "SCL", "LHR", "CDG", "AMS", "FRA",
      "FCO", "DUB", "CPH", "IST"],
  },
  lan: {
    SCL: ["GRU", "EZE", "MIA", "MAD", "JFK", "LAX", "MEX"],
    GRU: ["SCL", "EZE", "MIA", "MAD", "JFK", "FCO", "MEX"],
    EZE: ["SCL", "GRU", "MIA", "MAD"],
    MIA: ["SCL", "GRU", "EZE", "JFK", "MAD"],
  },
  kal: {
    ICN: ["JFK", "LAX", "SFO", "SEA", "YVR", "LHR", "CDG", "FRA", "AMS", "FCO", "IST", "HND", "SIN",
      "HKG", "PVG", "BKK", "SYD", "DXB", "DOH"],
  },
  sas: {
    CPH: ["JFK", "BOS", "SFO", "LHR", "MAN", "AMS", "CDG", "FRA", "MUC", "FCO", "MAD",
      "DUB", "WAW", "IST"],
  },
  aic: {
    DEL: ["JFK", "SFO", "LHR", "CDG", "FRA", "AMS", "FCO", "IST", "DXB", "DOH", "SIN", "HKG", "BKK",
      "BOM", "SYD"],
    BOM: ["JFK", "LHR", "CDG", "FRA", "DXB", "DOH", "SIN", "HKG", "DEL"],
  },
  amx: {
    MEX: ["JFK", "LGA", "LAX", "ORD", "MIA", "MAD", "CDG", "GRU", "SCL"],
  },
  cpa: {
    HKG: ["JFK", "BOS", "LAX", "SFO", "YVR", "LHR", "CDG", "FRA", "AMS", "FCO", "IST", "HND", "ICN",
      "SIN", "BKK", "DEL", "BOM", "SYD", "MEL", "AKL", "DXB", "PVG"],
  },
  asa: {
    SEA: ["LAX", "SFO", "JFK", "BOS", "ORD", "HND", "ICN"],
    LAX: ["SEA", "SFO", "JFK", "HND"],
  },
  anz: {
    AKL: ["SYD", "MEL", "SIN", "HKG", "HND", "LAX", "SFO", "YVR", "LHR", "PVG"],
  },
  tha: {
    BKK: ["LHR", "CDG", "FRA", "FCO", "AMS", "IST", "HND", "ICN", "HKG", "SIN", "SYD", "MEL", "DEL",
      "BOM", "DXB", "JFK"],
  },
  msr: {
    CAI: ["JFK", "LHR", "CDG", "FRA", "FCO", "AMS", "MAD", "IST", "DXB", "DOH", "JNB", "ADD", "NBO"],
  },
  ita: {
    FCO: ["LHR", "CDG", "AMS", "FRA", "MUC", "MAD", "MAN", "DUB", "CPH", "WAW", "CAI", "IST",
      "JFK", "BOS", "MIA", "LAX", "EZE", "GRU", "HND", "DEL", "DXB"],
  },
};

const WIDEBODY_IDS = new Set(["b77w", "b789", "a359", "b748"]);

function typesAtAirportForAirline(iata, airlineId) {
  const field = AIRPORT_TYPES[iata] || ["a320", "b738"];
  let types = field.filter((tid) => (AIRCRAFT_OPERATORS[tid] || []).includes(airlineId));
  const atHome = (AIRLINE_HUBS[airlineNetworkId(airlineId)] || []).includes(iata);
  const wides = types.filter((tid) => WIDEBODY_IDS.has(tid));
  if (!atHome && wides.length) types = wides;
  return types;
}

/* Weighted (airline, type) pairs that actually operate at this airport.
 * opts.avoid: skip these "airlineId|typeId" keys when others exist.
 * opts.airlineId: only this carrier (hub seed). */
function pickAirportTraffic(airport, excludeId, opts) {
  opts = opts || {};
  const iata = airport.iata;
  const specById = Object.fromEntries(AIRCRAFT_TYPES.map((t) => [t.id, t]));
  const avoid = opts.avoid || new Set();
  const forceId = opts.airlineId || null;

  const build = (useAvoid) => {
    const pairs = [];
    for (const [id, count] of (AIRPORT_FLEETS[iata] || [])) {
      if (id === excludeId || id === "pvt") continue;
      if (forceId && id !== forceId) continue;
      const al = AIRLINE_BY_ID[id];
      if (!al) continue;
      const types = typesAtAirportForAirline(iata, id);
      for (const tid of types) {
        const spec = specById[tid];
        if (!spec) continue;
        if (useAvoid && avoid.has(id + "|" + tid)) continue;
        for (let n = 0; n < count; n++) pairs.push({ spec, airline: al });
      }
    }
    return pairs;
  };

  let pairs = build(true);
  if (!pairs.length) pairs = build(false);
  if (!pairs.length) {
    const tid = (AIRPORT_TYPES[iata] || ["a320"])[0];
    return { spec: specById[tid] || AIRCRAFT_TYPES[2], airline: AIRLINES[0] };
  }
  return pairs[Math.floor(Math.random() * pairs.length)];
}

/* Plain, liveryless aircraft scheme + a neutral field for Training Mode. */
const TRAINING_AIRLINE = {
  id: "train", name: "Training", code: "TRN",
  fuselage: "#d9dee4", belly: "#c5ccd4", tail: "#c2c8d0",
  accent: "#aeb6c1", cheat: "none", titles: "", titleColor: "#8a93a0",
  tailMark: "none", engine: "#c5ccd4",
};
const TRAINING_AIRPORT = {
  icao: "TRNG", iata: "TRN", name: "Training Field", city: "Training",
  lat: 0, lon: 0, elevation: 0, runway: 4000, runways: 1,
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
  KJFK: "na", KLGA: "na", KLAX: "na", KORD: "na", KSFO: "na", CYVR: "na", CYYZ: "na", KMIA: "na", MMMX: "na", KSEA: "na", KBOS: "na",
  EGLL: "eu", EGCC: "eu", LFPG: "eu", EDDF: "eu", EDDM: "eu", EHAM: "eu", LEMD: "eu", LTFM: "eu", EPWA: "eu", LIRF: "eu", EKCH: "eu", EIDW: "eu",
  OMDB: "me", OTHH: "me",
  RJTT: "asia", WSSS: "asia", VHHH: "asia", RKSI: "asia", VTBS: "asia", VIDP: "asia", ZSPD: "asia", VABB: "asia",
  YSSY: "oceania", NZAA: "oceania", YMML: "oceania",
  SBGR: "sa", SAEZ: "sa", SCEL: "sa",
  HAAB: "af", HKJK: "af", FACT: "af", FAOR: "af", HECA: "af",
};

/* Continent zoom windows for the route map. lon/lat bounds in degrees. */
const MAP_ZOOMS = [
  { id: "na",  label: "North America", short: "N. America", lon0: -130, lon1: -65,  lat0: 14,  lat1: 55 },
  { id: "sa",  label: "South America", short: "S. America", lon0: -85,  lon1: -32,  lat0: -56, lat1: 14 },
  { id: "eu",  label: "Europe",        short: "Europe",     lon0: -12,  lon1: 36,   lat0: 35,  lat1: 61 },
  { id: "af",  label: "Africa",        short: "Africa",     lon0: -20,  lon1: 54,   lat0: -38, lat1: 38 },
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

/* Hub → dest only. Two outstations of the same hub are not a route. */
function airlineServesHop(id, a, b) {
  const net = AIRLINE_SPOKES[airlineNetworkId(id)];
  if (!net) return false;
  return (net[a] || []).includes(b) || (net[b] || []).includes(a);
}

/* Airline + type pairs that actually fly from → to. */
function operatorsOnRoute(fromAp, toAp) {
  if (!fromAp || !toAp || fromAp.iata === toAp.iata) return [];
  const fromIata = fromAp.iata, toIata = toAp.iata;
  const km = routeDistanceKm(fromAp, toAp);
  const specById = Object.fromEntries(AIRCRAFT_TYPES.map((t) => [t.id, t]));
  const fieldA = new Set(AIRPORT_TYPES[fromIata] || ["a320"]);
  const fieldB = new Set(AIRPORT_TYPES[toIata] || ["a320"]);
  const pairs = [];
  const seen = new Set();
  const ids = new Set(Object.keys(AIRLINE_SPOKES));
  for (const al of AIRLINES) {
    if (al.networkOf) ids.add(al.id);
  }

  for (const id of ids) {
    if (!airlineServesHop(id, fromIata, toIata)) continue;
    const al = AIRLINE_BY_ID[id];
    if (!al) continue;
    for (const tid of fieldA) {
      if (!fieldB.has(tid)) continue;
      if (!((AIRCRAFT_OPERATORS[tid] || []).includes(id))) continue;
      const spec = specById[tid];
      if (!spec) continue;
      if (km > (spec.rangeKm || 8000) * 1.06) continue;
      /* Transatlantic A320ceo is not a thing in this set; JetBlue's A321LR
       * is the A320 stand-in that actually does JFK–LHR. */
      if (km > 4500 && !WIDEBODY_IDS.has(tid) && id !== "jbu") continue;
      const key = id + "|" + tid;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ airline: al, spec });
    }
  }
  return pairs;
}

function typesOnRoute(fromAp, toAp) {
  const types = [];
  const seen = new Set();
  for (const p of operatorsOnRoute(fromAp, toAp)) {
    if (seen.has(p.spec.id)) continue;
    seen.add(p.spec.id);
    types.push(p.spec);
  }
  return types;
}

function liveriesOnRoute(fromAp, toAp, spec) {
  if (!spec) return [];
  return operatorsOnRoute(fromAp, toAp)
    .filter((p) => p.spec.id === spec.id)
    .map((p) => p.airline);
}

/* Loading-screen tips. `tags` let the loader prefer advice that matches
 * the upcoming flight (takeoff, landing, jet, training, etc.). */
const LOADING_TIPS = [
  { tags: ["pitch"], text: "Pitch is yoke-style: pull ↓ / S to raise the nose, push ↑ / W to lower it." },
  { tags: ["takeoff", "route"], text: "You spawn on the numbers, already cleared. Flaps (F), throttle up (D), and rotate (pull ↓) near V_R." },
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
  { tags: ["freecam"], text: "Free Cam has no aircraft. Pan with WASD or arrows, drag the view, scroll to look up at the sky, and zoom with Q/E." },
  { tags: ["freecam"], text: "Watch airliners appear at the gates, taxi out and take off, or land and taxi back to a stand." },
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
  if (config.freeCam) {
    wanted.add("freecam");
  } else {
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
  }

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

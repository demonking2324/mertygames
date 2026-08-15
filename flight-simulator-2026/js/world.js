/* ============================================================
 * World — terrain, runways, clouds, and background rendering.
 *
 * The real great-circle distance can be thousands of km, which is
 * not fun to fly in real time, so we compress it into a flyable
 * in-game distance while still displaying the true distance in the HUD.
 * ============================================================ */

/* Default land biome for each region, used to color the terrain near an
 * airport and along the en-route portions of a flight. */
const REGION_BIOME = {
  na: "plains", eu: "meadow", me: "desert",
  asia: "forest", oceania: "plains", sa: "tropical", af: "savanna",
};

/* Surface (top) and deep (bottom) ground colors per biome. */
const BIOME_COLORS = {
  plains:    { top: "#5c8a3c", bot: "#33501e" },
  meadow:    { top: "#4f7f39", bot: "#2c4a20" },
  forest:    { top: "#3a6531", bot: "#1e3a1b" },
  desert:    { top: "#d8b676", bot: "#a5813c" },
  tropical:  { top: "#3f8a4a", bot: "#20522c" },
  savanna:   { top: "#b89a4e", bot: "#7a6224" },
  hills:     { top: "#5c8140", bot: "#334c1f" },
  mountains: { top: "#6c7360", bot: "#3d4436" },
  ocean:     { top: "#3f6f95", bot: "#173a5c" },
};

class World {
  constructor(depAirport, arrAirport, opts) {
    opts = opts || {};
    this.singleField = !!opts.singleField;
    this.liveApron = false;
    this.dep = depAirport;
    this.arr = arrAirport;
    this.depTheme = depAirport.theme;
    this.arrTheme = arrAirport.theme;

    // Runways drawn a bit longer than the raw field length for extra room.
    this.runwayScale = 1.35;
    this.depRunwayStart = 0;
    this.depRunwayEnd = depAirport.runway * this.runwayScale;

    // Flat ground at departure elevation keeps the collision model simple.
    this.groundElevation = depAirport.elevation;

    if (this.singleField) {
      this.realDistanceKm = 0;
      this.distance = this.depRunwayEnd + 3200;
      this.arrRunwayStart = this.depRunwayStart;
      this.arrRunwayEnd = this.depRunwayEnd;
      this.crossesOcean = false;
      this.oceanStart = null;
      this.oceanEnd = null;
    } else {
      this.realDistanceKm = routeDistanceKm(depAirport, arrAirport);
      // Compressed, flyable distance (meters). Short hops stay short,
      // long hauls are capped so a flight lasts minutes, not hours.
      this.distance = 8000 + Math.min(this.realDistanceKm, 16000) * 8;
      this.arrRunwayStart = this.distance;
      this.arrRunwayEnd = this.distance + arrAirport.runway * this.runwayScale;
      this.crossesOcean = routeCrossesOcean(depAirport, arrAirport);
      this.oceanStart = this.crossesOcean ? this.distance * 0.16 : null;
      this.oceanEnd = this.crossesOcean ? this.distance * 0.84 : null;
    }

    // Biome bands describe the terrain the whole way along the route.
    this.bands = this._buildBands(depAirport, arrAirport);

    this.clouds = this._makeClouds();
  }

  /* Ordered terrain bands (world x) for the route: home biome near each
   * airport, ocean or a mountain/hill spine in between. */
  _buildBands(dep, arr) {
    const bDep = REGION_BIOME[AIRPORT_REGION[dep.icao]] || "plains";
    const bArr = REGION_BIOME[AIRPORT_REGION[arr.icao]] || "plains";
    const D = this.distance;
    const far = 60000; // extend past the ends so ground is always covered

    if (this.singleField) {
      return [{ x0: -far, x1: D + far, biome: bDep }];
    }

    if (this.crossesOcean) {
      return [
        { x0: -far, x1: D * 0.16, biome: bDep },
        { x0: D * 0.16, x1: D * 0.84, biome: "ocean" },
        { x0: D * 0.84, x1: D + far, biome: bArr },
      ];
    }
    // Land route: a mountain range on longer hops, rolling hills on short ones.
    const mid = this.distance > 22000 ? "mountains" : "hills";
    return [
      { x0: -far, x1: D * 0.34, biome: bDep },
      { x0: D * 0.34, x1: D * 0.62, biome: mid },
      { x0: D * 0.62, x1: D + far, biome: bArr },
    ];
  }

  _biomeAt(wx) {
    const b = this.bands;
    for (let i = 0; i < b.length; i++) if (wx < b[i].x1) return b[i].biome;
    return b[b.length - 1].biome;
  }

  _makeClouds() {
    const clouds = [];
    const span = this.distance + 20000;
    for (let i = 0; i < 60; i++) {
      clouds.push({
        x: -5000 + Math.random() * span,
        alt: 500 + Math.random() * 10500,
        r: 40 + Math.random() * 120,
        p: 0.4 + Math.random() * 0.5, // parallax factor
      });
    }
    return clouds;
  }

  /* 0 at departure, 1 at arrival — used to blend terrain and sky. */
  _progress(cam) { return clamp(cam.x / this.distance, 0, 1); }

  render(ctx, cam) {
    this._drawSky(ctx, cam);
    this._drawClouds(ctx, cam);
    this._drawGround(ctx, cam);
    // Scenery/landmarks sit behind the runways.
    this._drawScenery(ctx, cam, this.depTheme, this.depRunwayStart - 900);
    if (!this.singleField) {
      this._drawScenery(ctx, cam, this.arrTheme, this.arrRunwayEnd + 900);
    }
    this._drawGates(ctx, cam, this.dep, this.depRunwayStart, -1);
    if (!this.singleField) {
      this._drawGates(ctx, cam, this.arr, this.arrRunwayEnd, 1);
    }
    this._drawRunway(ctx, cam, this.depRunwayStart, this.depRunwayEnd, this.dep, true);
    if (!this.singleField) {
      this._drawRunway(ctx, cam, this.arrRunwayStart, this.arrRunwayEnd, this.arr, false);
      this._drawDistanceMarkers(ctx, cam);
    }
  }

  _drawSky(ctx, cam) {
    const p = this._progress(cam);
    // Horizon colors blend from departure to arrival airport theme.
    const skyTop = mixColor(hexToRgb(this.depTheme.sky[0]), hexToRgb(this.arrTheme.sky[0]), p);
    const skyBot = mixColor(hexToRgb(this.depTheme.sky[1]), hexToRgb(this.arrTheme.sky[1]), p);

    // Sky darkens toward space with altitude (top of screen = higher air).
    const topAlt = cam.y + (cam.h / 2) / cam.scale;
    const t = clamp(topAlt / 14000, 0, 1);
    const top = mixColor([9, 16, 40], skyTop, 1 - t);
    const bot = mixColor([70, 110, 150], skyBot, 1 - clamp(cam.y / 14000, 0, 1));

    const grad = ctx.createLinearGradient(0, 0, 0, cam.h);
    grad.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
    grad.addColorStop(1, `rgb(${bot[0]},${bot[1]},${bot[2]})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }

  _drawClouds(ctx, cam) {
    ctx.save();
    for (const c of this.clouds) {
      const sx = cam.worldToScreenX(c.x);
      const sy = cam.worldToScreenY(c.alt);
      if (sx < -300 || sx > cam.w + 300 || sy < -200 || sy > cam.h + 200) continue;
      const r = cam.toScreenLen(c.r);
      ctx.globalAlpha = 0.75 * c.p;
      ctx.fillStyle = "#ffffff";
      puff(ctx, sx, sy, r);
    }
    ctx.restore();
  }

  /* Convert a screen x back to a world x (inverse of camera projection). */
  _screenToWorldX(cam, sx) { return cam.x + (sx - cam.w / 2) / cam.scale; }

  _drawGround(ctx, cam) {
    const gy = cam.worldToScreenY(this.groundElevation);
    if (gy > cam.h) return; // ground below the viewport (we're high up)
    const top = Math.max(0, gy);

    // Surface color varies by biome along the route, sampled across the view
    // so land, desert, forest, etc. transition smoothly as you fly.
    const hg = ctx.createLinearGradient(0, 0, cam.w, 0);
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const wx = this._screenToWorldX(cam, f * cam.w);
      hg.addColorStop(f, BIOME_COLORS[this._biomeAt(wx)].top);
    }
    ctx.fillStyle = hg;
    ctx.fillRect(0, top, cam.w, cam.h - top);

    // Depth shading toward the bottom for a sense of ground volume.
    const vg = ctx.createLinearGradient(0, gy, 0, cam.h);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, top, cam.w, cam.h - top);

    // Texture stripes to convey horizontal motion (land only).
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    const step = 100; // meters
    const startX = Math.floor((cam.x - cam.w / cam.scale) / step) * step;
    ctx.beginPath();
    for (let wx = startX; wx < cam.x + cam.w / cam.scale; wx += step) {
      if (this._biomeAt(wx) === "ocean") continue;
      const sx = cam.worldToScreenX(wx);
      ctx.moveTo(sx, top);
      ctx.lineTo(sx, cam.h);
    }
    ctx.stroke();

    // Relief: mountains, hills, forests, dunes, palms per band.
    this._drawTerrainFeatures(ctx, cam, gy);

    if (this.crossesOcean) this._drawOcean(ctx, cam, gy);
  }

  /* Dispatch per-biome relief drawing for every band in view. */
  _drawTerrainFeatures(ctx, cam, gy) {
    if (gy > cam.h + 40) return;
    const wv0 = this._screenToWorldX(cam, 0);
    const wv1 = this._screenToWorldX(cam, cam.w);
    for (const band of this.bands) {
      const x0 = Math.max(band.x0, wv0);
      const x1 = Math.min(band.x1, wv1);
      if (x1 <= x0) continue;
      switch (band.biome) {
        case "mountains": this._drawMountains(ctx, cam, gy, x0, x1); break;
        case "hills": this._drawHills(ctx, cam, gy, x0, x1); break;
        case "forest": this._drawForest(ctx, cam, gy, x0, x1); break;
        case "tropical": this._drawTropical(ctx, cam, gy, x0, x1); break;
        case "desert": this._drawDesert(ctx, cam, gy, x0, x1); break;
        case "savanna": this._drawSavanna(ctx, cam, gy, x0, x1); break;
        default: break; // plains / meadow / ocean: no extra relief
      }
    }
  }

  /* Deterministic ridge height (m) so peaks stay put as the camera scrolls. */
  _ridge(wx, seed) {
    const a = Math.sin(wx * 0.0009 + seed) * 0.5 + 0.5;
    const b = Math.sin(wx * 0.0023 + seed * 2.1) * 0.5 + 0.5;
    const c = Math.sin(wx * 0.0051 + seed * 3.7) * 0.5 + 0.5;
    return 180 + a * 470 + b * 220 + c * 90; // ~180..960 m
  }

  _drawMountains(ctx, cam, gy, wx0, wx1) {
    const sx0 = cam.worldToScreenX(wx0), sx1 = cam.worldToScreenX(wx1);
    const layers = [
      { seed: 1.3, col: "#5c6a5c", scale: 0.7 },
      { seed: 4.7, col: "#47533f", scale: 1.0 },
    ];
    for (const Lr of layers) {
      ctx.fillStyle = Lr.col;
      ctx.beginPath();
      ctx.moveTo(sx0, gy + 2);
      for (let sx = sx0; sx <= sx1; sx += 9) {
        const wx = this._screenToWorldX(cam, sx);
        const h = this._ridge(wx, Lr.seed) * Lr.scale;
        ctx.lineTo(sx, gy - cam.toScreenLen(h));
      }
      ctx.lineTo(sx1, gy + 2);
      ctx.closePath();
      ctx.fill();
    }
    // Snow caps on the tallest near-layer peaks.
    ctx.fillStyle = "rgba(238,244,250,0.9)";
    for (let sx = sx0; sx <= sx1; sx += 6) {
      const wx = this._screenToWorldX(cam, sx);
      const h = this._ridge(wx, 4.7);
      if (h > 720) {
        const py = gy - cam.toScreenLen(h);
        ctx.fillRect(sx - 1.5, py, 3, cam.toScreenLen(70));
      }
    }
  }

  _drawHills(ctx, cam, gy, wx0, wx1) {
    const sx0 = cam.worldToScreenX(wx0), sx1 = cam.worldToScreenX(wx1);
    ctx.fillStyle = "rgba(26,54,22,0.35)";
    ctx.beginPath();
    ctx.moveTo(sx0, gy + 2);
    for (let sx = sx0; sx <= sx1; sx += 8) {
      const wx = this._screenToWorldX(cam, sx);
      const h = 45 + 34 * Math.sin(wx * 0.0016) + 22 * Math.sin(wx * 0.0041 + 1.7);
      ctx.lineTo(sx, gy - cam.toScreenLen(Math.max(8, h)));
    }
    ctx.lineTo(sx1, gy + 2);
    ctx.closePath();
    ctx.fill();
  }

  _drawForest(ctx, cam, gy, wx0, wx1) {
    ctx.fillStyle = "rgba(18,52,23,0.5)";
    const spacing = 55; // meters between tree clumps
    const start = Math.ceil(wx0 / spacing) * spacing;
    for (let wx = start; wx < wx1; wx += spacing) {
      const sx = cam.worldToScreenX(wx);
      const r = cam.toScreenLen(16 + 9 * (Math.sin(wx * 0.013) * 0.5 + 0.5));
      if (r < 1) continue;
      ctx.beginPath();
      ctx.arc(sx, gy - r * 0.35, r, Math.PI, 0);
      ctx.fill();
    }
  }

  _drawTropical(ctx, cam, gy, wx0, wx1) {
    this._drawForest(ctx, cam, gy, wx0, wx1);
    const spacing = 210; // meters between palms
    const start = Math.ceil(wx0 / spacing) * spacing;
    const m = (meters) => cam.toScreenLen(meters * 0.6);
    for (let wx = start; wx < wx1; wx += spacing) {
      this._palm(ctx, cam.worldToScreenX(wx), gy, m);
    }
  }

  _drawSavanna(ctx, cam, gy, wx0, wx1) {
    const spacing = 240; // meters between acacia trees (sparse)
    const start = Math.ceil(wx0 / spacing) * spacing;
    for (let wx = start; wx < wx1; wx += spacing) {
      const sx = cam.worldToScreenX(wx);
      const h = cam.toScreenLen(24 + 10 * (Math.sin(wx * 0.017) * 0.5 + 0.5));
      const w = h * 1.5;
      if (h < 2) continue;
      ctx.strokeStyle = "#6a5230";       // trunk
      ctx.lineWidth = Math.max(1, h * 0.12);
      ctx.beginPath();
      ctx.moveTo(sx, gy);
      ctx.lineTo(sx, gy - h * 0.8);
      ctx.stroke();
      ctx.fillStyle = "rgba(70,90,42,0.75)"; // flat canopy
      ctx.beginPath();
      ctx.ellipse(sx, gy - h * 0.85, w * 0.55, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawDesert(ctx, cam, gy, wx0, wx1) {
    const sx0 = cam.worldToScreenX(wx0), sx1 = cam.worldToScreenX(wx1);
    ctx.fillStyle = "rgba(120,88,38,0.22)";
    ctx.beginPath();
    ctx.moveTo(sx0, gy + 2);
    for (let sx = sx0; sx <= sx1; sx += 10) {
      const wx = this._screenToWorldX(cam, sx);
      const h = 14 + 12 * Math.sin(wx * 0.001) + 8 * Math.sin(wx * 0.003 + 2);
      ctx.lineTo(sx, gy - cam.toScreenLen(Math.max(3, h)));
    }
    ctx.lineTo(sx1, gy + 2);
    ctx.closePath();
    ctx.fill();
  }

  /* Paint open water over the mid-route ocean band, with beaches at the
   * two coastlines and gently scrolling wave crests. */
  _drawOcean(ctx, cam, gy) {
    if (gy > cam.h) return;
    const xs0 = cam.worldToScreenX(this.oceanStart);
    const xs1 = cam.worldToScreenX(this.oceanEnd);
    const left = Math.max(-2, xs0);
    const right = Math.min(cam.w + 2, xs1);
    if (right <= left) return;

    const top = Math.max(0, gy);

    const grad = ctx.createLinearGradient(0, gy, 0, cam.h);
    grad.addColorStop(0, "#4a86b0");
    grad.addColorStop(1, "#173a5c");
    ctx.fillStyle = grad;
    ctx.fillRect(left, top, right - left, cam.h - top);

    // Foam waterline.
    ctx.fillStyle = "rgba(233,245,252,0.65)";
    ctx.fillRect(left, gy - 1, right - left, 2);

    // Wave crests, scrolling with the camera for a sense of motion.
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, cam.h - top);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let r = 1; r <= 6; r++) {
      const y = gy + r * 13;
      if (y > cam.h) break;
      const off = (cam.x * (0.25 + r * 0.08)) % 64;
      ctx.beginPath();
      for (let x = left - 64; x < right + 64; x += 64) {
        const px = x - off;
        ctx.moveTo(px, y);
        ctx.quadraticCurveTo(px + 16, y - 3, px + 32, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Sandy beaches where the land meets the sea.
    const bw = Math.max(6, cam.toScreenLen(700));
    ctx.fillStyle = "#cdb782";
    if (xs0 > -bw && xs0 < cam.w + bw) {
      ctx.beginPath();
      ctx.moveTo(xs0 - bw, gy);
      ctx.lineTo(xs0, gy);
      ctx.lineTo(xs0, gy + 5);
      ctx.lineTo(xs0 - bw, gy + 2);
      ctx.closePath();
      ctx.fill();
    }
    if (xs1 > -bw && xs1 < cam.w + bw) {
      ctx.beginPath();
      ctx.moveTo(xs1 + bw, gy);
      ctx.lineTo(xs1, gy);
      ctx.lineTo(xs1, gy + 5);
      ctx.lineTo(xs1 + bw, gy + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* Draw a recognizable landmark/skyline for an airport, centered at worldX. */
  _drawScenery(ctx, cam, theme, worldX) {
    if (theme.landmark === "none") return; // clean field (e.g., training)
    const gy = cam.worldToScreenY(this.groundElevation);
    if (gy < -50 || gy > cam.h + 50) return;              // not near the ground
    const centerSx = cam.worldToScreenX(worldX);
    if (centerSx < -1400 || centerSx > cam.w + 1400) return;

    const m = (meters) => cam.toScreenLen(meters);        // meters -> px
    const at = (offM) => cam.worldToScreenX(worldX + offM);

    const haze = "#7d90a6";
    const hazeDark = "#63758c";
    const buildingWin = "rgba(255,240,190,0.5)";

    const box = (offM, wM, hM, color) => {
      const x = at(offM), w = m(wM), h = m(hM);
      ctx.fillStyle = color;
      ctx.fillRect(x - w / 2, gy - h, w, h);
    };
    const windows = (offM, wM, hM) => {
      const x = at(offM) - m(wM) / 2, w = m(wM), h = m(hM);
      ctx.fillStyle = buildingWin;
      const cols = Math.max(1, Math.floor(w / 8));
      const rows = Math.max(1, Math.floor(h / 12));
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if ((r + c) % 2 === 0) ctx.fillRect(x + 4 + c * 8, gy - h + 6 + r * 12, 3, 6);
    };

    ctx.save();
    ctx.globalAlpha = 0.92;

    switch (theme.landmark) {
      case "nyc": {
        const hts = [120, 180, 260, 210, 380, 300, 160, 230, 140];
        hts.forEach((h, i) => { const off = -320 + i * 80; box(off, 60, h, i % 2 ? haze : hazeDark); windows(off, 60, h); });
        // a standout tower with a spire
        box(60, 70, 440, hazeDark); windows(60, 70, 440);
        ctx.strokeStyle = hazeDark; ctx.lineWidth = m(4);
        ctx.beginPath(); ctx.moveTo(at(60), gy - m(440)); ctx.lineTo(at(60), gy - m(520)); ctx.stroke();
        break;
      }
      case "skyline": {
        const hts = [140, 220, 300, 190, 260, 340, 200, 150, 240];
        hts.forEach((h, i) => { const off = -340 + i * 85; box(off, 62, h, i % 2 ? haze : hazeDark); windows(off, 62, h); });
        break;
      }
      case "bridge": {
        // Golden Gate: two red towers + suspension cables.
        const red = "#a83a2a";
        const t1 = -220, t2 = 220, top = 230;
        box(t1, 26, top, red); box(t2, 26, top, red);
        ctx.strokeStyle = "#8f2f22"; ctx.lineWidth = m(4);
        ctx.beginPath();
        ctx.moveTo(at(t1 - 260), gy - m(40));
        ctx.quadraticCurveTo(at((t1 + t2) / 2), gy - m(top - 30), at(t2 + 260), gy - m(40));
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(at(t1 - 260), gy); ctx.lineTo(at(t2 + 260), gy); ctx.lineWidth = m(6); ctx.stroke();
        break;
      }
      case "opera": {
        // Sydney: harbour bridge arch + opera-house shells.
        ctx.strokeStyle = hazeDark; ctx.lineWidth = m(10);
        ctx.beginPath();
        ctx.moveTo(at(-360), gy); ctx.quadraticCurveTo(at(-220), gy - m(150), at(-80), gy); ctx.stroke();
        ctx.fillStyle = "#e7edf2";
        for (let i = 0; i < 3; i++) {
          const off = 120 + i * 70;
          ctx.beginPath();
          ctx.moveTo(at(off - 35), gy);
          ctx.quadraticCurveTo(at(off), gy - m(120 - i * 15), at(off + 35), gy);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case "burj": {
        // Dubai: sand dunes + a very tall tapering spire.
        ctx.fillStyle = "#c9a86a";
        ctx.beginPath(); ctx.moveTo(at(-500), gy);
        ctx.quadraticCurveTo(at(-200), gy - m(30), at(120), gy); ctx.lineTo(at(120), gy + 4); ctx.lineTo(at(-500), gy + 4); ctx.fill();
        const spire = "#9fb4c6";
        ctx.fillStyle = spire;
        ctx.beginPath();
        ctx.moveTo(at(0) - m(24), gy);
        ctx.lineTo(at(0) - m(6), gy - m(760));
        ctx.lineTo(at(0), gy - m(828));
        ctx.lineTo(at(0) + m(6), gy - m(760));
        ctx.lineTo(at(0) + m(24), gy);
        ctx.closePath(); ctx.fill();
        box(-160, 70, 240, haze); windows(-160, 70, 240);
        box(200, 60, 300, hazeDark); windows(200, 60, 300);
        break;
      }
      case "eiffel": {
        const c = "#7c6a55";
        const bx = at(0), baseW = m(180), topY = gy - m(320);
        ctx.strokeStyle = c; ctx.lineWidth = m(6);
        ctx.beginPath();
        ctx.moveTo(bx - baseW / 2, gy); ctx.lineTo(bx - m(10), topY);
        ctx.moveTo(bx + baseW / 2, gy); ctx.lineTo(bx + m(10), topY);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - m(60), gy - m(110)); ctx.lineTo(bx + m(60), gy - m(110)); ctx.lineWidth = m(5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - m(30), gy - m(210)); ctx.lineTo(bx + m(30), gy - m(210)); ctx.stroke();
        box(0, 24, 320, c);
        break;
      }
      case "bigben": {
        // London: clock tower + London Eye wheel.
        box(-40, 46, 300, "#8a7a63"); // tower
        ctx.fillStyle = "#c7b48c";
        ctx.beginPath(); ctx.moveTo(at(-40) - m(23), gy - m(300)); ctx.lineTo(at(-40), gy - m(360)); ctx.lineTo(at(-40) + m(23), gy - m(300)); ctx.fill();
        ctx.fillStyle = "#f4f1e6"; ctx.beginPath(); ctx.arc(at(-40), gy - m(270), m(14), 0, Math.PI * 2); ctx.fill();
        // Ferris wheel
        ctx.strokeStyle = hazeDark; ctx.lineWidth = m(4);
        const wx = at(200), wy = gy - m(120), rr = m(120);
        ctx.beginPath(); ctx.arc(wx, wy, rr, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * rr, wy + Math.sin(a) * rr); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx, gy); ctx.lineWidth = m(6); ctx.stroke();
        break;
      }
      case "fuji": {
        // Tokyo: Mt Fuji (snow-capped) + a small skyline.
        const mx = at(-40), base = m(520), peak = m(360);
        ctx.fillStyle = "#5c6f86";
        ctx.beginPath(); ctx.moveTo(mx - base, gy); ctx.lineTo(mx, gy - peak); ctx.lineTo(mx + base, gy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#eef3f7";
        ctx.beginPath(); ctx.moveTo(mx - m(90), gy - peak + m(70)); ctx.lineTo(mx, gy - peak); ctx.lineTo(mx + m(90), gy - peak + m(70));
        ctx.quadraticCurveTo(mx, gy - peak + m(40), mx - m(90), gy - peak + m(70)); ctx.fill();
        [200, 280, 350].forEach((off, i) => { box(off, 50, 120 + i * 40, haze); windows(off, 50, 120 + i * 40); });
        break;
      }
      case "marina": {
        // Singapore: three towers with a rooftop deck (Marina Bay Sands) + palms.
        const towers = [-90, 0, 90];
        towers.forEach((off) => box(off, 34, 300, "#9fb0c2"));
        ctx.fillStyle = "#d7e0e8";
        ctx.fillRect(at(-90) - m(28), gy - m(330), m(236), m(26));
        this._palm(ctx, at(220), gy, m);
        this._palm(ctx, at(-220), gy, m);
        break;
      }
      case "palms": {
        for (let i = -3; i <= 3; i++) this._palm(ctx, at(i * 90), gy, m);
        box(240, 70, 150, haze); windows(240, 70, 150);
        box(-260, 60, 120, hazeDark);
        break;
      }
      case "windmill": {
        // Amsterdam: narrow canal houses with stepped gables + a windmill.
        const houseCols = ["#8a5a3c", "#9c6b4a", "#6f4a34", "#7d5540", "#a2795a"];
        for (let i = 0; i < 5; i++) {
          const off = -300 + i * 60;
          const h = 150 + (i % 3) * 30;
          const col = houseCols[i % houseCols.length];
          box(off, 46, h, col);
          windows(off, 46, h);
          ctx.fillStyle = col; // stepped gable roof
          ctx.beginPath();
          ctx.moveTo(at(off) - m(23), gy - m(h));
          ctx.lineTo(at(off) - m(23), gy - m(h) - m(10));
          ctx.lineTo(at(off) - m(8), gy - m(h) - m(10));
          ctx.lineTo(at(off) - m(8), gy - m(h) - m(22));
          ctx.lineTo(at(off) + m(8), gy - m(h) - m(22));
          ctx.lineTo(at(off) + m(8), gy - m(h) - m(10));
          ctx.lineTo(at(off) + m(23), gy - m(h) - m(10));
          ctx.lineTo(at(off) + m(23), gy - m(h));
          ctx.closePath();
          ctx.fill();
        }
        // Windmill: tapered tower + cap + four sail arms.
        const wx = at(160);
        const baseW = m(64), topW = m(34), tob = m(150);
        ctx.fillStyle = "#6b4a30";
        ctx.beginPath();
        ctx.moveTo(wx - baseW / 2, gy);
        ctx.lineTo(wx - topW / 2, gy - tob);
        ctx.lineTo(wx + topW / 2, gy - tob);
        ctx.lineTo(wx + baseW / 2, gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#4a3320"; // cap
        ctx.beginPath();
        ctx.moveTo(wx - topW / 2 - m(4), gy - tob);
        ctx.quadraticCurveTo(wx, gy - tob - m(28), wx + topW / 2 + m(4), gy - tob);
        ctx.closePath();
        ctx.fill();
        const hubY = gy - tob - m(6); // sails
        ctx.strokeStyle = "#3b2a1a";
        ctx.lineWidth = m(4);
        ctx.lineCap = "round";
        const arm = m(72);
        for (let k = 0; k < 4; k++) {
          const a = k * (Math.PI / 2) + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(wx, hubY);
          ctx.lineTo(wx + Math.cos(a) * arm, hubY + Math.sin(a) * arm);
          ctx.stroke();
        }
        break;
      }
      case "africa": {
        // Addis Ababa: a low skyline framed by flat-topped acacia trees.
        const acacia = (offM, sc) => {
          const x = at(offM), tw = m(90 * sc), th = m(120 * sc);
          ctx.strokeStyle = "#6a5230"; ctx.lineWidth = m(9 * sc);
          ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - th * 0.7); ctx.stroke();
          // splayed branches
          ctx.beginPath();
          ctx.moveTo(x, gy - th * 0.7); ctx.lineTo(x - tw * 0.4, gy - th * 0.95);
          ctx.moveTo(x, gy - th * 0.7); ctx.lineTo(x + tw * 0.4, gy - th * 0.95);
          ctx.stroke();
          ctx.fillStyle = "#4a5a2a"; // flat canopy
          ctx.beginPath();
          ctx.ellipse(x, gy - th * 0.98, tw * 0.6, th * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
        };
        [180, 300].forEach((off, i) => { box(off, 54, 150 + i * 60, haze); windows(off, 54, 150 + i * 60); });
        box(-60, 70, 250, hazeDark); windows(-60, 70, 250); // a taller tower
        acacia(-260, 1.15);
        acacia(-380, 0.85);
        acacia(60, 0.7);
        break;
      }
      case "mosque": {
        // Istanbul: central dome, half-domes, and two minarets.
        const stone = "#cbb896";
        const stoneDark = "#a89068";
        box(0, 200, 95, stone);
        box(-70, 90, 70, stoneDark);
        box(70, 90, 70, stoneDark);
        const dome = (off, rx, ry, lift) => {
          ctx.fillStyle = stoneDark;
          ctx.beginPath();
          ctx.ellipse(at(off), gy - m(lift), m(rx), m(ry), 0, Math.PI, 0, true);
          ctx.fill();
          ctx.strokeStyle = stoneDark;
          ctx.lineWidth = m(3);
          ctx.beginPath();
          ctx.moveTo(at(off), gy - m(lift + ry));
          ctx.lineTo(at(off), gy - m(lift + ry + 18));
          ctx.stroke();
        };
        dome(0, 72, 58, 95);
        dome(-70, 42, 32, 70);
        dome(70, 42, 32, 70);
        [-150, 150].forEach((off) => {
          box(off, 14, 220, stone);
          ctx.fillStyle = stoneDark;
          ctx.beginPath();
          ctx.moveTo(at(off) - m(10), gy - m(220));
          ctx.lineTo(at(off), gy - m(248));
          ctx.lineTo(at(off) + m(10), gy - m(220));
          ctx.closePath();
          ctx.fill();
        });
        break;
      }
      case "mountains": {
        // Vancouver: snow-capped coastal range + evergreens.
        const mx = at(-80);
        ctx.fillStyle = "#5c6f86";
        ctx.beginPath();
        ctx.moveTo(mx - m(420), gy);
        ctx.lineTo(mx - m(180), gy - m(280));
        ctx.lineTo(mx, gy - m(360));
        ctx.lineTo(mx + m(160), gy - m(240));
        ctx.lineTo(mx + m(380), gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#eef3f7";
        ctx.beginPath();
        ctx.moveTo(mx - m(70), gy - m(300));
        ctx.lineTo(mx, gy - m(360));
        ctx.lineTo(mx + m(55), gy - m(305));
        ctx.quadraticCurveTo(mx, gy - m(325), mx - m(70), gy - m(300));
        ctx.fill();
        const pine = (off, sc) => {
          const x = at(off);
          ctx.fillStyle = "#2f5a32";
          ctx.beginPath();
          ctx.moveTo(x, gy - m(110 * sc));
          ctx.lineTo(x - m(28 * sc), gy);
          ctx.lineTo(x + m(28 * sc), gy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#4a3320";
          ctx.fillRect(x - m(3), gy - m(8), m(6), m(8));
        };
        pine(220, 1.1); pine(280, 0.8); pine(340, 1); pine(-320, 0.9);
        break;
      }
      case "alpine": {
        // Munich: Alps plus twin onion-dome towers (Frauenkirche).
        ctx.fillStyle = "#6a7380";
        ctx.beginPath();
        ctx.moveTo(at(-480), gy);
        ctx.lineTo(at(-280), gy - m(160));
        ctx.lineTo(at(-80), gy - m(240));
        ctx.lineTo(at(80), gy - m(150));
        ctx.lineTo(at(260), gy - m(220));
        ctx.lineTo(at(480), gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e8eef4";
        ctx.beginPath();
        ctx.moveTo(at(-120), gy - m(200));
        ctx.lineTo(at(-80), gy - m(240));
        ctx.lineTo(at(-45), gy - m(200));
        ctx.closePath();
        ctx.fill();
        const onion = (off) => {
          box(off, 36, 180, "#c9c3b4");
          ctx.fillStyle = "#6e7a88";
          ctx.beginPath();
          ctx.ellipse(at(off), gy - m(180), m(22), m(28), 0, Math.PI, 0, true);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(at(off), gy - m(208));
          ctx.lineTo(at(off), gy - m(230));
          ctx.strokeStyle = "#6e7a88";
          ctx.lineWidth = m(3);
          ctx.stroke();
        };
        onion(-40); onion(40);
        break;
      }
      case "palace": {
        // Warsaw: Palace of Culture — a tall stepped tower with a spire.
        box(-80, 70, 140, haze); windows(-80, 70, 140);
        box(90, 55, 110, hazeDark); windows(90, 55, 110);
        box(0, 90, 280, hazeDark); windows(0, 90, 280);
        box(0, 70, 340, haze);
        ctx.fillStyle = hazeDark;
        ctx.beginPath();
        ctx.moveTo(at(0) - m(28), gy - m(340));
        ctx.lineTo(at(0), gy - m(430));
        ctx.lineTo(at(0) + m(28), gy - m(340));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hazeDark;
        ctx.lineWidth = m(4);
        ctx.beginPath();
        ctx.moveTo(at(0), gy - m(430));
        ctx.lineTo(at(0), gy - m(470));
        ctx.stroke();
        break;
      }
      case "mills": {
        // Manchester: brick mill chimneys + a modern glass tower.
        const brick = "#8a5a3c";
        box(-180, 90, 120, brick); windows(-180, 90, 120);
        box(-70, 70, 90, "#7a4e34");
        const chimney = (off, h) => {
          ctx.fillStyle = "#6a4030";
          ctx.fillRect(at(off) - m(10), gy - m(h), m(20), m(h));
          ctx.fillStyle = "#4a2c20";
          ctx.fillRect(at(off) - m(14), gy - m(h) - m(12), m(28), m(12));
        };
        chimney(-210, 220); chimney(-40, 180);
        box(120, 55, 260, hazeDark); windows(120, 55, 260);
        box(200, 48, 180, haze); windows(200, 48, 180);
        break;
      }
      case "colosseum": {
        // Rome: oval amphitheatre with stacked arches.
        const stone = "#c4a882";
        const stoneDark = "#9a7d58";
        ctx.fillStyle = stoneDark;
        ctx.beginPath();
        ctx.ellipse(at(0), gy - m(70), m(160), m(90), 0, Math.PI, 0, true);
        ctx.fill();
        ctx.fillStyle = stone;
        ctx.beginPath();
        ctx.ellipse(at(0), gy - m(70), m(150), m(82), 0, Math.PI, 0, true);
        ctx.fill();
        ctx.fillStyle = "#6a5340";
        ctx.beginPath();
        ctx.ellipse(at(0), gy - m(70), m(70), m(38), 0, Math.PI, 0, true);
        ctx.fill();
        ctx.strokeStyle = stoneDark;
        ctx.lineWidth = m(3);
        [-90, -45, 0, 45, 90].forEach((off) => {
          ctx.beginPath();
          ctx.ellipse(at(off), gy - m(55), m(16), m(22), 0, Math.PI, 0, true);
          ctx.stroke();
        });
        box(-220, 70, 110, haze); windows(-220, 70, 110);
        box(230, 55, 90, hazeDark);
        break;
      }
      case "table": {
        // Cape Town: Table Mountain's flat top plus a harbour skyline.
        ctx.fillStyle = "#6a7a68";
        ctx.beginPath();
        ctx.moveTo(at(-420), gy);
        ctx.lineTo(at(-260), gy - m(160));
        ctx.lineTo(at(-180), gy - m(240));
        ctx.lineTo(at(-40), gy - m(250));
        ctx.lineTo(at(80), gy - m(245));
        ctx.lineTo(at(160), gy - m(180));
        ctx.lineTo(at(280), gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#8a9a84";
        ctx.fillRect(at(-180), gy - m(250), m(260), m(18));
        box(200, 48, 90, haze); windows(200, 48, 90);
        box(270, 40, 70, hazeDark);
        break;
      }
      case "dhow": {
        // Doha: glass towers and a lateen-sail dhow.
        box(-80, 48, 220, hazeDark); windows(-80, 48, 220);
        box(20, 40, 280, haze); windows(20, 40, 280);
        box(90, 36, 160, hazeDark); windows(90, 36, 160);
        const bx = at(220);
        ctx.fillStyle = "#c9b48a";
        ctx.beginPath();
        ctx.moveTo(bx - m(90), gy - m(8));
        ctx.quadraticCurveTo(bx, gy + m(18), bx + m(110), gy - m(12));
        ctx.lineTo(bx + m(70), gy - m(28));
        ctx.quadraticCurveTo(bx, gy - m(8), bx - m(70), gy - m(24));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e8dcc4";
        ctx.beginPath();
        ctx.moveTo(bx - m(10), gy - m(28));
        ctx.lineTo(bx - m(10), gy - m(150));
        ctx.lineTo(bx + m(95), gy - m(36));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "obelisk": {
        // Buenos Aires: a tall needle plus a low civic skyline.
        box(-140, 70, 110, haze); windows(-140, 70, 110);
        box(160, 55, 90, hazeDark); windows(160, 55, 90);
        ctx.fillStyle = haze;
        ctx.fillRect(at(0) - m(14), gy - m(280), m(28), m(280));
        ctx.beginPath();
        ctx.moveTo(at(0) - m(18), gy - m(280));
        ctx.lineTo(at(0), gy - m(340));
        ctx.lineTo(at(0) + m(18), gy - m(280));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "skytower": {
        // Auckland: a needle tower with a pod, harbour buildings.
        box(-180, 70, 90, haze); windows(-180, 70, 90);
        box(-80, 48, 70, hazeDark);
        ctx.fillStyle = hazeDark;
        ctx.fillRect(at(40) - m(8), gy - m(360), m(16), m(360));
        ctx.fillStyle = haze;
        ctx.beginPath();
        ctx.ellipse(at(40), gy - m(250), m(28), m(18), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hazeDark;
        ctx.lineWidth = m(3);
        ctx.beginPath();
        ctx.moveTo(at(40), gy - m(360));
        ctx.lineTo(at(40), gy - m(410));
        ctx.stroke();
        box(160, 50, 80, haze); windows(160, 50, 80);
        break;
      }
      case "namsan": {
        // Seoul: N Seoul Tower on a hill plus a dense skyline.
        const hts = [110, 170, 240, 190, 280, 210, 150];
        hts.forEach((h, i) => { const off = -280 + i * 70; box(off, 52, h, i % 2 ? haze : hazeDark); windows(off, 52, h); });
        ctx.fillStyle = "#5a6a4a";
        ctx.beginPath();
        ctx.moveTo(at(80), gy);
        ctx.quadraticCurveTo(at(160), gy - m(90), at(240), gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hazeDark;
        ctx.fillRect(at(160) - m(10), gy - m(90) - m(220), m(20), m(220));
        ctx.fillStyle = haze;
        ctx.beginPath();
        ctx.ellipse(at(160), gy - m(90) - m(150), m(32), m(18), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hazeDark;
        ctx.lineWidth = m(3);
        ctx.beginPath();
        ctx.moveTo(at(160), gy - m(90) - m(220));
        ctx.lineTo(at(160), gy - m(90) - m(270));
        ctx.stroke();
        break;
      }
      case "pyramid": {
        // Mexico City: a stepped pyramid and a low colonial skyline.
        box(-220, 70, 90, haze); windows(-220, 70, 90);
        box(-120, 55, 70, hazeDark);
        ctx.fillStyle = "#c4a574";
        ctx.beginPath();
        ctx.moveTo(at(40) - m(140), gy);
        ctx.lineTo(at(40) - m(28), gy - m(160));
        ctx.lineTo(at(40) + m(28), gy - m(160));
        ctx.lineTo(at(40) + m(140), gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#a88858";
        ctx.fillRect(at(40) - m(22), gy - m(186), m(44), m(26));
        box(220, 64, 110, haze); windows(220, 64, 110);
        break;
      }
      case "nyhavn": {
        // Copenhagen: a row of narrow colored townhouses.
        const colors = ["#c45c3a", "#d9b24a", "#3d6fa8", "#c46b7a", "#4a8a62", "#d97a3a"];
        colors.forEach((col, i) => {
          const off = -200 + i * 72;
          ctx.fillStyle = col;
          ctx.fillRect(at(off) - m(28), gy - m(110 + (i % 3) * 18), m(56), m(110 + (i % 3) * 18));
          ctx.fillStyle = "#3a2a22";
          ctx.beginPath();
          ctx.moveTo(at(off) - m(32), gy - m(110 + (i % 3) * 18));
          ctx.lineTo(at(off), gy - m(138 + (i % 3) * 18));
          ctx.lineTo(at(off) + m(32), gy - m(110 + (i % 3) * 18));
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(255,240,190,0.55)";
          for (let r = 0; r < 3; r++) {
            ctx.fillRect(at(off) - m(16), gy - m(90) + r * m(22), m(12), m(14));
            ctx.fillRect(at(off) + m(4), gy - m(90) + r * m(22), m(12), m(14));
          }
        });
        break;
      }
      case "wat": {
        // Bangkok: golden temple spires and a low tropical skyline.
        box(-220, 64, 80, haze); windows(-220, 64, 80);
        box(-130, 48, 60, hazeDark);
        const spire = (off, h) => {
          ctx.fillStyle = "#d4b45a";
          ctx.beginPath();
          ctx.moveTo(at(off) - m(28), gy);
          ctx.lineTo(at(off) - m(10), gy - m(h * 0.45));
          ctx.lineTo(at(off), gy - m(h));
          ctx.lineTo(at(off) + m(10), gy - m(h * 0.45));
          ctx.lineTo(at(off) + m(28), gy);
          ctx.closePath();
          ctx.fill();
        };
        spire(20, 220);
        spire(90, 160);
        spire(155, 190);
        box(260, 58, 95, haze); windows(260, 58, 95);
        break;
      }
      case "needle": {
        // Seattle: Space Needle plus a wet-coast skyline.
        const hts = [90, 150, 210, 170, 240, 130];
        hts.forEach((h, i) => { const off = -260 + i * 68; box(off, 50, h, i % 2 ? haze : hazeDark); windows(off, 50, h); });
        ctx.fillStyle = hazeDark;
        ctx.fillRect(at(160) - m(8), gy - m(280), m(16), m(280));
        ctx.fillStyle = haze;
        ctx.beginPath();
        ctx.ellipse(at(160), gy - m(210), m(36), m(22), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hazeDark;
        ctx.lineWidth = m(3);
        ctx.beginPath();
        ctx.moveTo(at(160), gy - m(280));
        ctx.lineTo(at(160), gy - m(330));
        ctx.stroke();
        box(260, 54, 100, haze); windows(260, 54, 100);
        break;
      }
      case "highveld": {
        // Johannesburg: a mine dump hill and a downtown cluster.
        ctx.fillStyle = "#c4b07a";
        ctx.beginPath();
        ctx.moveTo(at(-280), gy);
        ctx.lineTo(at(-160), gy - m(90));
        ctx.lineTo(at(-40), gy);
        ctx.closePath();
        ctx.fill();
        const hts = [140, 220, 300, 180, 260, 160];
        hts.forEach((h, i) => { const off = 20 + i * 72; box(off, 54, h, i % 2 ? haze : hazeDark); windows(off, 54, h); });
        break;
      }
      case "indiagate": {
        // Delhi: India Gate arch and a low sandstone skyline.
        box(-240, 70, 90, haze); windows(-240, 70, 90);
        box(-140, 52, 70, hazeDark);
        ctx.fillStyle = "#c4a574";
        ctx.fillRect(at(20) - m(90), gy - m(40), m(180), m(40));
        ctx.fillRect(at(20) - m(110), gy - m(160), m(40), m(160));
        ctx.fillRect(at(20) + m(70), gy - m(160), m(40), m(160));
        ctx.beginPath();
        ctx.moveTo(at(20) - m(70), gy - m(160));
        ctx.lineTo(at(20) - m(70), gy - m(210));
        ctx.quadraticCurveTo(at(20), gy - m(250), at(20) + m(70), gy - m(210));
        ctx.lineTo(at(20) + m(70), gy - m(160));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#0b1220";
        ctx.beginPath();
        ctx.moveTo(at(20) - m(48), gy - m(40));
        ctx.lineTo(at(20) - m(48), gy - m(150));
        ctx.quadraticCurveTo(at(20), gy - m(195), at(20) + m(48), gy - m(150));
        ctx.lineTo(at(20) + m(48), gy - m(40));
        ctx.closePath();
        ctx.fill();
        box(220, 60, 110, haze); windows(220, 60, 110);
        break;
      }
      case "pearl": {
        // Shanghai: Oriental Pearl stacked spheres plus a Pudong skyline.
        const hts = [160, 240, 320, 280, 200, 360];
        hts.forEach((h, i) => { const off = -40 + i * 70; box(off, 48, h, i % 2 ? haze : hazeDark); windows(off, 48, h); });
        ctx.fillStyle = hazeDark;
        ctx.fillRect(at(-220) - m(8), gy - m(300), m(16), m(300));
        ctx.fillStyle = haze;
        ctx.beginPath();
        ctx.arc(at(-220), gy - m(120), m(36), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(at(-220), gy - m(230), m(24), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hazeDark;
        ctx.lineWidth = m(3);
        ctx.beginPath();
        ctx.moveTo(at(-220), gy - m(300));
        ctx.lineTo(at(-220), gy - m(340));
        ctx.stroke();
        break;
      }
      case "andes": {
        // Santiago: snow peaks behind a low city.
        ctx.fillStyle = "#6a7a8c";
        ctx.beginPath();
        ctx.moveTo(at(-420), gy);
        ctx.lineTo(at(-280), gy - m(220));
        ctx.lineTo(at(-140), gy - m(90));
        ctx.lineTo(at(0), gy - m(280));
        ctx.lineTo(at(140), gy - m(110));
        ctx.lineTo(at(260), gy - m(240));
        ctx.lineTo(at(400), gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e8eef4";
        ctx.beginPath();
        ctx.moveTo(at(-310), gy - m(170));
        ctx.lineTo(at(-280), gy - m(220));
        ctx.lineTo(at(-250), gy - m(170));
        ctx.moveTo(at(-30), gy - m(210));
        ctx.lineTo(at(0), gy - m(280));
        ctx.lineTo(at(30), gy - m(210));
        ctx.moveTo(at(230), gy - m(190));
        ctx.lineTo(at(260), gy - m(240));
        ctx.lineTo(at(290), gy - m(190));
        ctx.fill();
        [ -180, -80, 80, 180 ].forEach((off, i) => { box(off, 50, 70 + i * 18, haze); windows(off, 50, 70 + i * 18); });
        break;
      }
      case "gateway": {
        // Mumbai: Gateway of India arch by the waterfront.
        box(-240, 64, 85, haze); windows(-240, 64, 85);
        ctx.fillStyle = "#c4a574";
        ctx.fillRect(at(20) - m(100), gy - m(36), m(200), m(36));
        ctx.fillRect(at(20) - m(110), gy - m(170), m(44), m(170));
        ctx.fillRect(at(20) + m(66), gy - m(170), m(44), m(170));
        ctx.fillRect(at(20) - m(70), gy - m(210), m(140), m(50));
        ctx.beginPath();
        ctx.moveTo(at(20) - m(66), gy - m(36));
        ctx.lineTo(at(20) - m(66), gy - m(150));
        ctx.quadraticCurveTo(at(20), gy - m(200), at(20) + m(66), gy - m(150));
        ctx.lineTo(at(20) + m(66), gy - m(36));
        ctx.closePath();
        ctx.fillStyle = "#0b1220";
        ctx.fill();
        box(230, 58, 100, haze); windows(230, 58, 100);
        break;
      }
      case "castle": {
        // Dublin: a keep with corner towers.
        box(-200, 60, 80, haze); windows(-200, 60, 80);
        ctx.fillStyle = hazeDark;
        ctx.fillRect(at(20) - m(80), gy - m(130), m(160), m(130));
        ctx.fillRect(at(20) - m(100), gy - m(170), m(40), m(170));
        ctx.fillRect(at(20) + m(60), gy - m(170), m(40), m(170));
        ctx.fillStyle = "#3a2a22";
        ctx.beginPath();
        ctx.moveTo(at(20) - m(108), gy - m(170));
        ctx.lineTo(at(20) - m(80), gy - m(200));
        ctx.lineTo(at(20) - m(52), gy - m(170));
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(at(20) + m(52), gy - m(170));
        ctx.lineTo(at(20) + m(80), gy - m(200));
        ctx.lineTo(at(20) + m(108), gy - m(170));
        ctx.closePath();
        ctx.fill();
        windows(20, 140, 110);
        box(220, 52, 90, haze); windows(220, 52, 90);
        break;
      }
      case "boston": {
        // Boston: a brick row and a pointed downtown tower.
        const bricks = "#8a4a3a";
        [-220, -150, -80].forEach((off, i) => {
          ctx.fillStyle = i % 2 ? bricks : "#6e3c30";
          ctx.fillRect(at(off) - m(28), gy - m(70 + i * 10), m(56), m(70 + i * 10));
        });
        const hts = [140, 200, 280, 170, 230];
        hts.forEach((h, i) => { const off = 40 + i * 68; box(off, 48, h, i % 2 ? haze : hazeDark); windows(off, 48, h); });
        ctx.strokeStyle = hazeDark;
        ctx.lineWidth = m(4);
        ctx.beginPath();
        ctx.moveTo(at(176), gy - m(280));
        ctx.lineTo(at(176), gy - m(330));
        ctx.stroke();
        break;
      }
      case "giza": {
        // Cairo: three pyramids on the sand.
        const pyramid = (off, h, col) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(at(off) - m(h * 0.7), gy);
          ctx.lineTo(at(off), gy - m(h));
          ctx.lineTo(at(off) + m(h * 0.7), gy);
          ctx.closePath();
          ctx.fill();
        };
        pyramid(-80, 140, "#c4a574");
        pyramid(80, 220, "#d4b45a");
        pyramid(220, 110, "#b89658");
        ctx.fillStyle = "#c4a574";
        ctx.beginPath();
        ctx.ellipse(at(-240), gy - m(28), m(50), m(28), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(at(-240) - m(18), gy - m(70), m(36), m(50));
        break;
      }
      case "spire": {
        // Melbourne: Arts Centre spire plus a river-city skyline.
        const hts = [120, 190, 260, 210, 300, 160];
        hts.forEach((h, i) => { const off = -80 + i * 70; box(off, 50, h, i % 2 ? haze : hazeDark); windows(off, 50, h); });
        ctx.fillStyle = hazeDark;
        ctx.beginPath();
        ctx.moveTo(at(-260) - m(40), gy);
        ctx.lineTo(at(-260), gy - m(220));
        ctx.lineTo(at(-260) + m(40), gy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = haze;
        ctx.lineWidth = m(3);
        ctx.beginPath();
        ctx.moveTo(at(-260), gy - m(220));
        ctx.lineTo(at(-260), gy - m(320));
        ctx.stroke();
        break;
      }
      default: {
        ctx.fillStyle = hazeDark;
        ctx.beginPath(); ctx.moveTo(at(-500), gy);
        for (let x = -500; x <= 500; x += 50) {
          const h = 60 + 50 * Math.sin(x * 0.01) + 40 * Math.cos(x * 0.023);
          ctx.lineTo(at(x), gy - m(h));
        }
        ctx.lineTo(at(500), gy); ctx.closePath(); ctx.fill();
        [120, 200, 300].forEach((off, i) => { box(off, 46, 90 + i * 30, haze); });
        break;
      }
    }
    ctx.restore();
  }

  _palm(ctx, x, gy, m) {
    ctx.strokeStyle = "#5a4632"; ctx.lineWidth = m(6);
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + m(8), gy - m(40), x + m(2), gy - m(70)); ctx.stroke();
    ctx.fillStyle = "#2f7d43";
    for (let a = -2; a <= 2; a++) {
      ctx.beginPath();
      ctx.moveTo(x + m(2), gy - m(70));
      ctx.quadraticCurveTo(x + a * m(26), gy - m(90), x + a * m(46), gy - m(64));
      ctx.quadraticCurveTo(x + a * m(24), gy - m(74), x + m(2), gy - m(70));
      ctx.fill();
    }
  }

  /* World-meter gate stand positions left of the departure threshold.
   * Spacing is wide enough for the on-screen aircraft sprites. */
  apronLayout(airport, anchorX, side) {
    const n = 6;
    const gap = 280;
    const clearance = 240;
    const totalW = (n - 1) * gap;
    const centerX = anchorX + side * (clearance + totalW / 2);
    const slots = [];
    for (let i = 0; i < n; i++) slots.push(centerX - totalW / 2 + i * gap);
    return { n, gap, totalW, centerX, slots, leftX: slots[0], rightX: slots[n - 1] };
  }

  /* Terminal + a row of parked airliners in their liveries beside a runway.
   * side = -1 places the apron before the departure threshold, +1 after
   * the arrival end. */
  _drawGates(ctx, cam, airport, anchorX, side) {
    const gy = cam.worldToScreenY(this.groundElevation);
    if (gy < -40 || gy > cam.h + 60) return;

    if (this.liveApron) {
      this._drawLiveTerminal(ctx, cam, airport, anchorX, side, gy);
      return;
    }

    const fleet = airportFleet(airport);
    const n = fleet.length;
    if (!n) return;

    const L = 60;                     // parked plane length (px; camera scale is fixed)
    const gap = L * 1.28;
    const totalW = (n - 1) * gap;     // px
    const halfWorld = (totalW / 2) / cam.scale;
    const clearance = 150;            // m from the runway threshold
    const centerX = anchorX + side * (clearance + halfWorld);
    const centerSx = cam.worldToScreenX(centerX);
    const leftSx = centerSx - totalW / 2;
    if (leftSx > cam.w + 200 || leftSx + totalW < -200) return;

    // Terminal building behind the aircraft.
    const bx = leftSx - L * 0.7;
    const bw = totalW + L * 1.4;
    const bh = 46;
    ctx.fillStyle = "#54657c";
    roundRect(ctx, bx, gy - bh, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = "#3f4d61";
    ctx.fillRect(bx, gy - bh, bw, 7);
    ctx.fillStyle = "rgba(200,225,245,0.45)";
    for (let wx = bx + 8; wx < bx + bw - 8; wx += 12) {
      ctx.fillRect(wx, gy - bh + 16, 6, 10);
      ctx.fillRect(wx, gy - bh + 30, 6, 8);
    }

    // Parked aircraft.
    for (let i = 0; i < n; i++) {
      const sx = leftSx + i * gap;
      if (sx < -L || sx > cam.w + L) continue;
      this._drawParkedPlane(ctx, sx, gy, L, fleet[i]);
    }
  }

  /* Terminal only — live AI occupy the stands in Free Cam. */
  _drawLiveTerminal(ctx, cam, airport, anchorX, side, gy) {
    const layout = this.apronLayout(airport, anchorX, side);
    const leftSx = cam.worldToScreenX(layout.leftX);
    const rightSx = cam.worldToScreenX(layout.rightX);
    const pad = cam.toScreenLen(90);
    const bx = Math.min(leftSx, rightSx) - pad;
    const bw = Math.abs(rightSx - leftSx) + pad * 2;
    if (bx > cam.w + 40 || bx + bw < -40) return;
    const bh = 46;
    ctx.fillStyle = "#54657c";
    roundRect(ctx, bx, gy - bh, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = "#3f4d61";
    ctx.fillRect(bx, gy - bh, bw, 7);
    ctx.fillStyle = "rgba(200,225,245,0.45)";
    for (let wx = bx + 8; wx < bx + bw - 8; wx += 12) {
      ctx.fillRect(wx, gy - bh + 16, 6, 10);
      ctx.fillRect(wx, gy - bh + 30, 6, 8);
    }
  }

  /* A small side-view airliner (nose left) painted in an airline livery. */
  _drawParkedPlane(ctx, x, gy, L, al) {
    const H = L * 0.17;
    const legs = H * 0.9;
    const cy = gy - legs - H;
    const body = al.fuselage, tail = al.tail, accent = al.accent;
    const belly = al.belly || shade(body, -14);

    ctx.fillStyle = shade(body, -18);
    ctx.beginPath();
    ctx.moveTo(x + L * 0.02, cy + H * 0.2);
    ctx.lineTo(x - L * 0.24, cy + H * 1.25);
    ctx.lineTo(x - L * 0.10, cy + H * 1.25);
    ctx.lineTo(x + L * 0.20, cy + H * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(x + L * 0.24, cy - H * 0.3);
    ctx.lineTo(x + L * 0.46, cy - H * 2.3);
    ctx.lineTo(x + L * 0.37, cy - H * 2.3);
    ctx.lineTo(x + L * 0.14, cy - H * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + L * 0.34, cy - H * 1.5, Math.max(1.2, H * 0.28), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#202c3a";
    ctx.lineWidth = Math.max(1, H * 0.2);
    for (const lx of [-L * 0.26, L * 0.2]) {
      ctx.beginPath();
      ctx.moveTo(x + lx, cy + H * 0.7);
      ctx.lineTo(x + lx, gy);
      ctx.stroke();
      ctx.fillStyle = "#0b1118";
      ctx.beginPath();
      ctx.arc(x + lx, gy, Math.max(1.2, H * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }

    const fuselage = () => {
      ctx.beginPath();
      ctx.moveTo(x - L * 0.5, cy);
      ctx.quadraticCurveTo(x - L * 0.46, cy - H, x - L * 0.24, cy - H);
      ctx.lineTo(x + L * 0.36, cy - H * 0.86);
      ctx.quadraticCurveTo(x + L * 0.5, cy - H * 0.5, x + L * 0.48, cy);
      ctx.quadraticCurveTo(x + L * 0.5, cy + H * 0.6, x + L * 0.34, cy + H * 0.9);
      ctx.lineTo(x - L * 0.24, cy + H);
      ctx.quadraticCurveTo(x - L * 0.46, cy + H, x - L * 0.5, cy);
      ctx.closePath();
    };
    ctx.fillStyle = body;
    fuselage();
    ctx.fill();
    ctx.save();
    fuselage();
    ctx.clip();
    ctx.fillStyle = belly;
    ctx.fillRect(x - L * 0.52, cy + H * 0.15, L * 1.06, H);
    if (al.cheat === "split") {
      ctx.fillStyle = accent;
      ctx.fillRect(x - L * 0.5, cy + H * 0.02, L, H * 0.22);
    } else if (al.cheat === "band") {
      ctx.fillStyle = accent;
      ctx.fillRect(x - L * 0.42, cy - H * 0.16, L * 0.8, H * 0.28);
    } else if (al.cheat === "flag3") {
      ctx.fillStyle = "#078930";
      ctx.fillRect(x - L * 0.4, cy - H * 0.08, L * 0.74, H * 0.14);
      ctx.fillStyle = accent;
      ctx.fillRect(x - L * 0.4, cy + H * 0.06, L * 0.74, H * 0.14);
      ctx.fillStyle = al.accent2 || "#da121a";
      ctx.fillRect(x - L * 0.4, cy + H * 0.2, L * 0.74, H * 0.14);
    } else if (al.cheat === "thin") {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, H * 0.26);
      ctx.beginPath();
      ctx.moveTo(x - L * 0.42, cy - H * 0.05);
      ctx.lineTo(x + L * 0.34, cy - H * 0.1);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = al.engine || shade(body, -30);
    const ew = L * 0.16, eh = H * 0.8;
    roundRect(ctx, x - L * 0.16, cy + H * 0.55, ew, eh, eh * 0.4);
    ctx.fill();

    ctx.fillStyle = "#0f2233";
    ctx.beginPath();
    ctx.arc(x - L * 0.4, cy - H * 0.25, Math.max(1, H * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }

  _drawRunway(ctx, cam, startX, endX, airport, isDeparture) {
    const gy = cam.worldToScreenY(this.groundElevation);
    if (gy > cam.h + 60 || gy < -200) return;

    const sx0 = cam.worldToScreenX(startX);
    const sx1 = cam.worldToScreenX(endX);
    if (sx1 < -50 || sx0 > cam.w + 50) {
      if (!isDeparture) return;
    }

    const rwHeight = Math.max(4, cam.toScreenLen(10));
    const top = gy;

    // Taxiway leading up to the departure threshold so the queue sits
    // off the runway.
    if (isDeparture) {
      const taxLen = this.singleField ? 2200 : 1800;
      const tax0 = cam.worldToScreenX(startX - taxLen);
      const tax1 = sx0;
      if (tax1 > -40 && tax0 < cam.w + 40) {
        ctx.fillStyle = "#32363c";
        ctx.fillRect(tax0, top, tax1 - tax0, rwHeight);
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = Math.max(1, rwHeight * 0.1);
        ctx.setLineDash([Math.max(5, cam.toScreenLen(18)), Math.max(5, cam.toScreenLen(14))]);
        ctx.beginPath();
        ctx.moveTo(tax0, gy + rwHeight / 2);
        ctx.lineTo(tax1, gy + rwHeight / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (sx1 < -50 || sx0 > cam.w + 50) return;

    // Asphalt.
    ctx.fillStyle = "#3a3f47";
    ctx.fillRect(sx0, top, sx1 - sx0, rwHeight);

    // Centerline dashes.
    const midY = gy + rwHeight / 2;
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = Math.max(1, rwHeight * 0.12);
    ctx.setLineDash([Math.max(6, cam.toScreenLen(30)), Math.max(6, cam.toScreenLen(20))]);
    ctx.beginPath();
    ctx.moveTo(sx0, midY);
    ctx.lineTo(sx1, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threshold bars.
    ctx.fillStyle = "#e2e8f0";
    const thW = Math.max(3, cam.toScreenLen(8));
    ctx.fillRect(sx0, top + 1, thW, Math.max(2, rwHeight - 2));
    ctx.fillRect(sx1 - thW, top + 1, thW, Math.max(2, rwHeight - 2));

    // Direction chevrons hovering just above the runway, pointing the way
    // to take off / land (always down-range toward the destination).
    const chevY = gy - Math.max(12, rwHeight * 1.6);
    const ch = 7;
    ctx.strokeStyle = "rgba(247,201,72,0.9)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const spacing = Math.max(48, cam.toScreenLen(600));
    for (let x = sx0 + spacing * 0.5; x < sx1; x += spacing) {
      if (x < -20 || x > cam.w + 20) continue;
      ctx.beginPath();
      ctx.moveTo(x - ch, chevY - ch);
      ctx.lineTo(x + ch, chevY);
      ctx.lineTo(x - ch, chevY + ch);
      ctx.stroke();
    }

    // Airport label.
    ctx.fillStyle = "rgba(9,15,28,0.85)";
    const label = `${airport.iata} · ${airport.name}`;
    ctx.font = "600 14px system-ui, sans-serif";
    const tw = ctx.measureText(label).width + 16;
    const lx = clamp((sx0 + sx1) / 2 - tw / 2, 8, cam.w - tw - 8);
    const ly = top - 48;
    roundRect(ctx, lx, ly, tw, 22, 6);
    ctx.fill();
    ctx.fillStyle = "#e5eefb";
    ctx.fillText(label, lx + 8, ly + 15);
  }

  _drawDistanceMarkers(ctx, cam) {
    const gy = cam.worldToScreenY(this.groundElevation);
    if (gy > cam.h || gy < 0) return;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    const stepM = 5000;
    const start = Math.max(0, Math.floor((cam.x - cam.w / cam.scale) / stepM) * stepM);
    for (let wx = start; wx < cam.x + cam.w / cam.scale; wx += stepM) {
      const sx = cam.worldToScreenX(wx);
      ctx.fillRect(sx, gy - 6, 2, 6);
      ctx.fillText(`${(wx / 1000).toFixed(0)} km`, sx + 4, gy - 8);
    }
  }
}

/* ---- small drawing helpers ---- */
function puff(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x - r * 0.5, y, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x, y - r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 0.55, y, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x, y + r * 0.15, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mixColor(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a, b, t) {
  const c = mixColor(hexToRgb(a), hexToRgb(b), t);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* STARFALL ROOFTOPS
   A lighthouse keeper's cat leaps between rooftops at dusk collecting lost stars.
   One button. 60 seconds. Score attack.
   Vanilla canvas, no libraries, no network. Logical size 960x540. */
(function () {
  "use strict";

  var W = 960;
  var H = 540;
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var params = new URLSearchParams(window.location.search);
  var AUTO = params.get("auto") === "1";

  // ---------- helpers ----------
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---------- game state ----------
  var MODE_TITLE = "title";
  var MODE_PLAY = "playing";
  var MODE_OVER = "over";

  var mode = MODE_TITLE;
  var score = 0;
  var starsCollected = 0;
  var timeLeft = 60;
  var elapsed = 0;
  var overTimer = 0;
  var worldTime = 0;
  // revision pass: combo system, floating score popups, screen-shake
  var combo = 0;        // consecutive stars gathered without tumbling
  var bestCombo = 0;
  var popups = [];      // {x, y, life, maxLife, text, colour}
  var shake = 0;        // current screen-shake magnitude in px, decays

  function comboMult() {
    // every 5 chained stars raises the multiplier by one, capped at x5
    return Math.min(5, 1 + Math.floor(combo / 5));
  }

  function addPopup(x, y, text, colour) {
    popups.push({ x: x, y: y, life: 0, maxLife: 0.9, text: text, colour: colour });
  }

  // ---------- world ----------
  var roofs = [];        // {x, w, top, seed}
  var stars = [];        // {x, y, taken, phase}
  var particles = [];    // {x, y, vx, vy, life, maxLife, size, colour}
  var skylineFar = [];   // distant buildings {x, w, h}
  var skylineNear = [];  // nearer silhouettes {x, w, h}
  var bgStars = [];      // twinkling sky stars {x, y, r, phase, speed}
  var nextRoofRight = 0;
  var lastRoofTop = 420;

  function makeSkyline(list, count, minH, maxH, minW, maxW) {
    var x = -40;
    for (var i = 0; i < count; i++) {
      var w = rand(minW, maxW);
      list.push({ x: x, w: w, h: rand(minH, maxH) });
      x += w + rand(4, 26);
    }
    return x;
  }
  var farEnd = makeSkyline(skylineFar, 26, 60, 170, 40, 90);
  var nearEnd = makeSkyline(skylineNear, 22, 30, 100, 60, 130);

  for (var s = 0; s < 110; s++) {
    bgStars.push({
      x: Math.random() * W,
      y: Math.random() * 300,
      r: rand(0.6, 1.9),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.6, 2.2)
    });
  }

  function addRoof(x, w, top) {
    var roof = { x: x, w: w, top: top, seed: Math.random() * 1000 };
    roofs.push(roof);
    return roof;
  }

  function starArc(cx, cy, count, spread, lift) {
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0.5 : i / (count - 1);
      stars.push({
        x: cx + (t - 0.5) * spread,
        y: cy - Math.sin(t * Math.PI) * lift,
        taken: false,
        phase: rand(0, Math.PI * 2)
      });
    }
  }

  function extendWorld() {
    while (nextRoofRight < W + 500) {
      var gap = rand(78, 168);
      var w = rand(170, 330);
      var top = clamp(lastRoofTop + rand(-46, 46), 356, 458);
      var roofX = nextRoofRight + gap;
      // an arc of lost stars floats over every gap
      starArc(nextRoofRight + gap / 2, Math.min(top, lastRoofTop) - 66, gap > 130 ? 5 : 3, gap * 0.92, 44);
      // sometimes a low line of stars skims a rooftop
      if (Math.random() < 0.45) {
        starArc(roofX + w / 2, top - 44, 3, w * 0.5, 16);
      }
      addRoof(roofX, w, top);
      lastRoofTop = top;
      nextRoofRight = roofX + w;
    }
  }

  function resetWorld() {
    roofs = [];
    stars = [];
    particles = [];
    nextRoofRight = 0;
    lastRoofTop = 420;
    addRoof(-80, 520, 420);
    nextRoofRight = 440;
    extendWorld();
  }

  // ---------- cat ----------
  var CAT_X = 228;
  var cat = {
    y: 420,          // feet height
    vy: 0,
    onGround: true,
    coyote: 0,
    buffer: 0,
    held: false,
    holdTime: 0,
    jumping: false,
    runPhase: 0,
    fallPeak: 420,   // highest feet point of current airborne stretch
    respawnGrace: 0
  };

  function speedNow() {
    var t = clamp(elapsed / 60, 0, 1);
    return 262 + 158 * t;
  }

  function startGame() {
    score = 0;
    starsCollected = 0;
    combo = 0;
    bestCombo = 0;
    popups = [];
    shake = 0;
    timeLeft = 60;
    elapsed = 0;
    overTimer = 0;
    resetWorld();
    cat.y = 420;
    cat.vy = 0;
    cat.onGround = true;
    cat.coyote = 0;
    cat.buffer = 0;
    cat.held = false;
    cat.holdTime = 0;
    cat.jumping = false;
    cat.fallPeak = 420;
    cat.respawnGrace = 0;
    mode = MODE_PLAY;
  }

  function endGame() {
    mode = MODE_OVER;
    overTimer = 0;
  }

  // ---------- input: the one button ----------
  function pressButton() {
    if (mode === MODE_TITLE) { startGame(); return; }
    if (mode === MODE_OVER) {
      if (overTimer > 0.7) startGame();
      return;
    }
    cat.buffer = 0.12;
    cat.held = true;
  }

  function releaseButton() {
    cat.held = false;
    // variable jump: letting go early cuts the rise
    if (mode === MODE_PLAY && cat.jumping && cat.vy < -190) {
      cat.vy = -190;
    }
    cat.jumping = false;
  }

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (!e.repeat) pressButton();
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      releaseButton();
    }
  });
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    pressButton();
  });
  window.addEventListener("pointerup", function () { releaseButton(); });
  canvas.addEventListener("touchstart", function (e) { e.preventDefault(); }, { passive: false });

  // ---------- autoplay (for hands-free capture / verification) ----------
  var autoHoldUntil = 0;
  function autoplayThink() {
    if (!AUTO || mode !== MODE_PLAY) return;
    var now = worldTime;
    if (cat.onGround) {
      // find the roof the cat is standing on
      var roof = null;
      for (var i = 0; i < roofs.length; i++) {
        if (CAT_X >= roofs[i].x - 2 && CAT_X <= roofs[i].x + roofs[i].w + 2) { roof = roofs[i]; break; }
      }
      if (roof) {
        var edgeDist = (roof.x + roof.w) - CAT_X;
        // find the next roof to judge the gap
        var next = null;
        for (var j = 0; j < roofs.length; j++) {
          if (roofs[j].x > roof.x + roof.w - 4) { next = roofs[j]; break; }
        }
        var gap = next ? (next.x - (roof.x + roof.w)) : 90;
        // leap when the edge is close; hold longer for wider / higher gaps
        if (edgeDist < 52) {
          cat.buffer = 0.12;
          cat.held = true;
          var lift = next ? clamp((roof.top - next.top) / 90, -0.4, 1) : 0;
          var hold = 0.14 + clamp(gap / 170, 0, 1) * 0.16 + lift * 0.05;
          autoHoldUntil = now + clamp(hold, 0.1, 0.34);
        }
      } else {
        // standing over nothing recognisable: hop if a star arc is just ahead
        for (var k = 0; k < stars.length; k++) {
          var st = stars[k];
          if (!st.taken && st.x > CAT_X + 30 && st.x < CAT_X + 130 && st.y < cat.y - 60) {
            cat.buffer = 0.12;
            cat.held = true;
            autoHoldUntil = now + 0.2;
            break;
          }
        }
      }
    }
    if (cat.held && now > autoHoldUntil) {
      releaseButton();
    }
  }

  // ---------- particles ----------
  function burst(x, y, n, colour) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2);
      var sp = rand(30, 150);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0, maxLife: rand(0.35, 0.7),
        size: rand(1.4, 3.2), colour: colour
      });
    }
  }

  // ---------- update ----------
  function update(dt) {
    worldTime += dt;

    // twinkling sky + parallax layers always drift a little
    var farSpeed = mode === MODE_PLAY ? speedNow() * 0.12 : 6;
    var nearSpeed = mode === MODE_PLAY ? speedNow() * 0.3 : 14;
    scrollSkyline(skylineFar, farSpeed * dt, 170, 40, 90, 60, 170);
    scrollSkyline(skylineNear, nearSpeed * dt, 100, 60, 130, 30, 100);

    if (mode === MODE_OVER) overTimer += dt;
    if (mode !== MODE_PLAY) { updateParticles(dt); return; }

    elapsed += dt;
    timeLeft = Math.max(0, 60 - elapsed);
    if (timeLeft <= 0) { endGame(); updateParticles(dt); return; }

    autoplayThink();

    var speed = speedNow();

    // scroll the world toward the cat
    var dx = speed * dt;
    var i;
    for (i = 0; i < roofs.length; i++) roofs[i].x -= dx;
    for (i = 0; i < stars.length; i++) stars[i].x -= dx;
    for (i = 0; i < popups.length; i++) popups[i].x -= dx;
    if (shake > 0) shake = Math.max(0, shake - dt * 16);
    nextRoofRight -= dx;
    extendWorld();
    while (roofs.length && roofs[0].x + roofs[0].w < -120) roofs.shift();
    while (stars.length && stars[0].x < -60) stars.shift();

    // timers for forgiving one-button feel
    if (cat.buffer > 0) cat.buffer -= dt;
    if (cat.respawnGrace > 0) cat.respawnGrace -= dt;

    var wasGround = cat.onGround;
    if (wasGround) { cat.coyote = 0.1; cat.fallPeak = cat.y; }
    else if (cat.coyote > 0) cat.coyote -= dt;

    // is there still roof under the cat?
    var groundTop = null;
    for (i = 0; i < roofs.length; i++) {
      var r = roofs[i];
      if (CAT_X >= r.x && CAT_X <= r.x + r.w) { groundTop = r.top; break; }
    }

    if (cat.onGround && groundTop === null) {
      cat.onGround = false; // ran off the edge; coyote time covers us
      cat.vy = 0;
    }

    // jump: buffered press + (ground or coyote)
    if (cat.buffer > 0 && (cat.onGround || cat.coyote > 0)) {
      cat.buffer = 0;
      cat.coyote = 0;
      cat.onGround = false;
      cat.jumping = true;
      cat.holdTime = 0;
      cat.vy = -585;
      cat.fallPeak = cat.y;
    }

    if (!cat.onGround) {
      // holding the button early in the rise stretches the leap
      if (cat.held && cat.jumping && cat.holdTime < 0.24 && cat.vy < 0) {
        cat.holdTime += dt;
        cat.vy -= 980 * dt;
      }
      cat.vy += 1560 * dt;
      if (cat.vy > 900) cat.vy = 900;
      var prevY = cat.y;
      cat.y += cat.vy * dt;
      if (cat.y < cat.fallPeak) cat.fallPeak = cat.y;

      // landing: feet cross a roof top while falling
      if (cat.vy >= 0) {
        for (i = 0; i < roofs.length; i++) {
          var rr = roofs[i];
          if (CAT_X >= rr.x - 2 && CAT_X <= rr.x + rr.w + 2 &&
              prevY <= rr.top + 1 && cat.y >= rr.top) {
            // landing feel: dust scaled by fall height, plus a soft
            // screen-shake when the cat drops a long way onto the roof
            var fallDist = rr.top - cat.fallPeak;
            cat.y = rr.top;
            cat.vy = 0;
            cat.onGround = true;
            cat.jumping = false;
            if (fallDist > 175) {
              shake = Math.min(7, (fallDist - 175) / 26);
              burst(CAT_X - 8, cat.y, 12, "rgba(216,196,160,0.85)");
              burst(CAT_X + 14, cat.y, 8, "rgba(190,170,140,0.7)");
            } else {
              burst(CAT_X, cat.y, 5, "rgba(216,196,160,0.8)");
            }
            break;
          }
        }
      }

      // fell into a gap: tumble and respawn on the next roof (forgiving)
      if (cat.y > H + 70) {
        respawnCat();
      }
    } else {
      cat.runPhase += dt * (speed / 26);
      if (groundTop !== null) cat.y = groundTop;
    }

    // star collection: cat centre near a star
    var cx = CAT_X + 6;
    var cy = cat.y - 26;
    for (i = 0; i < stars.length; i++) {
      var st2 = stars[i];
      if (st2.taken) continue;
      var ddx = st2.x - cx;
      var ddy = st2.y - cy;
      if (ddx * ddx + ddy * ddy < 34 * 34) {
        st2.taken = true;
        starsCollected += 1;
        combo += 1;
        if (combo > bestCombo) bestCombo = combo;
        var gained = 10 * comboMult();
        score += gained;
        burst(st2.x, st2.y, 10, "#ffe9a8");
        addPopup(st2.x, st2.y - 18,
          comboMult() > 1 ? ("+" + gained + "  x" + comboMult()) : ("+" + gained),
          comboMult() > 1 ? "#ffc46e" : "#fff3d6");
      }
    }

    updateParticles(dt);
  }

  function respawnCat() {
    // tumbling into a gap breaks the combo chain
    if (combo >= 5) addPopup(CAT_X + 10, cat.y - 90, "combo lost", "#ff9d6e");
    combo = 0;
    shake = Math.max(shake, 3);
    // next roof ahead of the cat becomes the landing spot
    var target = null;
    for (var i = 0; i < roofs.length; i++) {
      if (roofs[i].x + roofs[i].w > CAT_X + 30) { target = roofs[i]; break; }
    }
    if (!target && roofs.length) target = roofs[roofs.length - 1];
    if (target) {
      // shift the world so that roof sits comfortably under the cat
      var shift = (target.x + Math.min(60, target.w * 0.3)) - CAT_X;
      for (var j = 0; j < roofs.length; j++) roofs[j].x -= shift;
      for (var k = 0; k < stars.length; k++) stars[k].x -= shift;
      nextRoofRight -= shift;
      cat.y = target.top;
    } else {
      cat.y = 420;
    }
    cat.vy = 0;
    cat.onGround = true;
    cat.jumping = false;
    cat.held = false;
    cat.respawnGrace = 0.6;
    burst(CAT_X, cat.y - 20, 8, "rgba(255,233,168,0.7)");
  }

  function scrollSkyline(list, dx, maxH, minW, maxW, minH) {
    var end = -Infinity;
    for (var i = 0; i < list.length; i++) {
      list[i].x -= dx;
      if (list[i].x + list[i].w > end) end = list[i].x + list[i].w;
    }
    while (list.length && list[0].x + list[0].w < -60) list.shift();
    while (end < W + 80) {
      var w = rand(minW, maxW);
      list.push({ x: end + rand(4, 26), w: w, h: rand(minH, maxH) });
      end = list[list.length - 1].x + w;
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
    }
    // floating score popups drift up and fade
    for (var j = popups.length - 1; j >= 0; j--) {
      var pp = popups[j];
      pp.life += dt;
      pp.y -= 44 * dt;
      if (pp.life >= pp.maxLife) popups.splice(j, 1);
    }
  }

  // ---------- drawing ----------
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#171233");
    g.addColorStop(0.45, "#33235c");
    g.addColorStop(0.75, "#7a3d63");
    g.addColorStop(0.92, "#d97b4a");
    g.addColorStop(1, "#f2a65a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // twinkling background stars (fade near the horizon glow)
    for (var i = 0; i < bgStars.length; i++) {
      var b = bgStars[i];
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(worldTime * b.speed + b.phase));
      var fade = 1 - clamp((b.y - 180) / 160, 0, 0.8);
      ctx.globalAlpha = tw * fade * 0.9;
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // low moon
    ctx.fillStyle = "rgba(255,240,200,0.9)";
    ctx.beginPath();
    ctx.arc(838, 84, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(51,35,92,0.55)";
    ctx.beginPath();
    ctx.arc(828, 76, 21, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLighthouse() {
    var lx = 74;
    var baseY = 470;
    // sweeping beam, rotating slowly
    var ang = Math.sin(worldTime * 0.45) * 0.5 - 0.08;
    ctx.save();
    ctx.translate(lx, baseY - 196);
    ctx.rotate(ang);
    var beam = ctx.createLinearGradient(0, 0, 430, 0);
    beam.addColorStop(0, "rgba(255,236,170,0.34)");
    beam.addColorStop(1, "rgba(255,236,170,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(430, -34);
    ctx.lineTo(430, 34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // tower silhouette
    ctx.fillStyle = "#191430";
    ctx.beginPath();
    ctx.moveTo(lx - 17, baseY);
    ctx.lineTo(lx - 10, baseY - 178);
    ctx.lineTo(lx + 10, baseY - 178);
    ctx.lineTo(lx + 17, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(lx - 14, baseY - 200, 28, 24);
    ctx.fillStyle = "#ffd977";
    ctx.beginPath();
    ctx.arc(lx, baseY - 190, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // rocks
    ctx.fillStyle = "#120e26";
    ctx.beginPath();
    ctx.ellipse(lx, baseY + 4, 62, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSkylineLayer(list, baseY, colour) {
    ctx.fillStyle = colour;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      ctx.fillRect(b.x, baseY - b.h, b.w, b.h + 200);
    }
  }

  function drawLitWindows(list, baseY, colour, density) {
    ctx.fillStyle = colour;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var seed = Math.floor(b.x * 0.13 + b.w);
      for (var wy = baseY - b.h + 10; wy < baseY - 14; wy += 17) {
        for (var wx = b.x + 7; wx < b.x + b.w - 8; wx += 14) {
          var hsh = Math.sin(seed * 12.9898 + wx * 0.37 + wy * 0.91) * 43758.5453;
          if ((hsh - Math.floor(hsh)) < density) ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
  }

  function drawRoofs() {
    for (var i = 0; i < roofs.length; i++) {
      var r = roofs[i];
      // body of the building below the roofline
      var g = ctx.createLinearGradient(0, r.top, 0, H);
      g.addColorStop(0, "#2c2145");
      g.addColorStop(1, "#171130");
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.top, r.w, H - r.top + 20);
      // roof slab with a warm dusk rim
      ctx.fillStyle = "#3d2c5c";
      ctx.fillRect(r.x - 3, r.top - 6, r.w + 6, 9);
      ctx.fillStyle = "rgba(255,170,90,0.5)";
      ctx.fillRect(r.x - 3, r.top - 6, r.w + 6, 2);

      // rooftop furniture, placed deterministically from the roof seed
      var s1 = Math.sin(r.seed) * 0.5 + 0.5;
      var s2 = Math.sin(r.seed * 1.7) * 0.5 + 0.5;
      ctx.fillStyle = "#241a3e";
      if (r.w > 130) {
        // chimney
        var chX = r.x + 18 + s1 * (r.w * 0.4);
        ctx.fillRect(chX, r.top - 30, 15, 25);
        ctx.fillRect(chX - 2, r.top - 34, 19, 5);
      }
      if (r.w > 200) {
        // water tower
        var wtX = r.x + r.w - 58 - s2 * 30;
        ctx.fillRect(wtX, r.top - 52, 30, 26);
        ctx.beginPath();
        ctx.moveTo(wtX - 3, r.top - 52);
        ctx.lineTo(wtX + 15, r.top - 64);
        ctx.lineTo(wtX + 33, r.top - 52);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(wtX + 4, r.top - 27, 4, 21);
        ctx.fillRect(wtX + 22, r.top - 27, 4, 21);
      }
      if (r.w > 105 && s2 > 0.45) {
        // antenna with a blinking tip
        var aX = r.x + r.w * (0.3 + s1 * 0.4);
        ctx.fillRect(aX, r.top - 44, 3, 39);
        var blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(worldTime * 3 + r.seed));
        ctx.fillStyle = "rgba(255,90,80," + blink.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(aX + 1.5, r.top - 47, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#241a3e";
      }
      // a few lit windows on the facade
      ctx.fillStyle = "rgba(255,205,110,0.5)";
      for (var wy2 = r.top + 26; wy2 < H - 18; wy2 += 34) {
        for (var wx2 = r.x + 14; wx2 < r.x + r.w - 14; wx2 += 30) {
          var hh = Math.sin(r.seed * 3.1 + wx2 * 0.53 + wy2 * 1.13) * 10000;
          if ((hh - Math.floor(hh)) < 0.28) ctx.fillRect(wx2, wy2, 8, 11);
        }
      }
    }
  }

  function drawStarShape(x, y, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.46;
      var a = rot + (i / 10) * Math.PI * 2 - Math.PI / 2;
      var px = x + Math.cos(a) * rad;
      var py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawStars() {
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      if (st.taken) continue;
      var bob = Math.sin(worldTime * 2.4 + st.phase) * 3;
      var y = st.y + bob;
      var pulse = 0.85 + 0.15 * Math.sin(worldTime * 3.2 + st.phase);
      ctx.save();
      ctx.shadowColor = "rgba(255,220,120,0.95)";
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = "#ffe9a8";
      drawStarShape(st.x, y, 11 * pulse, Math.sin(worldTime + st.phase) * 0.25);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fffbe8";
      drawStarShape(st.x, y, 5, Math.sin(worldTime + st.phase) * 0.25);
      ctx.fill();
    }
  }

  function drawCat() {
    var x = CAT_X;
    var feet = cat.y;
    var t = worldTime;
    var airborne = !cat.onGround;
    var stretch = airborne ? clamp(-cat.vy / 900, -0.35, 0.5) : 0;

    ctx.save();
    ctx.translate(x, feet);
    if (cat.respawnGrace > 0) ctx.globalAlpha = clamp(0.72 + 0.28 * Math.sin(t * 30), 0.35, 1);

    // tail: a smooth waving curve behind the body
    ctx.strokeStyle = "#241d3d";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-16, -22);
    var tw = Math.sin(t * 6) * 5;
    ctx.quadraticCurveTo(-32, -30 + tw, -36, -46 + tw * 1.6);
    ctx.stroke();

    // legs
    ctx.strokeStyle = "#241d3d";
    ctx.lineWidth = 5;
    var lp = cat.runPhase;
    var legSwing = airborne ? 0 : Math.sin(lp) * 8;
    ctx.beginPath();
    // back legs
    ctx.moveTo(-9, -12);
    ctx.lineTo(-9 + (airborne ? -4 : legSwing), airborne ? -2 : 0);
    ctx.moveTo(2, -12);
    ctx.lineTo(2 + (airborne ? 7 : -legSwing), airborne ? -4 : 0);
    // front legs
    ctx.moveTo(10, -12);
    ctx.lineTo(10 + (airborne ? 9 : legSwing), airborne ? -3 : 0);
    ctx.moveTo(15, -13);
    ctx.lineTo(15 + (airborne ? 4 : -legSwing * 0.8), airborne ? -7 : 0);
    ctx.stroke();

    // body
    ctx.fillStyle = "#2b2347";
    ctx.beginPath();
    ctx.ellipse(0, -24 - stretch * 4, 21 + stretch * 5, 12.5 - stretch * 2, airborne ? -0.12 : 0, 0, Math.PI * 2);
    ctx.fill();
    // warm rim light along the back
    ctx.strokeStyle = "rgba(255,170,90,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -24 - stretch * 4, 21 + stretch * 5, 12.5 - stretch * 2, airborne ? -0.12 : 0, Math.PI * 1.08, Math.PI * 1.72);
    ctx.stroke();

    // head
    var hx = 20;
    var hy = -36 - stretch * 5;
    ctx.fillStyle = "#2b2347";
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.beginPath();
    ctx.moveTo(hx - 9, hy - 6);
    ctx.lineTo(hx - 7, hy - 17);
    ctx.lineTo(hx - 1, hy - 9);
    ctx.closePath();
    ctx.moveTo(hx + 3, hy - 9);
    ctx.lineTo(hx + 8, hy - 18);
    ctx.lineTo(hx + 11, hy - 7);
    ctx.closePath();
    ctx.fill();
    // eye: a calm amber slit
    ctx.fillStyle = "#ffcf6e";
    ctx.beginPath();
    ctx.ellipse(hx + 5, hy - 1, 2.4, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // scarf: keeper-orange, fluttering behind the neck
    ctx.strokeStyle = "#e8641e";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy + 7);
    var fl = Math.sin(t * 9) * 4 + (airborne ? 3 : 0);
    ctx.quadraticCurveTo(hx - 18, hy + 9 + fl, hx - 27, hy + 5 + fl * 1.7);
    ctx.stroke();
    ctx.fillStyle = "#f07f2e";
    ctx.beginPath();
    ctx.arc(hx - 4, hy + 7, 4.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = 1 - p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.textBaseline = "top";
    // score
    ctx.font = "700 26px Georgia, serif";
    ctx.fillStyle = "#ffe9a8";
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + score, 20, 14);
    ctx.font = "15px Georgia, serif";
    ctx.fillStyle = "#e8dcc0";
    ctx.fillText("★ " + starsCollected, 22, 46);
    if (combo >= 2) {
      ctx.font = "700 16px Georgia, serif";
      ctx.fillStyle = comboMult() > 1 ? "#ffc46e" : "#e8dcc0";
      ctx.fillText("COMBO " + combo + (comboMult() > 1 ? "  ·  x" + comboMult() : ""), 22, 68);
    }
    // timer: a shrinking sun-bar plus numerals
    ctx.textAlign = "center";
    ctx.font = "700 30px Georgia, serif";
    ctx.fillStyle = timeLeft <= 10.5 ? "#ff9d6e" : "#fff3d6";
    ctx.fillText(Math.ceil(timeLeft) + "", W / 2, 10);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(W / 2 - 90, 46, 180, 5);
    ctx.fillStyle = timeLeft <= 10.5 ? "#ff9d6e" : "#ffc46e";
    ctx.fillRect(W / 2 - 90, 46, 180 * clamp(timeLeft / 60, 0, 1), 5);
    ctx.textAlign = "left";
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = "rgba(16,11,34,0.78)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,233,168,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawTitle() {
    panel(W / 2 - 330, 120, 660, 250);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "700 46px Georgia, serif";
    ctx.fillText("STARFALL ROOFTOPS", W / 2, 158);
    ctx.fillStyle = "#e8dcc0";
    ctx.font = "italic 18px Georgia, serif";
    ctx.fillText("The lighthouse keeper's cat is out at dusk,", W / 2, 222);
    ctx.fillText("gathering the stars that fell on the rooftops.", W / 2, 246);
    ctx.font = "17px Georgia, serif";
    ctx.fillStyle = "#fff3d6";
    ctx.fillText("ONE BUTTON — SPACE / click / tap", W / 2, 292);
    ctx.font = "15px Georgia, serif";
    ctx.fillStyle = "#cdbf9e";
    ctx.fillText("press to jump · hold for a higher leap · release to fall", W / 2, 318);
    ctx.fillText("60 seconds · score attack · do not mind the gaps, the cat has nine lives", W / 2, 342);
    ctx.textAlign = "left";
  }

  function drawOver() {
    panel(W / 2 - 260, 130, 520, 240);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "700 38px Georgia, serif";
    ctx.fillText("DUSK SETTLES", W / 2, 162);
    ctx.fillStyle = "#fff3d6";
    ctx.font = "700 30px Georgia, serif";
    ctx.fillText("SCORE  " + score, W / 2, 224);
    ctx.font = "18px Georgia, serif";
    ctx.fillStyle = "#e8dcc0";
    ctx.fillText("Stars gathered: " + starsCollected, W / 2, 268);
    ctx.fillText("Best combo: " + bestCombo + (bestCombo >= 5 ? "  (top multiplier x" + Math.min(5, 1 + Math.floor(bestCombo / 5)) + ")" : ""), W / 2, 294);
    ctx.font = "16px Georgia, serif";
    ctx.fillStyle = "#cdbf9e";
    ctx.fillText("Press SPACE / click to leap again", W / 2, 322);
    ctx.textAlign = "left";
  }

  function drawPopups() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < popups.length; i++) {
      var pp = popups[i];
      var a = 1 - pp.life / pp.maxLife;
      ctx.globalAlpha = a;
      ctx.font = "700 17px Georgia, serif";
      ctx.fillStyle = pp.colour;
      ctx.fillText(pp.text, pp.x, pp.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0.2) {
      ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
    }
    drawSky();
    drawLighthouse();
    drawSkylineLayer(skylineFar, 472, "#241a44");
    drawLitWindows(skylineFar, 472, "rgba(255,205,110,0.35)", 0.16);
    drawSkylineLayer(skylineNear, 500, "#1b1436");
    drawRoofs();
    drawStars();
    drawParticles();
    drawCat();
    drawPopups();
    ctx.restore();
    if (mode === MODE_PLAY) drawHUD();
    if (mode === MODE_TITLE) { drawHUDPreview(); drawTitle(); }
    if (mode === MODE_OVER) drawOver();
  }

  function drawHUDPreview() {
    ctx.font = "700 26px Georgia, serif";
    ctx.fillStyle = "rgba(255,233,168,0.6)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("SCORE 0", 20, 14);
  }

  // ---------- verification / capture hook ----------
  window.__starfall = {
    getState: function () {
      return {
        score: score,
        stars: starsCollected,
        timeLeft: Math.round(Math.max(0, timeLeft) * 10) / 10,
        running: mode === MODE_PLAY,
        over: mode === MODE_OVER,
        combo: combo,
        bestCombo: bestCombo
      };
    }
  };

  // ---------- main loop ----------
  resetWorld();
  var lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.033) dt = 0.033;
    if (dt < 0) dt = 0;
    update(dt);
    draw();
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);

  if (AUTO) {
    startGame();
  }
})();

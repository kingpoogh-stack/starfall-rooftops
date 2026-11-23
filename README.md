# STARFALL ROOFTOPS

A tiny browser game about a lighthouse keeper's cat, leaping between rooftops at dusk to gather lost stars.

## The one prompt

> "Build a tiny browser game: a lighthouse keeper's cat leaps between rooftops at dusk collecting lost stars, one-button controls, 60 seconds, score attack."

This entire game was built from that single prompt by an AI agent — the prompt above is the whole creative brief, and it appears verbatim as the opening card of the gameplay video.

## How to play

Open `game/index.html` in any modern browser. No build step, no server, no network needed.

- **One button only:** SPACE, mouse click, or tap.
- **Press** to jump. **Hold longer** for a higher, longer leap. **Release** to fall.
- The cat runs on its own across an endless dusk skyline. Land on rooftops, leap through the arcs of lost stars floating above the gaps.
- Each star scores points and builds your combo multiplier. Fall off a roof and the combo resets — the cat tumbles and respawns on the next roof, so keep attacking the score.
- You have **60 seconds**. Speed slowly ramps up. When time runs out, the end screen shows your final score, best combo, and stars collected. Press the button to play again.

Tip: a short hop grabs the low stars on a roof; a full held leap is for the wide gaps and the high star arcs.

## How it was made

- One prompt, one small hand-written codebase: `game/index.html`, `game/style.css`, and a single `game/game.js` (vanilla canvas, `requestAnimationFrame` with delta time — no libraries, no external resources).
- The scene is drawn entirely in code: layered parallax with a lighthouse and sweeping beam, a distant skyline, and near rooftops with chimneys, water towers and antennas; a dusk gradient sky; twinkling background stars; and a cat built from smooth canvas shapes with a waving tail, running legs and a fluttering scarf.
- Game feel was a priority for a one-button game: variable jump height, coyote time, jump buffering, landing dust, a soft screen-shake after long falls, sparkle bursts and floating score popups.
- For hands-free capture and verification, opening the page with `?auto=1` starts an autoplay run (the cat jumps by itself), and the page exposes `window.__starfall.getState()` returning `{ score, stars, timeLeft, running, over }`.

## The entrypoint (`main.ts`)

`main.ts` is the make.fun runner entrypoint. It resolves the bot directory from `MAKEFUN_BOT_DIR` (falling back to the script's own directory), reads `POST.json` there, and copies it into `MAKEFUN_OUTPUT_DIR` (falling back to `/output`), creating the output directory recursively first. Node 22, standard library only.

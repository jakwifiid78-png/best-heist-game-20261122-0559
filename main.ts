// Vaultbreak: The Midnight Lift — a make.fun best-heist-game entry
// (Node 22, standard library only). The game is this directory's game/
// folder: plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request).
// This program hands it in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// The game: a top-down bank heist on one floor. The thief lifts the $5,000
// vault gold plus three stashes while three guards patrol with vision
// cones and three wall cameras sweep red sight beams; guard cones and
// camera beams both fill the alarm meter, which drains while hidden.
// At 100% the alarm trips — guards chase, lights flash red, the siren
// sounds. Grab all the loot to unlock the getaway van, then escape
// before the 3:00 clock runs out. 3 lives, score in dollars, title /
// play / win / game-over screens, restart with R, M mutes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in an entry with no screenshots: the
// cover frame is what the judge sees first, so a missing screenshots/
// folder is a build error, not a warning.
const shotDir = join(here, 'screenshots');
if (!existsSync(shotDir) || readdirSync(shotDir).filter((f) => !f.startsWith('.')).length === 0) {
  throw new Error('no screenshots in screenshots/ — run node take-shots.mjs first');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

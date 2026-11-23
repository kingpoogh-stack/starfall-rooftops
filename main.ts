// STARFALL ROOFTOPS — make.fun entrypoint, written for this entry by hand.
// The whole job here is deliberately tiny: find the X post record that sits
// next to this script (or in the bot directory the runner points us at) and
// hand a copy of it to the output directory, creating that directory first
// if the runner has not made it yet. Nothing else is fetched or generated.

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function botDirectory() {
  const fromEnv = process.env.MAKEFUN_BOT_DIR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return dirname(fileURLToPath(import.meta.url));
}

function outputDirectory() {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return "/output";
}

const sourcePath = join(botDirectory(), "POST.json");
const targetDir = outputDirectory();
mkdirSync(targetDir, { recursive: true });
copyFileSync(sourcePath, join(targetDir, "POST.json"));
console.log("Copied POST.json to " + targetDir);

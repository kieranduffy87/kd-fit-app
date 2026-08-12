/* Assembles www/ for Capacitor to copy into the native projects.

   The web app is served straight from the repo root on GitHub Pages,
   so there is no build step there. Capacitor needs a directory that
   holds only the shipping files — this copies them, and nothing else.
*/
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'www');

const ITEMS = [
  'index.html',
  'manifest.json',
  'css',
  'js',
  'fonts',
  'icons',
  'img'
];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for(const item of ITEMS){
  const from = path.join(ROOT, item);
  if(!existsSync(from)){
    console.warn(`skipped (missing): ${item}`);
    continue;
  }
  await cp(from, path.join(OUT, item), { recursive: true });
  console.log(`copied ${item}`);
}

/* The service worker is deliberately not copied. Inside the shell the
   files are already local, so it buys nothing and a stale cache there
   is a bug with no upside. app.js skips registration on native anyway;
   this makes sure there is no sw.js for it to find. */

// Strip the web manifest link — the native shell has its own identity,
// and iOS logs a warning for a manifest it will never use.
const htmlPath = path.join(OUT, 'index.html');
const html = await readFile(htmlPath, 'utf8');
await writeFile(
  htmlPath,
  html.replace('<link rel="manifest" href="manifest.json">', '<!-- manifest omitted in the native shell -->')
);

console.log(`\nwww/ ready — run \`npx cap sync\` next`);

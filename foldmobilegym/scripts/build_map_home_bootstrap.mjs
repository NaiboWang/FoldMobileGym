import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const outputPath = path.resolve(process.argv[3] || path.join(repoRoot, 'apps/Map/sw/vector/bootstrap-manifest.json'));
const fullManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mobilegym-data/map/vector/manifest.json'), 'utf8'));
const bootstrap = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps/Map/sw/vector/bootstrap-manifest.json'), 'utf8'));

// Covers the default Beijing center at zoom 17 on the inner display, with one
// extra tile of margin for different host-window sizes. Other map views still
// fall through to the complete vector manifest.
function isHomeTile(entry) {
  const match = entry.url?.match(/!1i(\d+)!2i(\d+)!3i(\d+)/);
  if (!match) return false;
  const [, zoom, x, y] = match.map(Number);
  return zoom === 17 && x >= 107888 && x <= 107893 && y >= 49628 && y <= 49633;
}

const homeTiles = fullManifest.entries.filter(isHomeTile);
if (homeTiles.length < 16) throw new Error(`Expected default-viewport vector tiles; found ${homeTiles.length}`);
for (const entry of homeTiles) {
  const file = path.join(repoRoot, 'mobilegym-data/map/vector/files', entry.file);
  if (!fs.existsSync(file)) throw new Error(`Missing vector tile: ${file}`);
}

const entries = [...bootstrap.entries.filter((entry) => !isHomeTile(entry)), ...homeTiles];
const deduped = [...new Map(entries.map((entry) => [entry.url, entry])).values()];
bootstrap.filter = 'SDK/bootstrap resources plus default Beijing viewport vector tiles at zoom 17';
bootstrap.cacheName = 'map-bootstrap-cache-home-z17-v1';
bootstrap.entries = deduped;
fs.writeFileSync(outputPath, `${JSON.stringify(bootstrap, null, 2)}\n`);
console.log(`Wrote ${outputPath}: ${homeTiles.length} home tiles, ${deduped.length} total entries`);

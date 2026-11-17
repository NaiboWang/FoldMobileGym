import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type CacheEntry = { url: string; file: string };
const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'apps/Map/sw/vector/bootstrap-manifest.json');
const filesRoot = path.join(repoRoot, 'mobilegym-data/map/vector/files');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  cacheName: string;
  entries: CacheEntry[];
};

describe('map home bootstrap cache', () => {
  it('indexes all 36 default Beijing viewport tiles without missing payloads', () => {
    const coordinates = new Set<string>();
    for (const entry of manifest.entries) {
      const match = entry.url.match(/!1i(\d+)!2i(\d+)!3i(\d+)/);
      if (!match) continue;
      const [, zoom, x, y] = match.map(Number);
      if (zoom !== 17 || x < 107888 || x > 107893 || y < 49628 || y > 49633) continue;
      coordinates.add(`${x},${y}`);
      expect(fs.existsSync(path.join(filesRoot, entry.file)), entry.file).toBe(true);
    }

    expect(coordinates.size).toBe(36);
    expect(manifest.cacheName).toBe('map-bootstrap-cache-home-z17-v1');
    expect(manifest.entries.length).toBeLessThan(150);
  });
});

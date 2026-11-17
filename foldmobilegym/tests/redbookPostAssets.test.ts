import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Post = { cover?: string; images?: string[] };

describe('RedBook post image mirror', () => {
  it('contains every non-empty image referenced by the current post dataset', () => {
    const root = process.cwd();
    const posts = JSON.parse(fs.readFileSync(path.join(root, 'apps/RedBook/data/notes.json'), 'utf8')) as Post[];
    const references = posts.flatMap((post) => [post.cover, ...(post.images ?? [])])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const unique = [...new Set(references)];
    const invalid = unique.filter((reference) => !/^\.\/images\/posts\/[a-z0-9_-]+\/\d+\.(jpe?g|png|webp)$/i.test(reference));
    const missingOrEmpty = unique.filter((reference) => {
      if (invalid.includes(reference)) return false;
      const file = path.join(root, 'mobilegym-data/redbook', reference.slice(2));
      return !fs.existsSync(file) || fs.statSync(file).size === 0;
    });

    expect(posts.length).toBeGreaterThan(4000);
    expect(references.length).toBeGreaterThan(9000);
    expect(invalid).toEqual([]);
    expect(missingOrEmpty).toEqual([]);
  });
});

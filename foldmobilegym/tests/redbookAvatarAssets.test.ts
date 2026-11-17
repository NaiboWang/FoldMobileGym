import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import missingAvatarPaths from '../apps/RedBook/data/missingAvatarPaths.json';
import { REDBOOK_AVATAR_FALLBACK_URL, resolveAvatarAsset } from '../apps/RedBook/data/loader';

describe('RedBook avatar assets', () => {
  it('keeps the missing-avatar index aligned with the local media mirror', () => {
    const root = process.cwd();
    const users = JSON.parse(fs.readFileSync(path.join(root, 'apps/RedBook/data/users.json'), 'utf8')) as Array<{ avatar?: string }>;
    const missing = users
      .map((user) => user.avatar)
      .filter((avatar): avatar is string => typeof avatar === 'string' && /^\.\/images\/avatars\/[^/]+$/.test(avatar))
      .filter((avatar) => !fs.existsSync(path.join(root, 'mobilegym-data/redbook', avatar)));

    expect([...new Set(missing)].sort()).toEqual(missingAvatarPaths);
    expect(missing.length).toBeGreaterThan(0);
    expect(resolveAvatarAsset(missing[0])).toBe(REDBOOK_AVATAR_FALLBACK_URL);

    const present = users.find((user) => user.avatar && !missingAvatarPaths.includes(user.avatar));
    expect(present?.avatar).toBeDefined();
    expect(resolveAvatarAsset(present!.avatar!)).toMatch(/^\/cdn\/redbook\/images\/avatars\//);
  });
});

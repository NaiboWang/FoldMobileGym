import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const outputPath = path.resolve(process.argv[3] || path.join(repoRoot, 'apps/RedBook/data/missingAvatarPaths.json'));
const users = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps/RedBook/data/users.json'), 'utf8'));
const mediaRoot = path.join(repoRoot, 'mobilegym-data/redbook');

const missing = [...new Set(users
  .map((user) => user.avatar)
  .filter((avatar) => typeof avatar === 'string' && /^\.\/images\/avatars\/[^/]+$/.test(avatar))
  .filter((avatar) => !fs.existsSync(path.join(mediaRoot, avatar)))
)].sort();

fs.writeFileSync(outputPath, `${JSON.stringify(missing)}\n`);
console.log(`Wrote ${outputPath}: ${missing.length} missing avatars out of ${users.length} users`);

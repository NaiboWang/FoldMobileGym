// Inspect literal release-guide paths without executing Markdown or shell commands.
import fs from 'node:fs';
import path from 'node:path';
export function resolveFrontendProject(root, fileExists = name => fs.existsSync(name) && fs.statSync(name).isFile()) {
  const projects = ['foldmobilegym', 'mobilegym'].map(name => path.resolve(root, name)).filter(name => fileExists(path.join(name, 'package.json')));
  if (projects.length !== 1) throw Error(`Expected one frontend package, found ${projects.length}; do not infer a Python module or silently choose between duplicate frontends`);
  return projects[0];
}
export function validateReleaseGuide(markdown, options) {
  const root = path.resolve(options.root), directoryExists = options.directoryExists ?? (name => fs.existsSync(name) && fs.statSync(name).isDirectory());
  const fileExists = options.fileExists ?? (name => fs.existsSync(name) && fs.statSync(name).isFile());
  const errors = [], contexts = [], scripts = [];
  let language = null, cwd = root, cloneName = null;
  const inside = name => name === root || name.startsWith(root + path.sep);
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim(), fence = line.match(/^```(\S*)/);
    if (fence) { language = language === null ? fence[1].toLowerCase() : null; cwd = root; cloneName = null; continue; }
    if (!['powershell', 'bash', 'sh', 'shell', 'cmd'].includes(language) || !line || line.startsWith('#')) continue;
    const location = `README.md:${index + 1}`;
    const clone = line.match(/^git\s+clone\s+https:\/\/github\.com\/[^/\s]+\/([^\s/]+?)(?:\.git)?$/);
    if (clone) { cloneName = clone[1]; continue; }
    const cd = line.match(/^cd\s+(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*(?:#.*)?$/);
    if (cd) {
      const target = cd[1] ?? cd[2] ?? cd[3];
      // The first cd after clone enters this checkout, regardless of the local destination name.
      if (cloneName && target === cloneName) { cwd = root; cloneName = null; contexts.push({ line: index + 1, path: '.' }); continue; }
      cloneName = null;
      const next = path.resolve(cwd, target);
      if (!inside(next) || !directoryExists(next)) errors.push(`${location}: directory does not exist inside checkout: ${target}`);
      else { cwd = next; contexts.push({ line: index + 1, path: path.relative(root, cwd) || '.' }); }
      continue;
    }
    if (/^(?:npm(?:\.cmd)?\s+(?:ci|install|run\s+\S+)|npx(?:\.cmd)?\s+(?:tsc|vitest|vite))(?:\s|$)/.test(line)) {
      if (!fileExists(path.join(cwd, 'package.json'))) errors.push(`${location}: npm/npx command is outside a package directory (${path.relative(root, cwd) || '.'})`);
      if (/^npm(?:\.cmd)?\s+ci(?:\s|$)/.test(line) && !fileExists(path.join(cwd, 'package-lock.json'))) errors.push(`${location}: npm ci requires package-lock.json`);
    }
    const command = line.match(/^(?:node|python3?)\s+(?:--test\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))/);
    const script = command && (command[1] ?? command[2] ?? command[3]);
    if (script && !script.startsWith('-') && /\.(?:m?js|py)$/.test(script)) {
      const resolved = path.resolve(cwd, script);
      if (!inside(resolved) || !fileExists(resolved)) errors.push(`${location}: script is absent from the documented directory: ${script}`);
      else scripts.push({ line: index + 1, path: path.relative(root, resolved) });
    }
  }
  return { passed: errors.length === 0, errors, contexts, scripts,
    scope: 'Literal shell-example directory/package/script existence only; no commands executed and no build/browser success inferred.' };
}
export function checkReleaseGuide(root) {
  const report = validateReleaseGuide(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), { root });
  if (!report.passed) throw Error(report.errors.join('\n'));
  return report;
}

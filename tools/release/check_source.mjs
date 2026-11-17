// Dependency-free receiver check. Export hashes are historical, not current hashes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReleaseGuide, resolveFrontendProject } from './release_guide.mjs';

export const runtimeModules = [
  'foldagent.ts', 'foldagent_benchmark.ts', 'foldagent_rules.ts',
  'foldagent_recovery_context.ts', 'foldagent_progress.ts',
  'foldagent_price_total_evidence.ts', 'foldagent_price_note_judge.ts',
  'foldagent_note_text_evidence.ts', 'foldagent_note_expression_evidence.ts',
  'foldagent_navigation_settle.ts', 'foldagent_meeting_source.ts',
  'foldagent_initial_window.ts', 'foldagent_evaluator.ts',
  'foldagent_calculation_evidence.ts',
];

export function checkSource(project) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(project, 'SOURCE_SNAPSHOT.json'), 'utf8'));
  if (!Array.isArray(snapshot.files) || !snapshot.files.length) throw Error('Empty source inventory');
  const seen = new Set();
  for (const item of snapshot.files) {
    const name = item?.path;
    if (typeof name !== 'string' || !name || /[\\:\0]/.test(name)
        || name.split('/').some(part => !part || part === '.' || part === '..')
        || seen.has(name)) throw Error('Unsafe or duplicate source inventory path');
    seen.add(name);
  }
  const required = new Set([...seen, ...runtimeModules, 'package.json', 'package-lock.json',
    'index.html', 'index.tsx', 'vite.config.ts', 'tsconfig.json', 'DATA_SNAPSHOT.json',
    'LICENSE', 'NOTICE']);
  const missing = [];
  for (const name of required) {
    let current = project;
    for (const part of name.split('/')) {
      current = path.join(current, part);
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
        throw Error(`Linked source path refused: ${name}`);
      }
    }
    if (!fs.existsSync(current) || !fs.lstatSync(current).isFile()) missing.push(name);
  }
  if (missing.length) throw Error(`Incomplete source: ${missing.length} missing files; first: ${missing.slice(0, 8).join(', ')}`);
  const entry = fs.readFileSync(path.join(project, 'index.tsx'), 'utf8');
  for (const name of ['foldagent', 'foldagent_benchmark']) {
    if (!new RegExp(`import\\s+['"]\\./${name}['"]`).test(entry)) throw Error(`Runtime entry import missing: ${name}`);
  }
  return { passed: true, foundation_files: seen.size, foldagent_modules: runtimeModules.length,
    scope: 'Source presence and runtime entry wiring only; run data verification, build and browser smoke separately. Export hashes are historical.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw Error('Usage: node tools/release/check_source.mjs');
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const project = resolveFrontendProject(root);
    const guide = path.basename(project) === 'foldmobilegym' ? { applicable: true, ...checkReleaseGuide(root) }
      : { applicable: false, scope: 'Research checkout retains mobilegym frontend and a separate Python foldagentgym module; standalone release-guide check is not applicable.' };
    console.log(JSON.stringify({ ...checkSource(project), frontend: path.basename(project), release_guide: guide }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

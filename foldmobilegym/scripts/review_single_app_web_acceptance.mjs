// Orchestrates existing bounded GUI diagnostics; never admits/scores a task.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3188/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/single-app-web-acceptance-'));
const cards = ['01', '02', '03', '04', '06', '07', '08', '09', '10', '11', '12', '13', '14'];
const counts = { '01': 2, '02': 4, '03': 8, '04': 4, '06': 2, '07': 2, '08': 2, '09': 2, '10': 4, '11': 2, '12': 2, '13': 2, '14': 2 };
const edgeCounts = { '01': 4, '02': 4, '04': 4, '09': 2, '10': 4, '11': 6, '12': 2, '13': 2, '14': 2 };
const runs = [
  ...cards.map(card => ({ name: `sa${card}`, script: `review_single_app_sa${card}.mjs`, count: counts[card] })),
  ...Object.entries(edgeCounts).map(([card, count]) => ({ name: `sa${card}-edges`, script: `review_single_app_sa${card}.mjs`, edges: true, count })),
  ...['06', '07', '08'].map(card => ({ name: `sa${card}-edges`, script: `review_single_app_sa${card}_edges.mjs`, count: card === '07' ? 2 : 4 })),
];
const results = [];
for (const run of runs) {
  console.log(`START ${run.name}`);
  const env = { ...process.env, FOLDAGENT_REVIEW_URL: url.href, FOLDAGENT_REVIEW_EDGES: run.edges ? '1' : '0' };
  // A developer's one-case filter must never silently narrow the stage gate.
  delete env.FOLDAGENT_REVIEW_CASE;
  delete env.FOLDAGENT_REVIEW_SEARCH_LAYER;
  // This extra date-axis probe is independent of the fixed original 78-group gate.
  delete env.FOLDAGENT_REVIEW_LATE_DATES;
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(import.meta.dirname, run.script)], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => resolve({ code: null, stdout, stderr: stderr + String(error) }));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
  fs.writeFileSync(path.join(output, `${run.name}.log`), result.stdout + result.stderr);
  let evidence;
  for (const line of result.stdout.trim().split(/\r?\n/).reverse()) {
    try { const value = JSON.parse(line); if (typeof value.passed === 'boolean' && value.output) { evidence = value; break; } } catch { /* Ordinary diagnostic output. */ }
  }
  const passed = result.code === 0 && evidence?.passed === true && evidence.checks?.length === run.count;
  results.push({ name: run.name, passed, exitCode: result.code, expectedGroups: run.count, groups: evidence?.checks?.length ?? 0, evidence: evidence?.output ?? null });
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: results.every(row => row.passed) && results.length === runs.length, completed: results.length, expected: runs.length, applicableCards: cards, excluded: ['SA05: historical WPS candidate'], results }, null, 2));
  console.log(`${passed ? 'PASS' : 'FAIL'} ${run.name} ${evidence?.checks?.length ?? 0}/${run.count} ${evidence?.output ?? ''}`);
}
const passed = results.every(row => row.passed);
console.log(JSON.stringify({ passed, output, runs: results.length, groups: results.reduce((sum, row) => sum + row.groups, 0), formalTaskAdmission: false, nativeOrWholeSiteCertification: false }));
if (!passed) process.exitCode = 1;

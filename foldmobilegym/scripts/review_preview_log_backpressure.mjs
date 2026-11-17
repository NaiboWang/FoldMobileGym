// Local preview transport diagnostic, not a benchmark/task success condition.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../..');
const build = path.resolve(root, process.env.FOLDAGENT_REVIEW_BUILD || 'artifacts/map-search-workspace-build-20261024-02');
assert.ok(fs.existsSync(path.join(build, 'index.html')), 'An existing compiled build is required; no new build is generated');
const output = fs.mkdtempSync(path.join(root, 'artifacts/preview-log-backpressure-'));
const checks = [];
async function run(accessLogging) {
  const env = { ...process.env };
  if (accessLogging) env.MOBILEGYM_ACCESS_LOG = '1';
  else delete env.MOBILEGYM_ACCESS_LOG;
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3194', '--strictPort', '--outDir', build], {
    cwd: path.join(root, 'mobilegym'), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env,
  });
  let stderr = '', drainedBytes = 0;
  child.stderr.on('data', bytes => { stderr += bytes; });
  child.stdout.pause();
  const request = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3194/cdn/spotify/images/playlists/aedecdb6895dd59b.jpg', { signal: AbortSignal.timeout(1500) });
      const bytes = await response.arrayBuffer();
      return { ok: response.status === 200 && bytes.byteLength > 0, status: response.status, bytes: bytes.byteLength };
    } catch (error) { return { ok: false, error: String(error) }; }
  };
  try {
    let ready = false;
    for (let i = 0; i < 25; i++) {
      if (child.exitCode !== null) throw Error('Isolated preview exited: ' + stderr);
      await new Promise(resolve => setTimeout(resolve, 100));
      if ((await request()).ok) { ready = true; break; }
    }
    assert.ok(ready, 'Isolated preview must become ready');
    let failedAt = null;
    for (let count = 0; count < 2000; count += 10) {
      const batch = await Promise.all(Array.from({ length: 10 }, request));
      if (batch.some(result => !result.ok)) { failedAt = count + 10; break; }
    }
    child.stdout.on('data', bytes => { drainedBytes += bytes.length; });
    child.stdout.resume();
    await new Promise(resolve => setTimeout(resolve, 100));
    const recovered = await request();
    assert.ok(recovered.ok, 'Identical original image bytes must be available after draining');
    if (accessLogging) assert.ok(failedAt > 100, 'Positive control must reproduce output backpressure, not a startup failure');
    else assert.equal(failedAt, null, 'Default preview must serve all 2000 images with stdout deliberately unread');
    checks.push({ accessLogging, failedAt, recovered, drainedBytes });
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await exited;
    }
  }
}
await run(true);
await run(false);
const result = { passed: true, checks, build, output, scope: 'Isolated local port3194; does not restart main/candidate or alter task data' };
fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));

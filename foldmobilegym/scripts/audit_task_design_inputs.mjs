/** Read-only task-design evidence. Output contains metadata, not app content. */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const workspace = process.argv[2];
if (!workspace) throw Error('Pass the FoldAgent workspace path');
const contracts = JSON.parse(fs.readFileSync(path.join(workspace, 'foldmobilegym/tasks/workflow_contracts.v2.json'), 'utf8'));
const hidden = new Set(['workspace_docs']);
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-launcher="true"]', { timeout: 30000 });
  const runtime = await page.evaluate(async () => {
    const { default: packages } = await import('/os/PackageManagerService.ts');
    const { dirToAppId } = await import('/os/data/appRegistry.tsx');
    const state = window.__SIM__.getState();
    return {
      apps: packages.getInstalledPackages().map(app => ({
        id: app.id, name: app.displayName, name_en: app.displayNameEn,
        type: app.type, version: app.version,
        directory: [...dirToAppId.entries()].find(([, id]) => id === app.id)?.[0],
        snapshot_keys: Object.keys(state.apps?.[app.id] || {}),
      })),
      snapshot_app_ids: Object.keys(state.apps || {}),
      controller_present: Boolean(window.__FOLDAGENT_BENCH__),
    };
  });
  const runtimeRoot = process.cwd();
  const installed = new Set(runtime.apps.map(app => app.id));
  const resolve = (app, file) => path.join(runtimeRoot, app.type === 'system' ? 'system' : 'apps', app.directory, file);
  const apps = runtime.apps.map(app => ({
    ...app, visible: !hidden.has(app.id),
    files: Object.fromEntries(['manifest.ts', 'navigation.declaration.ts', 'state.ts', 'data/defaults.json', 'types.ts']
      .map(file => [file, fs.existsSync(resolve(app, file))])),
    bench_helper_present: fs.existsSync(path.join(runtimeRoot, 'bench_env/task', app.id, 'app.py')),
  }));
  const old = contracts.workflows.map(workflow => ({
    pair_id: workflow.pair_id, title: workflow.title, apps: workflow.apps,
    unavailable_apps: workflow.apps.filter(id => !installed.has(id) || hidden.has(id)),
    dependency_status: workflow.apps.every(id => installed.has(id) && !hidden.has(id)) ? 'available_not_episode_validated' : 'needs_replacement',
  }));
  const report = {
    schema_version: 'foldagentbench.design-evidence.v1', date: '2026-10-10',
    evidence_scope: 'Local deployment registry, source-file presence, and snapshot key names only. No task episode was validated.',
    counts: { registered: apps.length, visible: apps.filter(app => app.visible).length,
      old_workflows: old.length, old_dependency_available: old.filter(w => !w.unavailable_apps.length).length,
      old_needs_replacement: old.filter(w => w.unavailable_apps.length).length },
    controller_present: runtime.controller_present, apps, old_workflows: old,
  };
  const out = path.join(workspace, 'foldmobilegym/design/current_apps_20261010');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'audit_evidence.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ counts: report.counts, apps: apps.map(app => ({ id: app.id, name: app.name, keys: app.snapshot_keys,
    state: app.files['state.ts'], helper: app.bench_helper_present })), old }, null, 2));
} finally {
  await browser.close();
}

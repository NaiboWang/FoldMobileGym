import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const yaml = require('js-yaml');
const source = fs.readFileSync(path.join(root, '.github/workflows/reconstruction.yml'), 'utf8');
const workflow = yaml.load(source);
const job = workflow.jobs.reconstruct;

test('complete rebuild is explicit opt-in with read-only permissions and pinned actions', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.runner.options, ['windows-latest', 'ubuntu-latest']);
  assert.equal(job['timeout-minutes'], 60);
  const actions = job.steps.filter(step => step.uses);
  assert.equal(actions.length, 3);
  for (const step of actions) assert.match(step.uses, /^actions\/(checkout|setup-node|setup-python)@[a-f0-9]{40}$/);
  assert.equal(actions.find(step => step.uses.startsWith('actions/checkout@')).with['persist-credentials'], false);
  assert.equal(actions.find(step => step.uses.startsWith('actions/setup-node@')).with['node-version'], '24.14.0');
  assert.equal(actions.find(step => step.uses.startsWith('actions/setup-python@')).with['python-version'], '3.11.9');
  assert.equal(job.env.PUPPETEER_SKIP_DOWNLOAD, 'true');
  assert.ok(!/secrets\.|upload-artifact|gh workflow run|deploy/i.test(source));
});

test('workflow includes actual full media, build and both offline test suites', () => {
  const runs = job.steps.map(step => step.run || '').join('\n');
  for (const command of ['tools/release/check_source.mjs', 'tools/release/test_check_source.mjs',
    'tools/reviews/test_runtime_assertions.mjs',
    'tools/data/prepare_data.py', 'requirements-mobilegym-baseline.txt',
    "unittest discover -s tools/data -p 'test_*.py'",
    "unittest discover -s tools/release -p 'test_*.py'",
    "unittest discover -s tools/media -p 'test_*.py'",
    'pip install -e ./foldagentgym', 'pip check', 'npm ci', 'npm run build',
    'tsc --noEmit', 'npm test', 'redbookStaticMedia.test.mjs', 'foldmobilegym/tests',
    'bench_env.run --list', "bench_env/tests -m 'not live' -n 0 -q"]) {
    assert.ok(runs.includes(command), `Missing reconstruction gate: ${command}`);
  }
  assert.ok(!runs.includes('playwright install'), 'Offline suite does not need browser downloads');
  assert.equal(job.defaults.run.shell, 'pwsh');
  for (const step of job.steps) {
    if (step.run && step.run.split('\n').filter(line => /^(?:\s*&|\s*python|\s*node)/.test(line)).length > 1) {
      assert.ok(step.run.includes('exit $LASTEXITCODE'), 'Multiple native commands must propagate failures');
    }
  }
});

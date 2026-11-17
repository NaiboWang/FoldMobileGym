// Read-only source contract. Do not create artifacts/ and conceal a fresh-checkout prerequisite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
const directory = import.meta.dirname;
function parentReadyBeforeAllocation(source) {
  const at = source.indexOf('fs.mkdtempSync(');
  if (at < 0) return null;
  return /fs\.mkdirSync\([^;]*artifacts[^;]*recursive\s*:\s*true[^;]*\)/.test(source.slice(0, at));
}
let checked = 0;
for (const file of fs.readdirSync(directory).filter(file => /^review_.*\.mjs$/.test(file))) {
  const source = fs.readFileSync(path.join(directory, file), 'utf8');
  if (parentReadyBeforeAllocation(source) === null) continue;
  checked++;
  test(`${file}: owns its artifact-parent bootstrap before allocating output`, () => {
    assert.equal(parentReadyBeforeAllocation(source), true, 'A clean receiver must not depend on a prior diagnostic having made artifacts/');
  });
}
test('the review scan is not vacuous', () => { assert.ok(checked >= 30); });
test('creating a child output only after mkdtemp does not satisfy the parent prerequisite', () => {
  assert.equal(parentReadyBeforeAllocation("const output=fs.mkdtempSync(path.join(root,'artifacts/review-'));fs.mkdirSync(output,{recursive:true});"), false);
});
test('an unrelated directory is not mistaken for the artifact parent', () => {
  assert.equal(parentReadyBeforeAllocation("fs.mkdirSync(path.join(root,'other'),{recursive:true});const output=fs.mkdtempSync(path.join(root,'artifacts/review-'));"), false);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function assertEntryHealth(layout, posture, appId) {
  assert.equal(layout.overflow, false, `${posture}/${appId}: outer horizontal overflow`);
  assert.deepEqual(layout.failedImages, [], `${posture}/${appId}: visible image load failures`);
}

export function assertMediaBytes(bytes, item) {
  assert.equal(bytes.byteLength, item.bytes, item.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
}

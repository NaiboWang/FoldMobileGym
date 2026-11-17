import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { collectTransportEvidence, attachTransportEvidence, redactTransportUrl } from './transport_evidence.mjs';
const origin = 'http://127.0.0.1:3188';
const request = (id, url = origin + '/cdn/image.png') => ({ requestId: id, timestamp: 100, type: 'Image', request: { url, method: 'GET', headers: { Authorization: 'never-record' }, postData: 'never-record' } });
const response = id => ({ requestId: id, timestamp: 101, response: { status: 200, protocol: 'http/1.1', connectionId: 42, connectionReused: true, fromDiskCache: false, fromServiceWorker: false, timing: { requestTime: 100, sendStart: 1, receiveHeadersStart: 5 }, headers: { 'Content-Type': 'image/png', 'content-length': '123', 'Set-Cookie': 'never-record', Authorization: 'never-record' } } });

test('same-origin request, headers, body and completion remain correlated without secrets', () => {
  const session = new EventEmitter(); let now = 0;
  const trace = collectTransportEvidence(session, { origin, clock: () => ++now });
  session.emit('Network.requestWillBeSent', request('one'));
  session.emit('Network.responseReceived', response('one'));
  session.emit('Network.dataReceived', { requestId: 'one', timestamp: 102, dataLength: 123, encodedDataLength: 123 });
  session.emit('Network.loadingFinished', { requestId: 'one', timestamp: 103, encodedDataLength: 456 });
  const snapshot = trace.snapshot();
  assert.deepEqual(snapshot.events.map(x => x.kind), ['request', 'response', 'data', 'finished']);
  assert.equal(snapshot.events[1].connectionId, 42); assert.equal(snapshot.events[1].timing.receiveHeadersStart, 5);
  assert.equal(snapshot.events[2].dataLength, 123); assert.equal(snapshot.events[3].encodedDataLength, 456);
  assert.deepEqual(snapshot.pending, []); assert.ok(!JSON.stringify(snapshot).includes('never-record'));
  assert.deepEqual(snapshot.events[1].headers, { 'Content-Type': 'image/png', 'content-length': '123' });
});

test('pending requests distinguish unreturned headers from returned headers and absent body completion', () => {
  const session = new EventEmitter(), trace = collectTransportEvidence(session, { origin });
  session.emit('Network.requestWillBeSent', request('queued'));
  session.emit('Network.requestWillBeSent', request('headers'));
  session.emit('Network.responseReceived', response('headers'));
  const rows = trace.snapshot();
  assert.deepEqual(rows.pending.map(x => x.requestId), ['queued', 'headers']);
  assert.deepEqual(rows.events.filter(x => x.kind === 'response').map(x => x.requestId), ['headers']);
});

test('foreign and malformed requests are ignored, including their untracked body events', () => {
  const session = new EventEmitter(), trace = collectTransportEvidence(session, { origin });
  session.emit('Network.requestWillBeSent', request('foreign', 'https://example.invalid/image.png'));
  session.emit('Network.requestWillBeSent', request('invalid', 'not a URL'));
  session.emit('Network.requestWillBeSent', request('blob', 'blob:' + origin + '/worker'));
  session.emit('Network.requestWillBeSent', request('data', 'data:image/png;base64,YQ=='));
  session.emit('Network.responseReceived', response('foreign'));
  session.emit('Network.dataReceived', { requestId: 'invalid' });
  session.emit('Network.loadingFinished', { requestId: 'foreign' });
  assert.deepEqual(trace.snapshot().events, []); assert.deepEqual(trace.snapshot().pending, []);
});

test('cancellation preserves failure identity and removes only that pending request', () => {
  const session = new EventEmitter(), trace = collectTransportEvidence(session, { origin });
  session.emit('Network.requestWillBeSent', request('one')); session.emit('Network.requestWillBeSent', request('two'));
  session.emit('Network.loadingFailed', { requestId: 'one', timestamp: 102, errorText: 'net::ERR_ABORTED', canceled: true });
  const row = trace.snapshot(); assert.deepEqual(row.pending.map(x => x.requestId), ['two']);
  assert.equal(row.events.at(-1).errorText, 'net::ERR_ABORTED'); assert.equal(row.events.at(-1).canceled, true);
});

test('bounded storage reports truncation while still tracking the actual terminal state', () => {
  const session = new EventEmitter(), trace = collectTransportEvidence(session, { origin, maxEvents: 1 });
  session.emit('Network.requestWillBeSent', request('one')); session.emit('Network.responseReceived', response('one'));
  session.emit('Network.loadingFinished', { requestId: 'one', timestamp: 103, encodedDataLength: 456 });
  assert.equal(trace.snapshot().events.length, 1); assert.equal(trace.snapshot().droppedEvents, 2);
  assert.deepEqual(trace.snapshot().pending, []);
  assert.throws(() => collectTransportEvidence(session, { origin, maxEvents: 0 }), /Positive/);
});

test('snapshot cannot mutate retained evidence, and stopping is idempotent without removing unrelated listeners', () => {
  const session = new EventEmitter(), unrelated = () => {};
  session.on('Network.requestWillBeSent', unrelated);
  const trace = collectTransportEvidence(session, { origin }); session.emit('Network.requestWillBeSent', request('one'));
  const row = trace.snapshot(); row.pending[0].url = 'tampered'; row.events[0].kind = 'tampered';
  assert.equal(trace.snapshot().events[0].kind, 'request'); assert.notEqual(trace.snapshot().pending[0].url, 'tampered');
  trace.stop(); trace.stop(); assert.deepEqual(session.listeners('Network.requestWillBeSent'), [unrelated]);
  assert.equal(session.listenerCount('Network.responseReceived'), 0);
  session.emit('Network.requestWillBeSent', request('two')); assert.equal(trace.snapshot().events.length, 1);
  assert.equal(trace.snapshot().stopped, true);
});

test('URLs redact credentials, fragments, auth query and nested gateway URL credentials', () => {
  const nested = 'https://user:password@example.invalid/image?token=private-value&width=100#secret';
  const url = origin + '/api/gw/proxy?API_KEY=private-key&url=' + encodeURIComponent(nested);
  const value = redactTransportUrl(url);
  for (const secret of ['user', 'password', 'private-value', 'private-key', '#secret']) assert.ok(!decodeURIComponent(value).includes(secret));
  assert.ok(decodeURIComponent(value).includes('width=100')); assert.equal(redactTransportUrl('bad'), '[invalid-url]');
  let deep = origin + '/image?token=private-value';
  for (let i = 0; i < 8; i++) deep = origin + '/proxy?url=' + encodeURIComponent(deep);
  assert.ok(!redactTransportUrl(deep).includes('private-value'));
});

test('page attachment enables only passive Network observation and detaches after cleanup', async () => {
  const session = new EventEmitter(), commands = []; let detached = 0;
  session.send = async (...args) => commands.push(args); session.detach = async () => { detached++; };
  const trace = await attachTransportEvidence({ createCDPSession: async () => session }, { origin });
  assert.deepEqual(commands, [['Network.enable']]); await trace.stop();
  assert.equal(detached, 1); assert.equal(session.listenerCount('Network.requestWillBeSent'), 0);
});

test('failed Network enable cleans its listeners and session instead of leaking instrumentation', async () => {
  const session = new EventEmitter(); let detached = 0;
  session.send = async () => { throw new Error('enable failed'); }; session.detach = async () => { detached++; };
  await assert.rejects(attachTransportEvidence({ createCDPSession: async () => session }, { origin }), /enable failed/);
  assert.equal(detached, 1); assert.equal(session.listenerCount('Network.requestWillBeSent'), 0);
});


test('records native initial and changed priorities without changing network behavior', () => {
  const session = new EventEmitter(), trace = collectTransportEvidence(session, { origin });
  const event = request('image'); event.request.initialPriority = 'Low';
  session.emit('Network.requestWillBeSent', event);
  session.emit('Network.resourceChangedPriority', { requestId: 'image', newPriority: 'High', timestamp: 100.5 });
  const rows = trace.snapshot().events;
  assert.equal(rows[0].initialPriority, 'Low');
  assert.deepEqual(rows[1], { atMs: rows[1].atMs, kind: 'priority', requestId: 'image', priority: 'High', timestamp: 100.5 });
  session.emit('Network.loadingFinished', { requestId: 'image', timestamp: 101 });
  const count = trace.snapshot().events.length;
  session.emit('Network.resourceChangedPriority', { requestId: 'image', newPriority: 'Low', timestamp: 102 });
  assert.equal(trace.snapshot().events.length, count);
});

test('does not collect priorities for foreign, unknown or stopped requests', () => {
  const session = new EventEmitter(), trace = collectTransportEvidence(session, { origin });
  session.emit('Network.requestWillBeSent', request('foreign', 'https://example.invalid/image.png'));
  session.emit('Network.resourceChangedPriority', { requestId: 'foreign', newPriority: 'High' });
  session.emit('Network.resourceChangedPriority', { requestId: 'unknown', newPriority: 'High' });
  assert.deepEqual(trace.snapshot().events, []);
  trace.stop(); assert.equal(session.listenerCount('Network.resourceChangedPriority'), 0);
});

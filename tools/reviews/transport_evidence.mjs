// Optional passive CDP evidence. Never intercept, throttle, retry or change cache.
const sensitiveQuery = /(?:key|token|auth|password|secret|signature|credential|session|cookie|jwt|code)/i;
const allowedHeaders = new Set(['content-type', 'content-length', 'content-encoding', 'cache-control']);

export function redactTransportUrl(value, depth = 0) {
  if (depth > 4) return '[redacted-nested-url]';
  try {
    const url = new URL(value);
    url.username = ''; url.password = ''; url.hash = '';
    for (const name of new Set(url.searchParams.keys())) {
      if (sensitiveQuery.test(name)) url.searchParams.set(name, '[redacted]');
      else if (name.toLowerCase() === 'url') url.searchParams.set(name, redactTransportUrl(url.searchParams.get(name), depth + 1));
    }
    return url.href;
  } catch { return '[invalid-url]'; }
}

export function collectTransportEvidence(session, { origin, maxEvents = 20000, clock = () => performance.now() } = {}) {
  const expectedOrigin = new URL(origin).origin;
  if (!Number.isInteger(maxEvents) || maxEvents < 1) throw new Error('Positive bounded event limit required');
  const started = clock(), events = [], pending = new Map(), listeners = [];
  let droppedEvents = 0, stopped = false;
  const record = row => {
    if (events.length < maxEvents) events.push({ atMs: clock() - started, ...row });
    else droppedEvents++;
  };
  const listen = (name, handler) => { session.on(name, handler); listeners.push([name, handler]); };
  listen('Network.requestWillBeSent', event => {
    let url; try { url = new URL(event.request.url); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== expectedOrigin) return;
    const row = { requestId: event.requestId, url: redactTransportUrl(url.href), method: event.request.method,
      resourceType: event.type, timestamp: event.timestamp,
      ...(event.request.initialPriority ? { initialPriority: event.request.initialPriority } : {}) };
    pending.set(event.requestId, row);
    record({ kind: 'request', ...row, ...(event.redirectResponse ? { redirectStatus: event.redirectResponse.status } : {}) });
  });
  listen('Network.resourceChangedPriority', event => {
    if (pending.has(event.requestId)) record({ kind: 'priority', requestId: event.requestId,
      timestamp: event.timestamp, priority: event.newPriority });
  });
  listen('Network.responseReceived', event => {
    if (!pending.has(event.requestId)) return;
    const r = event.response;
    record({ kind: 'response', requestId: event.requestId, timestamp: event.timestamp, status: r.status,
      protocol: r.protocol, connectionId: r.connectionId, connectionReused: r.connectionReused,
      fromDiskCache: r.fromDiskCache, fromServiceWorker: r.fromServiceWorker,
      timing: r.timing ? { ...r.timing } : undefined,
      headers: Object.fromEntries(Object.entries(r.headers || {}).filter(([name]) => allowedHeaders.has(name.toLowerCase()))) });
  });
  listen('Network.dataReceived', event => {
    if (pending.has(event.requestId)) record({ kind: 'data', requestId: event.requestId, timestamp: event.timestamp,
      dataLength: event.dataLength, encodedDataLength: event.encodedDataLength });
  });
  for (const [name, kind] of [['Network.loadingFinished', 'finished'], ['Network.loadingFailed', 'failed']]) {
    listen(name, event => {
      if (!pending.has(event.requestId)) return;
      record({ kind, requestId: event.requestId, timestamp: event.timestamp,
        ...(kind === 'finished' ? { encodedDataLength: event.encodedDataLength } : { errorText: event.errorText, canceled: event.canceled }) });
      pending.delete(event.requestId);
    });
  }
  return {
    snapshot: () => structuredClone({ scope: 'Passive same-origin-initiated CDP transport; not browser image-decode or native-fidelity acceptance',
      origin: expectedOrigin, maxEvents, droppedEvents, stopped, events, pending: [...pending.values()] }),
    stop() {
      if (stopped) return;
      stopped = true;
      for (const [name, handler] of listeners) session.off(name, handler);
    },
  };
}

export async function attachTransportEvidence(page, options) {
  const session = await page.createCDPSession();
  const collector = collectTransportEvidence(session, options);
  try { await session.send('Network.enable'); }
  catch (error) { collector.stop(); await session.detach().catch(() => {}); throw error; }
  return { snapshot: collector.snapshot, async stop() { collector.stop(); await session.detach().catch(() => {}); } };
}

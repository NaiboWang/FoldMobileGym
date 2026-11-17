import { Writable } from 'node:stream';
import http from 'node:http';
import { once } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { relayGatewayBody } from '../scripts/lib/gateway_stream_relay.mjs';
class ResponseSink extends Writable {
  statusCode = 200; headersSent = false; headers = new Map<string, string>(); chunks: Buffer[] = [];
  setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); }
  getHeader(name: string) { return this.headers.get(name.toLowerCase()); }
  removeHeader(name: string) { this.headers.delete(name.toLowerCase()); }
  _write(chunk: Buffer, _encoding: string, callback: (error?: Error) => void) { this.headersSent = true; this.chunks.push(Buffer.from(chunk)); callback(); }
  _final(callback: () => void) { this.headersSent = true; callback(); }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const closes = (response: ResponseSink) => new Promise<void>(resolve => response.once('close', resolve));
const ownListeners = (emitter: any, events: string[]) => events.flatMap(event => emitter.listeners(event)).filter(fn => /^on(Source|Response)/.test(fn.name));
describe('Gateway response stream ownership and truthful termination', () => {
  it('preserves healthy binary chunks and headers with no abort or leaked relay listeners', async () => {
    const response = new ResponseSink(), abort = vi.fn(), log = vi.fn(), expected = Buffer.from([0, 255, 128, 0, 42, 7]);
    response.setHeader('content-length', String(expected.length)); response.setHeader('content-type', 'application/octet-stream'); const closed = closes(response);
    const source = relayGatewayBody(new ReadableStream({ start(c) { c.enqueue(expected.subarray(0, 2)); c.enqueue(expected.subarray(2)); c.close(); } }), response, { abortUpstream: abort, onUpstreamError: log });
    await closed; await tick(); expect(Buffer.concat(response.chunks)).toEqual(expected); expect(response.statusCode).toBe(200);
    expect(response.getHeader('content-length')).toBe(String(expected.length)); expect(response.getHeader('content-type')).toBe('application/octet-stream');
    expect(abort).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
    expect(ownListeners(response, ['finish', 'close', 'error'])).toEqual([]); expect(ownListeners(source, ['end', 'close', 'error'])).toEqual([]);
  });
  it('returns an uncached 502 before headers and clears stale entity/redirect headers', async () => {
    const response = new ResponseSink(), abort = vi.fn(), log = vi.fn();
    for (const name of ['content-length', 'content-range', 'content-encoding', 'content-disposition', 'location', 'etag', 'last-modified', 'expires', 'accept-ranges']) response.setHeader(name, 'stale');
    response.setHeader('access-control-allow-origin', '*'); const closed = closes(response);
    relayGatewayBody(new ReadableStream({ start(c) { c.error(new Error('private token must not enter body')); } }), response, { abortUpstream: abort, onUpstreamError: log });
    await closed; expect(response.statusCode).toBe(502); expect(response.getHeader('content-length')).toBeUndefined(); expect(response.getHeader('location')).toBeUndefined();
    expect(response.getHeader('access-control-allow-origin')).toBe('*'); expect(response.getHeader('cache-control')).toBe('no-store');
    expect(JSON.parse(Buffer.concat(response.chunks).toString())).toEqual({ error: 'Upstream response stream failed' });
    expect(abort).toHaveBeenCalledTimes(1); expect(log).toHaveBeenCalledTimes(1);
  });
  it('aborts a partial response instead of sending an apparently successful truncated EOF', async () => {
    const response = new ResponseSink(), abort = vi.fn(); let controller: ReadableStreamDefaultController<Uint8Array>;
    response.setHeader('content-length', '1000'); const closed = closes(response);
    relayGatewayBody(new ReadableStream<Uint8Array>({ start(c) { controller = c; c.enqueue(Uint8Array.of(1, 2, 3)); } }), response, { abortUpstream: abort });
    await tick(); expect(response.headersSent).toBe(true); controller!.error(new Error('upstream lost')); await closed;
    expect(response.destroyed).toBe(true); expect(response.writableFinished).toBe(false); expect(response.statusCode).toBe(200);
    expect(Buffer.concat(response.chunks)).toEqual(Buffer.from([1, 2, 3])); expect(abort).toHaveBeenCalledTimes(1);
  });
  it('treats premature source close without end as failure', async () => {
    const response = new ResponseSink(), abort = vi.fn(), closed = closes(response);
    const source = relayGatewayBody(new ReadableStream({ start() {} }), response, { abortUpstream: abort }); source.destroy();
    await closed; expect(response.statusCode).toBe(502); expect(abort).toHaveBeenCalledTimes(1);
  });
  it('cancels the reader and upstream when the downstream disconnects', async () => {
    const response = new ResponseSink(), abort = vi.fn(), cancel = vi.fn(), closed = closes(response);
    relayGatewayBody(new ReadableStream({ start(c) { c.enqueue(Uint8Array.of(5)); }, cancel }), response, { abortUpstream: abort });
    await tick(); response.destroy(); await closed; await tick(); expect(cancel).toHaveBeenCalledTimes(1); expect(abort).toHaveBeenCalledTimes(1);
  });
  it('cancels an early downstream finish while leaving existing caller listeners intact', async () => {
    const response = new ResponseSink(), caller = vi.fn(), abort = vi.fn(), cancel = vi.fn(); response.on('close', caller); const closed = closes(response);
    relayGatewayBody(new ReadableStream({ start() {}, cancel }), response, { abortUpstream: abort }); response.end();
    await closed; await tick(); expect(caller).toHaveBeenCalledTimes(1); expect(response.listeners('close')).toContain(caller);
    expect(abort).toHaveBeenCalledTimes(1); expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('cancels on a downstream write error without treating it as an upstream retry', async () => {
    const response = new ResponseSink(), abort = vi.fn(), cancel = vi.fn(), log = vi.fn(), closed = closes(response);
    relayGatewayBody(new ReadableStream({ start() {}, cancel }), response, { abortUpstream: abort, onUpstreamError: log });
    response.emit('error', new Error('downstream write failed')); await closed; await tick();
    expect(abort).toHaveBeenCalledTimes(1); expect(cancel).toHaveBeenCalledTimes(1); expect(log).not.toHaveBeenCalled();
  });
  it('handles conversion failure as 502, not the upstream successful status', async () => {
    const response = new ResponseSink(), abort = vi.fn(), closed = closes(response); response.setHeader('content-length', '500');
    relayGatewayBody({ notAReadableStream: true }, response, { abortUpstream: abort }); await closed;
    expect(response.statusCode).toBe(502); expect(response.getHeader('content-length')).toBeUndefined(); expect(abort).toHaveBeenCalledTimes(1);
  });
  it('does not write to an already closed downstream and still cancels a valid body', async () => {
    const response = new ResponseSink(), abort = vi.fn(), cancel = vi.fn(), closed = closes(response); response.destroy(); await closed;
    const source = relayGatewayBody(new ReadableStream({ start() {}, cancel }), response, { abortUpstream: abort }); await tick();
    expect(response.chunks).toEqual([]); expect(source.destroyed).toBe(true); expect(abort).toHaveBeenCalledTimes(1); expect(cancel).toHaveBeenCalledTimes(1);
    expect(ownListeners(response, ['finish', 'close', 'error'])).toEqual([]);
  });
  it('detaches from a preclosed downstream even when conversion also fails', async () => {
    const response = new ResponseSink(), abort = vi.fn(), closed = closes(response); response.destroy(); await closed;
    relayGatewayBody({}, response, { abortUpstream: abort }); expect(abort).toHaveBeenCalledTimes(1);
    expect(response.chunks).toEqual([]); expect(ownListeners(response, ['finish', 'close', 'error'])).toEqual([]);
  });
  it('emits a complete 502 with correct new headers over an actual HTTP socket before body bytes', async () => {
    const server = http.createServer((_request, response) => {
      response.setHeader('Content-Length', '16384'); response.setHeader('Content-Range', 'bytes 0-16383/16384');
      relayGatewayBody(new ReadableStream({ start(c) { c.error(new Error('upstream body failed')); } }), response);
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const address = server.address(); if (!address || typeof address === 'string') throw Error('No loopback address');
      const response = await fetch('http://127.0.0.1:' + address.port + '/');
      expect(response.status).toBe(502); expect(response.headers.get('content-range')).toBeNull();
      expect(response.headers.get('content-length')).not.toBe('16384'); expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ error: 'Upstream response stream failed' });
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('does not let logging or abort-hook exceptions retain a failed body', async () => {
    const response = new ResponseSink(), closed = closes(response);
    relayGatewayBody(new ReadableStream({ start(c) { c.error(new Error('broken')); } }), response,
      { abortUpstream: () => { throw Error('abort hook'); }, onUpstreamError: () => { throw Error('log hook'); } });
    await closed; expect(response.statusCode).toBe(502); expect(response.writableFinished).toBe(true);
  });
});

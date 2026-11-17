import { Readable } from 'node:stream';

const ENTITY_HEADERS = ['content-length', 'content-range', 'content-encoding', 'content-disposition', 'location', 'etag', 'last-modified', 'expires', 'accept-ranges'];

/** Relay unchanged response bytes; an upstream error is never a successful EOF. */
export function relayGatewayBody(body, response, { abortUpstream, onUpstreamError } = {}) {
  const unavailableAtEntry = response.destroyed || response.writableEnded;
  let source, sourceEnded = false, terminal = false;
  const abort = () => { try { abortUpstream?.(); } catch { /* Transport teardown must still finish. */ } };
  const report = error => { try { onUpstreamError?.(error); } catch { /* Logging is not transport ownership. */ } };
  const detachResponse = () => {
    response.off('finish', onResponseFinish); response.off('close', onResponseClose); response.off('error', onResponseError);
  };
  const detachSource = () => {
    source?.off('end', onSourceEnd); source?.off('close', onSourceClose); source?.off('error', onSourceError);
  };
  const cancel = () => {
    if (terminal) return;
    terminal = true; abort(); source?.unpipe(response); source?.destroy();
  };
  const fail = error => {
    if (terminal) return;
    terminal = true; source?.unpipe(response); report(error); abort();
    if (!response.destroyed && !response.writableEnded) {
      if (response.headersSent) response.destroy(error);
      else {
        for (const name of ENTITY_HEADERS) response.removeHeader(name);
        response.statusCode = 502;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ error: 'Upstream response stream failed' }));
      }
    }
    source?.destroy();
  };
  function onSourceError(error) { fail(error); }
  function onSourceEnd() { sourceEnded = true; }
  function onSourceClose() {
    if (!sourceEnded && !terminal) fail(Object.assign(new Error('Upstream response closed before completion'), { code: 'ERR_STREAM_PREMATURE_CLOSE' }));
    detachSource();
  }
  function onResponseFinish() {
    if (!sourceEnded) cancel();
    terminal = true; detachResponse();
  }
  function onResponseClose() {
    if (!response.writableFinished) cancel();
    terminal = true; detachResponse();
  }
  function onResponseError() {
    cancel(); if (!response.destroyed) response.destroy();
  }
  response.once('finish', onResponseFinish); response.once('close', onResponseClose); response.on('error', onResponseError);
  try { source = Readable.fromWeb(body); }
  catch (error) {
    if (unavailableAtEntry) { terminal = true; abort(); detachResponse(); }
    else fail(error);
    return;
  }
  source.once('end', onSourceEnd); source.once('close', onSourceClose); source.on('error', onSourceError);
  if (response.destroyed || response.writableEnded) { cancel(); detachResponse(); return source; }
  source.pipe(response);
  return source;
}

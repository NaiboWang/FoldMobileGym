import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import puppeteer from 'puppeteer';

if (!process.argv[2]) throw Error('Pass the overlay directory containing packaged media');
const staticMode = process.argv[3] === '--static-dist';
const dist = staticMode ? path.resolve(process.argv[2]) : null;
const media = staticMode ? path.join(dist, 'cdn') : path.resolve(process.argv[2], 'mobilegym-data');
const manifest = JSON.parse(fs.readFileSync(path.join(media, 'redbook/post-media.manifest.json'), 'utf8'));
const notesBytes = fs.readFileSync(new URL('../apps/RedBook/data/notes.json', import.meta.url));
assert.equal(crypto.createHash('sha256').update(notesBytes).digest('hex'), manifest.notes_sha256);
const notes = JSON.parse(notesBytes.toString('utf8'));
const permitted = new Set(manifest.files.map(file => `/cdn/${file.path}`));
let served = 0;
let server;
let origin = 'http://127.0.0.1:3100';
if (staticMode) {
  // Serve only the isolated build: no Vite middleware, companion mirror or proxy.
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const filename = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
      const relative = path.relative(dist, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Outside build');
      const bytes = fs.readFileSync(filename);
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
        'Cache-Control': 'no-store' });
      if (permitted.has(pathname)) served++;
      response.end(bytes);
    } catch { response.writeHead(404); response.end('Not in static build'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(media, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
}
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (staticMode) {
      const url = new URL(request.url());
      // A fresh browser cannot silently obtain missing media from external CDNs.
      if (url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === origin) return void request.continue();
      return void request.abort();
    }
    const pathname = new URL(request.url()).pathname;
    if (!pathname.startsWith('/cdn/redbook/images/posts/')) return void request.continue();
    if (!permitted.has(pathname)) return void request.respond({ status: 404, body: 'Not in uploaded image manifest' });
    // All post-image responses come from the upload package, never the runtime mirror.
    const bytes = fs.readFileSync(path.join(media, pathname.slice('/cdn/'.length)));
    served++;
    void request.respond({ status: 200, contentType: 'image/jpeg', headers: { 'Cache-Control': 'no-store' }, body: bytes });
  });
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__));
  page.on('console', message => { if (message.text().startsWith('packaged media decoded:')) console.log(message.text()); });
  const decoded = await page.evaluate(async files => {
    let index = 0, complete = 0;
    const failures = [];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (index < files.length) {
        const file = files[index++];
        try {
          const response = await fetch(`/cdn/${file.path}`, { cache: 'no-store' });
          if (!response.ok) throw Error(`HTTP ${response.status}`);
          const bitmap = await createImageBitmap(await response.blob());
          if (bitmap.width <= 0 || bitmap.height <= 0) throw Error('Empty image');
          bitmap.close();
        } catch (error) { failures.push({ path: file.path, error: String(error) }); }
        complete++;
        if (complete % 500 === 0) console.log(`packaged media decoded: ${complete}/${files.length}`);
      }
    }));
    return { complete, failures };
  }, manifest.files);
  assert.equal(decoded.complete, manifest.images);
  assert.deepEqual(decoded.failures, []);
  console.log(JSON.stringify({ allPackagedImagesDecoded: decoded.complete }));
  if (staticMode) {
    await page.evaluate(() => window.__OS__.openApp('redbook', '/'));
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('[data-app-id="redbook"] img')]
        .filter(image => image.currentSrc.includes('/images/posts/'));
      return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
    }, { timeout: 20000 });
  }
  const indices = [...new Set(Array.from({ length: 12 }, (_, index) => Math.floor(index * (notes.length - 1) / 11)))];
  let details = 0;
  for (const index of indices) {
    const note = notes[index];
    await page.evaluate(id => window.__OS__.openApp('redbook', `/note/${id}`), note.id);
    await page.waitForFunction(id => {
      const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
      return image?.currentSrc.includes(`/images/posts/${id}/0.jpg`) && image.complete && image.naturalWidth > 0;
    }, { timeout: 20000 }, note.id);
    if (note.images.length > 1) {
      console.log(JSON.stringify({ checkingSecondImage: note.id, expected: note.images[1] }));
      await page.click('[data-app-id="redbook"] [data-image-swiper] > div.right-0.cursor-pointer');
      await page.waitForFunction(source => {
        const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
        return image?.currentSrc.endsWith(source.replace(/^\./, '/cdn/redbook')) && image.complete && image.naturalWidth > 0;
      }, { timeout: 10000 }, note.images[1]).catch(async error => {
        console.log(JSON.stringify(await page.$eval('[data-app-id="redbook"] [data-image-swiper]', swiper => ({
          displayed: swiper.querySelector('img')?.currentSrc, text: swiper.textContent,
        }))));
        throw error;
      });
    }
    for (const posture of ['folded', 'unfolded', 'half_folded']) {
      await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture);
      await page.waitForFunction(() => document.getElementById('root').getAnimations().length === 0);
      const displayed = await page.$eval('[data-app-id="redbook"] [data-image-swiper] img', image => {
        const rect = image.getBoundingClientRect();
        return image.complete && image.naturalWidth > 0 && rect.width > 20 && rect.height > 20;
      });
      assert.equal(displayed, true); details++;
    }
  }
  assert.deepEqual(errors, []);
  assert.ok(served >= manifest.images);
  console.log(JSON.stringify({ passed: true, decodedImages: decoded.complete, detailPostureCases: details,
    packagedResponses: served, pageErrors: errors, originalPostMirrorBypassed: true,
    staticBuildOnly: staticMode, externalRequestsBlocked: staticMode,
    scope: 'Complete packaged JPEG decode + 12 sampled post details in three postures; not all-post navigation or task qualification' }));
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}

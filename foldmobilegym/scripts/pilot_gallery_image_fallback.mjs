import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Isolated virtual-file diagnostic. No user files or real disk media are edited.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__));
  const thumbnail = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#4078ad"/></svg>');
  const cases = [
    { kind: 'recoverable', photoPath: '/sdcard/DCIM/Camera/foldagent-image-diagnostic.jpg', thumbnail, healthy: false },
    { kind: 'both-broken', photoPath: '/sdcard/DCIM/Camera/foldagent-image-broken.jpg', thumbnail: 'data:image/png;base64,broken', healthy: false },
    { kind: 'healthy-primary', photoPath: '/sdcard/DCIM/Camera/foldagent-image-healthy.svg', thumbnail, healthy: true },
    { kind: 'healthy-portrait', photoPath: '/sdcard/DCIM/Camera/foldagent-image-portrait.svg', thumbnail, healthy: true, portrait: true },
  ];
  await page.evaluate(async cases => {
    const files = await import('/os/FileSystemService.ts');
    for (const item of cases) {
      const mimeType = item.healthy ? 'image/svg+xml' : 'image/jpeg';
      const width = item.portrait ? 1600 : 2400;
      const height = item.portrait ? 2400 : 1600;
      const contents = item.healthy ? `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#22a466"/></svg>` : 'not-a-jpeg';
      await files.writeFile(item.photoPath, new Blob([contents], { type: mimeType }), { mimeType });
      await files.setMetadata(item.photoPath, { thumbnailUri: item.thumbnail, width, height });
    }
    window.__OS__.openApp('gallery');
  }, cases);
  const results = [];
  for (const posture of ['unfolded', 'folded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    for (const item of cases) {
      const tile = `.gallery-photo-tile[data-gallery-source-id=${JSON.stringify(item.photoPath)}]`;
      await page.waitForSelector(tile, { visible: true });
      await page.waitForFunction(({ tile, terminal }) => {
        const node = document.querySelector(tile);
        const image = node?.querySelector('img');
        return node && !node.querySelector('.animate-spin')
          && (terminal ? !image : image?.complete && image.naturalWidth > 0);
      }, { timeout: 5000 }, { tile, terminal: item.kind === 'both-broken' });
      const result = await page.$eval(tile, (node, thumbnail) => {
        const image = node.querySelector('img');
        return { imagePresent: Boolean(image), decoded: Boolean(image?.complete && image.naturalWidth > 0),
          usedExistingThumbnail: image?.getAttribute('src') === thumbnail,
          primaryBlob: Boolean(image?.getAttribute('src')?.startsWith('blob:')) };
      }, item.thumbnail);
      assert.equal(result.imagePresent, item.kind !== 'both-broken');
      assert.equal(result.decoded, item.kind !== 'both-broken');
      assert.equal(result.usedExistingThumbnail, item.kind === 'recoverable');
      if (item.healthy) assert.equal(result.primaryBlob, true, 'Healthy full image must not be replaced by its thumbnail');
      results.push({ kind: item.kind, posture, ...result });
      console.log(JSON.stringify(results.at(-1)));
      await page.click(tile);
      await page.waitForSelector('.gallery-viewer-root', { visible: true });
      await page.waitForFunction(path => document.querySelector('.gallery-viewer-root')
        ?.getAttribute('data-benchmark-source-id') === path, {}, item.photoPath);
      // Wait for committed layout geometry, not just a visible node during posture animation.
      await page.evaluate(() => new Promise((resolve, reject) => {
        let previous = '', stable = 0, frames = 0;
        const sample = () => {
          const node = document.querySelector('.gallery-viewer-stage');
          const rect = node?.getBoundingClientRect();
          const current = rect ? [rect.x, rect.y, rect.width, rect.height].join(',') : '';
          stable = current && current === previous ? stable + 1 : 0;
          previous = current;
          if (stable >= 12) resolve();
          else if (++frames > 300) reject(new Error('Gallery detail geometry did not settle'));
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }));
      await page.waitForFunction(healthy => {
        const stage = document.querySelector('.gallery-viewer-stage');
        const image = stage?.querySelector('img');
        return stage && !stage.querySelector('.animate-spin')
          && (healthy ? image?.complete && image.naturalWidth > 0 : !image);
      }, { timeout: 5000 }, item.healthy);
      const viewer = await page.$eval('.gallery-viewer-stage', stage => {
        const image = stage.querySelector('img');
        const bounds = stage.getBoundingClientRect();
        const rect = image?.getBoundingClientRect();
        return { decoded: Boolean(image?.complete && image.naturalWidth > 0),
          primaryBlob: Boolean(image?.getAttribute('src')?.startsWith('blob:')),
          naturalWidth: image?.naturalWidth ?? 0, naturalHeight: image?.naturalHeight ?? 0,
          fitsStage: !rect || (rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
            && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1),
          imageWidth: rect?.width ?? 0, stageWidth: bounds.width,
          imageHeight: rect?.height ?? 0, stageHeight: bounds.height };
      });
      console.log(JSON.stringify({ kind: item.kind, posture, view: 'detail', ...viewer }));
      assert.equal(viewer.decoded, item.healthy, 'Detail must not pretend a thumbnail is a decoded full image');
      assert.equal(viewer.fitsStage, true, 'Unzoomed full image must fit the viewer stage');
      if (item.healthy) {
        assert.equal(viewer.primaryBlob, true);
        assert.equal(viewer.naturalWidth, item.portrait ? 1600 : 2400);
        assert.equal(viewer.naturalHeight, item.portrait ? 2400 : 1600);
        assert.ok(Math.abs(viewer.imageWidth / viewer.imageHeight
          - viewer.naturalWidth / viewer.naturalHeight) < 0.01, 'Full image aspect ratio must be retained');
      }
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForSelector(tile, { visible: true });
    }
  }
  assert.deepEqual(errors, []);
  assert.equal(results.length, 12);
  console.log(JSON.stringify({ scope: 'Controlled Gallery grid/detail image recovery and unzoomed fit, NOT image/task/model qualification',
    gridScenarios: results.length, detailScenarios: results.length, passed: true, pageErrors: errors }));
} finally { await browser.close(); }

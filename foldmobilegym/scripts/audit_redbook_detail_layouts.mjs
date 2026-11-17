import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { reportAudit } from './audit_app_catalog.mjs';

const notes = JSON.parse(fs.readFileSync(new URL('../apps/RedBook/data/notes.json', import.meta.url), 'utf8'));
const indices = [...new Set(Array.from({ length: 12 }, (_, i) => Math.floor(i * (notes.length - 1) / 11)))];
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];
const issues = [];
const app = '[data-app-id="redbook"]';
try {
  const page = await browser.newPage();
  page.on('pageerror', error => issues.push({ issue: error.message }));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__));
  for (const index of indices) {
    const note = notes[index];
    try {
      await page.evaluate(id => window.__OS__.openApp('redbook', `/note/${id}`), note.id);
      await page.waitForFunction(id => {
        const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
        return image?.currentSrc.includes(`/images/posts/${id}/0.jpg`) && image.complete && image.naturalWidth > 0;
      }, { timeout: 15000 }, note.id);
      if (note.images.length > 1) {
        await page.evaluate(() => {
          const next = document.querySelector('[data-app-id="redbook"] [data-image-swiper] > div.right-0.cursor-pointer');
          if (!next) throw new Error('Gallery next-image control missing');
          next.click();
        });
        await page.waitForFunction(id => {
          const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
          return image?.currentSrc.includes(`/images/posts/${id}/1.jpg`) && image.complete && image.naturalWidth > 0;
        }, { timeout: 15000 }, note.id);
      }
      const expectedImage = await page.$eval(`${app} [data-image-swiper] img`, el => el.currentSrc);
      for (const posture of ['folded', 'unfolded', 'half_folded']) {
        await page.evaluate(p => window.__FOLDAGENT__.setPosture(p), posture);
        await new Promise(resolve => setTimeout(resolve, 300));
        await page.waitForFunction(([id, source, expectedPosture]) => {
          const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
          const rect = image?.getBoundingClientRect();
          return image?.currentSrc === source && image.complete && image.naturalWidth > 0
            && rect.width > 20 && rect.height > 20 && window.__OS__.getAppRoute('redbook')?.path === `/note/${id}`
            && window.__FOLDAGENT__.getState().posture === expectedPosture;
        }, { timeout: 5000 }, [note.id, expectedImage, posture]);
        const overflow = await page.$eval(app, el => Math.max(0, el.scrollWidth - el.clientWidth));
        assert.ok(overflow <= 8, `Horizontal overflow ${overflow}px`);
        results.push({ id: note.id, posture, selectedImageRetained: true, decoded: true, overflow });
      }
    } catch (error) { issues.push({ id: note.id, issue: String(error.message || error) }); }
  }
} finally { await browser.close(); }
reportAudit({ sampledPosts: indices.length, layoutChecks: results.length, results, issues,
  scope: '12 distributed detail samples and selected-image continuity across three postures; not all post images or task acceptance' });
if (issues.length) process.exitCode = 1;

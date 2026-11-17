// DOM-guided catalog/search diagnostic; no installation or business mutation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const sourceFiles = ['apps/AppStore/AppStoreApp.tsx', 'apps/AppStore/pages/StorePages.tsx',
  'apps/AppStore/catalog.ts', 'apps/AppStore/navigation.declaration.ts'];
const fingerprints = () => Object.fromEntries(sourceFiles.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex')]));
const before = fingerprints();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="appstore"]';
const input = `${app} input[type="search"]`;
const errors = [];
let cases = 0, emptyCases = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__));
  for (const locale of ['zh-Hans', 'en']) {
    const catalog = await page.evaluate(async value => {
      const { setLocale } = await import('/os/locale.ts');
      setLocale(value);
      const { getCatalog } = await import('/apps/AppStore/catalog.ts');
      return getCatalog().map(item => ({ id: item.id,
        query: value === 'en' ? (item.displayNameEn || item.displayName) : item.displayName }));
    }, locale);
    assert.equal(catalog.length, 29);
    for (const posture of ['folded', 'unfolded', 'half_folded']) {
      await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture);
      await page.evaluate(() => window.__OS__.openApp('appstore', '/search'));
      await page.waitForSelector(input);
      for (const item of catalog) {
        await page.click(input);
        await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.type(input, `  ${item.query}  `);
        await page.click(`${app} [data-trigger="appstore.search.results"]`);
        await page.waitForFunction(({ id, query }) => {
          const root = document.querySelector('[data-app-id="appstore"]');
          return root?.querySelector('input')?.value === query
            && [...root.querySelectorAll('.appstore-row')].some(row => JSON.parse(row.dataset.triggerParams).appId === id);
        }, { timeout: 10000 }, item);
        const row = await page.evaluateHandle(id => [...document.querySelectorAll('[data-app-id="appstore"] .appstore-row')]
          .find(node => JSON.parse(node.dataset.triggerParams).appId === id), item.id);
        assert.ok(row.asElement());
        await row.asElement().click(); await row.dispose();
        await page.waitForFunction(id => {
          const button = document.querySelector('[data-app-id="appstore"] .appstore-open');
          return button && JSON.parse(button.dataset.actionParams).appId === id;
        }, { timeout: 10000 }, item.id);
        const overflow = await page.$eval(`${app} .appstore-page`, node => node.scrollWidth > node.clientWidth + 1);
        assert.equal(overflow, false);
        await page.click(`${app} [data-trigger="system.back"]`);
        await page.waitForFunction(query => document.querySelector('[data-app-id="appstore"] input')?.value === query,
          { timeout: 10000 }, item.query);
        cases++;
      }
      await page.click(input);
      await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(input, 'app-not-in-catalog-987654321');
      await page.click(`${app} [data-trigger="appstore.search.results"]`);
      await page.waitForSelector(`${app} .appstore-empty`);
      assert.equal(await page.$$eval(`${app} .appstore-row`, rows => rows.length), 0);
      emptyCases++;
      console.log(JSON.stringify({ locale, posture, catalogCases: catalog.length, emptyResult: true }));
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(fingerprints(), before);
  console.log(JSON.stringify({ passed: true, catalogCases: cases, emptyCases, pageErrors: errors, sourceHashes: before,
    scope: '29 catalog apps × two locale-name queries × three postures; ordinary search/detail/back only, not installation, task or screenshot-agent qualification' }));
} finally { await browser.close(); }

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const front = existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath && existsSync(executablePath));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3432/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);

const browser = await require('puppeteer').launch({ headless: true, executablePath });
try {
  for (const posture of ['folded', 'unfolded']) {
    for (const [number, expected] of [['123456789', 'Synthetic Contact'], ['*123456789#', '*123456789#'], ['+123456789', '+123456789']]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const errors = [];
      try {
        page.on('pageerror', error => errors.push(error.message));
        await page.setRequestInterception(true);
        page.on('request', request => {
          const target = new URL(request.url());
          if ((['localhost', '127.0.0.1'].includes(target.hostname) && ['GET', 'HEAD'].includes(request.method())) || ['data:', 'blob:'].includes(target.protocol)) request.continue();
          else request.abort();
        });
        await page.setViewport({ width: 1440, height: 1100 });
        await page.goto(url.href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
        await page.evaluate(async ({ posture, number }) => {
          const { useContactsProviderStore } = await import('/os/providers/ContactsProvider.ts');
          window.__FOLDAGENT__.setPosture(posture);
          await window.__SIM__.preloadAppStores(['contacts']);
          useContactsProviderStore.setState({ contacts: [{ id: 'synthetic-identity', displayName: 'Synthetic Contact', phones: [{ id: 'p', label: 'mobile', number: '123 456 789' }] }] });
          window.__OS__.openApp('contacts', `/?dialpad=true&number=${encodeURIComponent(number)}`);
        }, { posture, number });
        await page.waitForSelector('[data-app-id="contacts"] .contacts-dialpad-call-primary');
        if (posture === 'unfolded') {
          const contextText = await page.$eval('[data-app-id="contacts"] .contacts-dialpad-context', el => el.textContent);
          assert.equal(contextText.includes('Synthetic Contact'), expected === 'Synthetic Contact');
        }
        await page.click('[data-app-id="contacts"] .contacts-dialpad-call-primary');
        await page.waitForSelector('[data-app-id="contacts"] [data-simulated-call-screen]');
        assert.equal(await page.$eval('[data-app-id="contacts"] [data-simulated-call-screen] h1', el => el.textContent), expected);
        await page.click('[data-app-id="contacts"] [data-simulated-call-end]');
        await page.waitForSelector('[data-app-id="contacts"] [data-benchmark-field="dialpad-digits"]');
        assert.equal((await page.$eval('[data-app-id="contacts"] [data-benchmark-field="dialpad-digits"]', el => el.textContent)).trim(), number);
        assert.deepEqual(errors, []);
        console.log('PASS', posture, number);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

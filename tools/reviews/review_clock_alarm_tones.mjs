import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const frontend = ['mobilegym', 'foldmobilegym'].find(name => fs.existsSync(path.join(root, name, 'package.json')));
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3241/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(fs.existsSync);
assert.ok(executablePath);
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const baseTime = new Date('2026-11-14T12:00:00Z').getTime();

try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    try {
      page.on('pageerror', error => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', request => {
        const target = new URL(request.url());
        if (request.method() === 'GET' && target.origin === url.origin && target.pathname !== '/api' && !target.pathname.startsWith('/api/')) request.continue();
        else request.abort();
      });
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__ && window.__SIM__ && window.__SIM_TIME__);
      await page.evaluate(({ locale, posture, baseTime }) => {
        window.__OS__.locale.setLocale(locale);
        window.__FOLDAGENT__.setPosture(posture);
        window.__SIM_TIME__.setSimulatedTime(baseTime, false);
        const clock = window.__SIM__.getState().apps.clock;
        window.__SIM__.setState({ apps: { clock: { ...clock, alarms: [] } } }, { deep: false, reload: false });
        window.__OS__.openApp('clock', '/alarm');
      }, { locale, posture, baseTime });

      const app = '[data-app-id="clock"]';
      const editor = `${app} [data-clock-dialog="editor"]`;
      const ringtone = `${app} [data-clock-dialog="ringtone"]`;
      await page.waitForSelector(`${app} .clock-alarm-add`, { visible: true });
      await page.click(`${app} .clock-alarm-add`);
      await page.waitForSelector(editor, { visible: true });
      await page.click(`${editor} [data-trigger="alarm.ringtone.open"]`);
      await page.waitForSelector(ringtone, { visible: true });
      assert.equal(await page.$eval(`${ringtone} [data-ringtone-choice="classic"]`, node => node.getAttribute('aria-pressed')), 'true');
      await page.click(`${ringtone} [data-ringtone-choice="soft"]`);
      assert.equal(await page.$eval(`${ringtone} [data-ringtone-choice="soft"]`, node => node.getAttribute('aria-pressed')), 'true');

      await page.click(`${ringtone} [data-ringtone-preview="soft"]`);
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[data-clock-dialog="ringtone"]');
        return dialog?.querySelector('[data-ringtone-preview="soft"]')?.getAttribute('aria-pressed') === 'true'
          || dialog?.querySelector('[role="status"]');
      });
      const previewing = await page.$eval(`${ringtone} [data-ringtone-preview="soft"]`, node => node.getAttribute('aria-pressed') === 'true');
      if (previewing) {
        await page.click(`${ringtone} [data-ringtone-preview="soft"]`);
        await page.waitForFunction(() => document.querySelector('[data-clock-dialog="ringtone"] [data-ringtone-preview="soft"]')?.getAttribute('aria-pressed') === 'false');
      }
      await page.click(`${ringtone} button[data-trigger-type="back"]`);
      await page.waitForSelector(ringtone, { hidden: true });
      assert.equal(await page.$eval(`${editor} [data-trigger="alarm.ringtone.open"]`, (node, label) => node.textContent.includes(label), locale === 'en' ? 'Soft' : '柔和'), true);
      await page.click(`${editor} [data-action="alarm.add.save.submit"]`);
      await page.waitForSelector(editor, { hidden: true });
      assert.equal(await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms[0]?.tone), 'soft');

      await page.click(`${app} [data-trigger="alarm.item.edit.open"]`);
      await page.waitForSelector(`${app} [data-clock-dialog="quick"]`, { visible: true });
      await page.click(`${app} [data-trigger="alarm.editor.more.open"]`);
      await page.waitForSelector(editor, { visible: true });
      await page.click(`${editor} [data-trigger="alarm.ringtone.open"]`);
      await page.waitForSelector(ringtone, { visible: true });
      assert.equal(await page.$eval(`${ringtone} [data-ringtone-choice="soft"]`, node => node.getAttribute('aria-pressed')), 'true');
      await page.click(`${ringtone} [data-ringtone-choice="bright"]`);
      await page.click(`${ringtone} button[data-trigger-type="back"]`);
      await page.waitForSelector(ringtone, { hidden: true });
      await page.click(`${editor} [data-action="alarm.edit.save.submit"]`);
      await page.waitForSelector(editor, { hidden: true });
      assert.equal(await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms[0]?.tone), 'bright');
      assert.deepEqual(errors, []);
      console.log('PASS', posture, locale, 'create, nested picker/back, preview, persisted edit and tone-specific alarm state');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

// Isolated browser profile and synthetic simulator notes; block remote and API traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = ['mobilegym', 'foldmobilegym'].find(name => fs.existsSync(path.join(root, name, 'package.json')));
const require = createRequire(path.join(root, frontend, 'package.json'));
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath, 'Browser is required');
assert.ok(process.env.FOLDAGENT_REVIEW_URL, 'Set FOLDAGENT_REVIEW_URL to the intended local dev server');
const url = new URL(process.env.FOLDAGENT_REVIEW_URL);
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const failures = [], checks = [];
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) for (const scenario of ['spring', 'autumn']) {
    const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
    const label = `${locale}-${posture}-${scenario}`;
    try {
      page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', request => { const target = new URL(request.url()); if (request.method() === 'GET' && target.origin === url.origin && target.pathname !== '/api' && !target.pathname.startsWith('/api/')) request.continue(); else request.abort(); });
      await page.setViewport({ width: 1440, height: 1100 }); await page.emulateTimezone('America/New_York');
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__SIM_TIME__ && window.__FOLDAGENT__);
      const id = await page.evaluate(({ locale, posture, scenario }) => {
        window.__OS__.locale.setLocale(locale);
        window.__SIM_TIME__.setSimulatedTime(scenario === 'spring' ? '2026-03-07T12:00:00-05:00' : '2026-11-01T01:40:00-04:00', false);
        window.__FOLDAGENT__.setPosture(posture);
        const note = window.__SIM__.getState().apps.notes.notes.find(n => !n.isPrivate && !n.trashedAt && !n.hasChecklist && !n.reminder);
        if (!note) throw new Error('Missing synthetic default note');
        window.__OS__.openApp('notes', '/note/' + encodeURIComponent(note.id)); return note.id;
      }, { locale, posture, scenario });
      const before = await page.evaluate(id => JSON.stringify(window.__SIM__.getState().apps.notes.notes.find(n => n.id === id)), id);
      const app = '[data-app-id="notes"]', sheet = app + ' [data-notes-sheet="reminder"]';
      await page.waitForSelector(app + ' [data-trigger="notes.editor.menu.open"]', { visible: true });
      await page.click(app + ' [data-trigger="notes.editor.menu.open"]');
      await page.waitForSelector(app + ' [data-notes-sheet="menu"] [data-trigger="notes.editor.reminder.open"]', { visible: true });
      await page.click(app + ' [data-notes-sheet="menu"] [data-trigger="notes.editor.reminder.open"]');
      const col = name => `${sheet} [data-reminder-column="reminder${name}"]`;
      await page.waitForSelector(col('Day'), { visible: true });
      if (scenario === 'spring') {
        await page.focus(col('Day')); await page.keyboard.press('ArrowDown');
        await page.waitForFunction(selector => new Date(Number(document.querySelector(selector)?.dataset.reminderSelected)).getDate() === 8, {}, sheet + ' [data-reminder-selected]');
        const hours = await page.$$eval(col('Hour') + ' [role="option"]', elements => elements.map(el => el.textContent.trim()));
        assert.ok(!hours.some(text => /^02\b/.test(text)), 'Nonexistent hour must not be offered');
        await page.evaluate(() => window.__OS__.handleBack());
        await page.waitForFunction(() => !window.__OS__.getAppRoute('notes').path.includes('sheet=reminder'));
        assert.equal(await page.evaluate(id => JSON.stringify(window.__SIM__.getState().apps.notes.notes.find(n => n.id === id)), id), before, 'Cancel must not change note');
      } else {
        const minute = col('Minute');
        await page.waitForFunction(selector => [...document.querySelectorAll(selector + ' [role="option"]')].some(el => /^30\b/.test(el.textContent.trim())), {}, minute);
        await page.$eval(minute, el => [...el.querySelectorAll('[role="option"]')].find(option => /^30\b/.test(option.textContent.trim())).click());
        const expected = Date.parse('2026-11-01T01:30:00-05:00');
        await page.waitForFunction(({selector, expected}) => Number(document.querySelector(selector)?.dataset.reminderSelected) === expected, {}, {selector: sheet + ' [data-reminder-selected]', expected});
        const submit = sheet + ' [data-action="notes.editor.reminder.save.submit"]';
        await page.click(submit);
        await page.waitForFunction(() => !window.__OS__.getAppRoute('notes').path.includes('sheet=reminder'));
        const after = await page.evaluate(id => window.__SIM__.getState().apps.notes.notes.find(n => n.id === id), id);
        assert.ok(JSON.stringify(after).includes(String(expected)), `Saved note must contain the expected instant: ${JSON.stringify(after)}`);
      }
      assert.deepEqual(errors, []); checks.push(label); console.log('PASS', label);
    } catch (error) { failures.push(`${label}: ${error.stack || error}`); console.error('FAIL', failures.at(-1)); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ checks, failures })); if (failures.length) process.exitCode = 1;

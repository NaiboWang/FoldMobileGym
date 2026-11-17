import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Real browser pointer input; no alarm saves/deletes or formal task qualification.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="clock"]';
const sheet = `${app} .absolute.top-10`;
const bar = `${sheet} .cursor-grab`;
const errors = [];
let cases = 0;
try {
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    for (const mode of ['add', 'edit']) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__));
      await page.evaluate(value => { window.__FOLDAGENT__.setPosture(value); window.__OS__.openApp('clock', '/alarm'); }, posture);
      await page.waitForSelector(`${app} button[class*="bottom-[112px]"]`, { visible: true });
      const before = await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms);
      if (mode === 'add') await page.click(`${app} button[class*="bottom-[112px]"]`);
      else {
        await page.click(`${app} button.flex-col.text-left.flex-1`);
        await page.waitForSelector(`${app} .fixed.inset-0 .flex.gap-3 button:first-child`, { visible: true });
        await page.click(`${app} .fixed.inset-0 .flex.gap-3 button:first-child`);
      }
      await page.waitForSelector(bar, { visible: true });
      const note = `Uncommitted ${mode} drag cancellation`;
      await page.type(`${sheet} input`, note);
      await page.keyboard.press('Tab');
      const expectedNote = await page.$eval(`${sheet} input`, input => input.value);
      const point = await page.$eval(bar, node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      const cdp = await page.createCDPSession();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y + 160, id: 1 }] });
      await page.waitForFunction(selector => document.querySelector(selector)?.style.transform === 'translateY(160px)',
        { timeout: 5000 }, sheet);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.waitForFunction(selector => !document.querySelector(selector)
        || document.querySelector(selector).style.transform === 'translateY(0px)', { timeout: 5000 }, sheet);
      assert.ok(await page.$(sheet), 'A cancelled gesture must not dismiss the uncommitted editor');
      assert.equal(await page.$eval(`${sheet} input`, input => input.value), expectedNote);
      assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms), before);
      // An intentional drag still dismisses without committing anything.
      const resetPoint = await page.$eval(bar, node => {
        const rect = node.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      await page.mouse.move(resetPoint.x, resetPoint.y); await page.mouse.down();
      await page.mouse.move(resetPoint.x, resetPoint.y + 160, { steps: 8 }); await page.mouse.up();
      await page.waitForSelector(sheet, { hidden: true });
      assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms), before);
      assert.ok(await page.$(`${app} button[class*="bottom-[112px]"]`));
      await page.click(`${app} button[class*="bottom-[112px]"]`);
      await page.waitForSelector(bar, { visible: true });
      // Exercise the existing system-back dispatcher; no custom route mutation.
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForSelector(sheet, { hidden: true });
      assert.equal(await page.$eval(app, node => node.getBoundingClientRect().width > 0), true);
      assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms), before);
      cases++;
      console.log(JSON.stringify({ posture, mode, cancelRetainsInput: true, intentionalDismiss: true,
        systemBackDismiss: true, alarmsUnchanged: true }));
      await cdp.detach(); await page.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, cases, pageErrors: errors,
    scope: 'Touch cancellation, intentional mouse dismissal and add-sheet system-back dispatch; not draft recreation or task qualification' }));
} finally { await browser.close(); }

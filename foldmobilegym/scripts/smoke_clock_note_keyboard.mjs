import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Isolated ordinary Clock input/layout diagnostic, not an alarm/recovery benchmark episode.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="clock"]';
const add = `${app} button[class*="bottom-[112px]"]`;
const note = `${app} input`;
const errors = [];
try {
  let scenarios = 0;
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 1100, height: 720 }]) {
    for (const posture of ['unfolded', 'folded', 'half_folded']) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport(viewport);
      await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__));
      await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
      await page.evaluate(() => window.__OS__.openApp('clock', '/alarm'));
      await page.waitForSelector(add, { visible: true });
      const before = await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms);
      await page.click(add);
      await page.waitForSelector(note, { visible: true });
      const selectedTime = () => page.$eval(`${app} .absolute.top-10`, sheet =>
        [...sheet.querySelectorAll('.overflow-y-scroll')].map(wheel => Number(wheel.querySelector('.font-medium')?.textContent)));
      const timeBefore = await selectedTime();
      assert.equal(timeBefore.length, 2);
      const waitVisibleTime = () => page.waitForFunction(({ app, expected }) => {
        const wheels = [...document.querySelectorAll(`${app} .absolute.top-10 .overflow-y-scroll`)];
        return wheels.length === 2 && wheels.every((wheel, index) => {
          const rect = wheel.getBoundingClientRect();
          if (!rect.width || !rect.height) return false;
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return hit && wheel.contains(hit) && hit.classList.contains('font-medium')
            && Number(hit.textContent) === expected[index];
        });
      }, { timeout: 5000 }, { app, expected: timeBefore });
      await waitVisibleTime();
      await page.type(note, 'Local alarm note diagnostic');
      await page.waitForFunction(() => window.__OS__.keyboard.isVisible());
      await page.evaluate(selector => new Promise((resolve, reject) => {
        let previous = '', stable = 0, frames = 0;
        const sample = () => {
          const input = document.querySelector(selector);
          const scroll = input?.closest('.overflow-y-auto');
          const rect = input?.getBoundingClientRect();
          const bounds = scroll?.getBoundingClientRect();
          const current = rect && bounds ? [rect.x, rect.y, rect.width, rect.height,
            bounds.x, bounds.y, bounds.width, bounds.height].join(',') : '';
          stable = current && current === previous ? stable + 1 : 0;
          previous = current;
          if (stable >= 12) resolve();
          else if (++frames > 300) reject(new Error('Clock note layout did not settle'));
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }), note);
      const geometry = await page.$eval(note, input => {
        const scroll = input.closest('.overflow-y-auto');
        const sheet = input.closest('.absolute.top-10');
        const rect = input.getBoundingClientRect();
        const bounds = scroll.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const save = sheet.querySelector('.mb-4 button:last-of-type');
        const saveRect = save.getBoundingClientRect();
        const saveHit = document.elementFromPoint(saveRect.x + saveRect.width / 2, saveRect.y + saveRect.height / 2);
        return { focused: document.activeElement === input,
          noteFits: rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1,
          noteHit: hit === input, saveHit: Boolean(saveHit && save.contains(saveHit)),
          scrollHeight: bounds.height, noteTop: rect.top, noteBottom: rect.bottom,
          visibleTop: bounds.top, visibleBottom: bounds.bottom,
          horizontalOverflow: scroll.scrollWidth > scroll.clientWidth + 1 };
      });
      console.log(JSON.stringify({ viewport, posture, ...geometry }));
      assert.equal(geometry.focused, true);
      assert.equal(geometry.noteFits, true, 'Alarm note must fit the scroll region with keyboard open');
      assert.equal(geometry.noteHit, true, 'Alarm note must not be covered');
      assert.equal(geometry.saveHit, true);
      assert.equal(geometry.horizontalOverflow, false);
      assert.equal(await page.$eval(note, input => input.value), 'Local alarm note diagnostic');
      assert.deepEqual(await selectedTime(), timeBefore, 'Typing a note must not change selected hour/minute');
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForFunction(() => !window.__OS__.keyboard.isVisible());
      await page.waitForSelector(`${app} .absolute.top-10 .overflow-y-scroll`, { visible: true });
      assert.deepEqual(await selectedTime(), timeBefore, 'Selected time must survive keyboard dismissal');
      await waitVisibleTime();
      await page.click(`${app} .absolute.top-10 .mb-4 > div`);
      await page.click(note);
      await page.waitForFunction(() => window.__OS__.keyboard.isVisible());
      assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms), before);
      await page.click(`${app} .absolute.top-10 .mb-4 button:last-of-type`);
      await page.waitForFunction(count => window.__SIM__.getState().apps.clock.alarms.length === count + 1, {}, before.length);
      const after = await page.evaluate(() => window.__SIM__.getState().apps.clock.alarms);
      const created = after.filter(alarm => !before.some(old => old.id === alarm.id));
      assert.equal(created.length, 1);
      assert.equal(created[0].note, 'Local alarm note diagnostic');
      assert.equal(created[0].enabled, true);
      assert.equal(created[0].hour, timeBefore[0]);
      assert.equal(created[0].minute, timeBefore[1]);
      assert.deepEqual(after.filter(alarm => before.some(old => old.id === alarm.id)), before);
      scenarios++;
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, scenarios, pageErrors: errors,
    scope: 'DOM-guided alarm note/keyboard/save controls; NOT exact-time, dated-alarm, draft-recovery or screenshot-agent qualification' }));
} finally { await browser.close(); }

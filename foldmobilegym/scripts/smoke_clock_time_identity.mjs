import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Ordinary DOM-guided controls, not screenshot-only agent/task qualification.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="clock"]';
const sheet = `${app} .absolute.top-10`;
const wheels = `${sheet} .overflow-y-scroll, ${app} .fixed.inset-0 .overflow-y-scroll`;
const errors = [];
async function selectTime(page, target) {
  for (let column = 0; column < 2; column++) {
    for (let steps = 0; ; steps++) {
      const current = await page.$$eval(wheels, (elements, index) => {
        const wheel = elements[index];
        const rect = wheel.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const cell = wheel.querySelector('.font-medium');
        return { value: Number(cell.textContent), centered: Boolean(hit && wheel.contains(hit)
          && hit.classList.contains('font-medium') && Number(hit.textContent) === Number(cell.textContent)),
          x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
          step: cell.getBoundingClientRect().height };
      }, column);
      assert.equal(current.centered, true, 'Visible center must match selected value');
      if (current.value === target[column]) break;
      assert.ok(steps < 65, 'Wheel must reach requested value');
      await page.mouse.move(current.x, current.y);
      await page.mouse.wheel({ deltaY: current.step });
      await page.waitForFunction(({ selector, column, previous }) => {
        const wheel = document.querySelectorAll(selector)[column];
        const cell = wheel?.querySelector('.font-medium');
        if (!cell || Number(cell.textContent) === previous) return false;
        const rect = wheel.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return hit && wheel.contains(hit) && hit.classList.contains('font-medium')
          && Number(hit.textContent) === Number(cell.textContent);
      }, { timeout: 5000 }, { selector: wheels, column, previous: current.value });
    }
  }
}
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
      const add = `${app} button[class*="bottom-[112px]"]`;
      await page.waitForSelector(add, { visible: true });
      const alarms = () => page.evaluate(() => window.__SIM__.getState().apps.clock.alarms);
      const before = await alarms();
      await page.click(add);
      await page.waitForSelector(wheels, { visible: true });
      for (const time of [[23, 59], [0, 0], [6, 17], [18, 43]]) {
        await selectTime(page, time);
        assert.deepEqual(await alarms(), before, 'Time selection must not implicitly save');
      }
      await page.click(`${sheet} .mb-4 button:first-of-type`);
      await page.waitForSelector(sheet, { hidden: true });
      assert.deepEqual(await alarms(), before, 'Cancel must not save');
      await page.click(add);
      await page.waitForSelector(wheels, { visible: true });
      await selectTime(page, [6, 17]);
      await page.type(`${sheet} input`, 'Local time identity diagnostic');
      await page.click(`${sheet} .mb-4 button:last-of-type`);
      await page.waitForSelector(sheet, { hidden: true });
      const createdState = await alarms();
      const fresh = createdState.filter(alarm => !before.some(old => old.id === alarm.id));
      assert.equal(fresh.length, 1);
      const created = fresh[0];
      assert.equal(created.hour, 6);
      assert.equal(created.minute, 17);
      assert.equal(created.note, 'Local time identity diagnostic');
      assert.equal(created.enabled, true);
      assert.deepEqual(createdState.filter(alarm => alarm.id !== created.id), before);
      const buttons = await page.$$(`${app} button.flex-col.text-left`);
      let target;
      for (const button of buttons) {
        if ((await button.evaluate(el => el.textContent)).includes(created.note)) target = button;
      }
      assert.ok(target, 'Created alarm must be reachable in ordinary list');
      await target.click();
      await page.waitForSelector(wheels, { visible: true });
      await selectTime(page, [0, 1]);
      assert.deepEqual(await alarms(), createdState, 'Editing must not implicitly save');
      await page.click(`${app} .fixed.inset-0 .flex.gap-3 button:last-of-type`);
      await page.waitForSelector(wheels, { hidden: true });
      const expected = createdState.map(alarm => alarm.id === created.id ? { ...alarm, hour: 0, minute: 1 } : alarm);
      assert.deepEqual(await alarms(), expected, 'Edit must update only the same alarm ID');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__SIM__?.getState().apps.clock));
      assert.deepEqual(await alarms(), expected, 'Saved time must persist across browser reload');
      console.log(JSON.stringify({ viewport, posture, passed: true, selectedTimes: ['23:59', '00:00', '06:17', '18:43'], editedTime: '00:01' }));
      scenarios++;
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, scenarios, pageErrors: errors,
    scope: 'Mouse-wheel selection, cancel/create/edit identity and saved-data reload; not dated alarms, recovery, repeat/IME or screenshot-agent qualification' }));
} finally { await browser.close(); }

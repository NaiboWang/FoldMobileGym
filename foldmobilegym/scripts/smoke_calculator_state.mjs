import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__));
  await page.evaluate(() => window.__SIM__.resetState());
  // resetState deliberately holds the persistence reset gate until reload/inject.
  await page.reload({ waitUntil: 'domcontentloaded' });
  const app = '[data-app-id="calculator"]';
  const read = () => page.evaluate(() => window.__SIM__.getState().apps.calculator);
  const open = async () => {
    await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__));
    await page.evaluate(() => window.__OS__.openApp('calculator'));
    await page.waitForSelector(`${app} [data-calculator-display]`, { visible: true });
  };
  const press = async label => {
    const buttons = await page.$$(`${app} button`);
    for (const button of buttons) {
      if (await button.evaluate((el, label) => el.textContent.trim() === label, label)) {
        await button.click(); return;
      }
    }
    throw Error(`Missing key ${label}`);
  };
  const text = async value => { for (const char of value) await press(char); };
  await open();
  assert.equal((await read()).calculationCount, 0);
  await text('24.8'); await press('×'); await press('2');
  const draft = await read();
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.deepEqual(await read(), draft);
    assert.equal(await page.$eval(`${app} [data-calculator-display]`, el => el.textContent.trim()), '2');
    const clipped = await page.$eval(app, el => {
      const outer = el.getBoundingClientRect();
      return [...el.querySelectorAll('button')].filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.left < outer.left - 1 || rect.right > outer.right + 1
          || rect.top < outer.top - 1 || rect.bottom > outer.bottom + 1;
      }).map(button => button.textContent.trim());
    });
    assert.deepEqual(clipped, [], `Clipped buttons: ${posture}`);
  }
  await page.evaluate(() => window.__OS__.handleBack());
  await page.waitForSelector('[data-launcher="true"]', { visible: true });
  await open();
  assert.deepEqual(await read(), draft);
  await page.evaluate(() => window.__OS__.closeApp('calculator'));
  await open();
  assert.deepEqual(await read(), draft);
  await press('=');
  assert.equal((await read()).calculations[0].result, 49.6);
  await page.reload({ waitUntil: 'domcontentloaded' }); await open();
  assert.equal((await read()).display, '49.6');
  await press('AC');
  assert.equal((await read()).calculationCount, 1);
  await text('200'); await press('×'); await text('10'); await press('%'); await press('=');
  assert.equal((await read()).display, '20');
  await page.evaluate(() => window.__SIM__.resetState()); await open();
  assert.equal((await read()).display, '0');
  assert.equal((await read()).calculationCount, 0);
  assert.deepEqual((await read()).calculations, []);
  console.log(JSON.stringify({ passed: true, postures: 3, back: true, recreation: true, reload: true,
    reset: true, ordinaryButtonClicks: true, scope: 'Development UI regression, not CW21 or model evaluation' }));
} finally { await browser.close(); }

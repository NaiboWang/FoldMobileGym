import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const steps = [{ left: 12.3, operator: '*', right: 2, result: 24.6 },
  { left: 24.6, operator: '+', right: 8.75, result: 33.35 }];
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__ && window.__OS__));
  const app = '[data-app-id="calculator"]';
  const read = () => page.evaluate(() => window.__SIM__.getState().apps.calculator);
  const matches = (initial, current) => page.evaluate(async ({ initial, current, steps }) => {
    const { hasFreshCalculationSteps } = await import('/foldagent_calculation_evidence.ts');
    return hasFreshCalculationSteps(initial, current, steps);
  }, { initial, current, steps });
  const press = async label => {
    for (const button of await page.$$(`${app} button`)) {
      if (await button.evaluate((node, text) => node.textContent.trim() === text, label)) {
        await button.click(); return;
      }
    }
    throw Error(`Missing actual calculator key ${label}`);
  };
  const input = async value => { for (const key of value) await press(key); };
  const results = [];
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.evaluate(() => window.__OS__.openApp('calculator'));
    await page.waitForSelector(`${app} [data-calculator-display]`, { visible: true });
    await press('AC');
    const initial = await read();
    await input('12.3'); await press('×'); await input('2'); await press('+');
    await input('8.75'); await press('=');
    const calculated = await read();
    assert.equal(calculated.display, '33.35');
    assert.equal(calculated.calculationCount, initial.calculationCount + 2);
    assert.equal(await matches(initial, calculated), true);
    assert.equal(await matches(calculated, calculated), false, 'Old correct history must not count as new work');
    await press('AC'); await input('33.35');
    assert.equal(await matches(calculated, await read()), false, 'Typing an answer is not calculation');
    const wrongInitial = await read();
    await press('AC'); await input('30'); await press('+'); await input('3.35'); await press('=');
    assert.equal((await read()).display, '33.35');
    assert.equal(await matches(wrongInitial, await read()), false, 'Equal answer from unrelated operands must fail');
    results.push({ posture, freshChain: true, staleRejected: true, directAnswerRejected: true, wrongFormulaRejected: true });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, results, pageErrors: errors,
    scope: 'Public calculator evidence diagnostic; ordinary button clicks, not CW21 qualification or model evaluation' }));
} finally { await browser.close(); }

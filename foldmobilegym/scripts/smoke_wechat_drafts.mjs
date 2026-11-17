import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const input = '[data-app-id="wechat"] [data-benchmark-field="wechat-draft"]';
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-launcher="true"]');
  await page.evaluate(() => window.__OS__.openApp('wechat'));
  await page.waitForFunction(() => window.__SIM__.getState().apps.wechat?.chats?.length >= 2);
  const initial = await page.evaluate(() => window.__SIM__.getState().apps.wechat);
  const ids = initial.chats.slice(0, 2).map(chat => chat.id);
  assert.notEqual(ids[0], ids[1]);
  const open = async id => {
    await page.evaluate(target => window.__OS__.openApp('wechat', `/chat/${target}`), id);
    await page.waitForSelector(input);
  };
  await open(ids[0]);
  await page.type(input, 'Draft A: meeting at 09:30, room A305.');
  await open(ids[1]);
  assert.equal(await page.$eval(input, el => el.value), initial.chatDrafts?.[ids[1]] ?? '');
  await page.type(input, 'Draft B: independent recipient.');
  await open(ids[0]);
  assert.equal(await page.$eval(input, el => el.value), 'Draft A: meeting at 09:30, room A305.');
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(p => window.__FOLDAGENT__.setPosture(p), posture);
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(await page.$eval(input, el => el.value), 'Draft A: meeting at 09:30, room A305.');
  }
  await page.evaluate(() => window.__OS__.closeApp('wechat'));
  await page.waitForSelector('[data-launcher="true"]');
  await open(ids[0]);
  assert.equal(await page.$eval(input, el => el.value), 'Draft A: meeting at 09:30, room A305.');
  await open(ids[1]);
  assert.equal(await page.$eval(input, el => el.value), 'Draft B: independent recipient.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-launcher="true"]');
  await open(ids[0]);
  assert.equal(await page.$eval(input, el => el.value), 'Draft A: meeting at 09:30, room A305.');
  const final = await page.evaluate(() => window.__SIM__.getState().apps.wechat);
  assert.equal(final.chatDrafts[ids[1]], 'Draft B: independent recipient.');
  assert.equal(final.send_count, initial.send_count);
  assert.deepEqual(final.chats, initial.chats);
  console.log(JSON.stringify({ passed: true, independentRecipients: 2, postureTests: 3,
    closeReopen: true, reloadPersistence: true, noSend: true,
    scope: 'UI lifecycle regression; no formal five-condition task episode' }));
} finally { await browser.close(); }

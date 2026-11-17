import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];
const post = '2kvlyjk5h';
const gallery = '[data-app-id="redbook"] [data-image-swiper]';
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__));
  const session = await page.createCDPSession();
  const image = index => page.waitForFunction(({ gallery, post, index }) => {
    const image = document.querySelector(`${gallery} img`);
    return image?.currentSrc.endsWith(`/images/posts/${post}/${index}.jpg`) && image.complete && image.naturalWidth > 0;
  }, { timeout: 5000 }, { gallery, post, index });
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture);
    await page.evaluate(id => window.__OS__.openApp('redbook', `/note/${id}`), post);
    await page.waitForFunction(() => document.getElementById('root').getAnimations().length === 0);
    await image(0);
    await page.click(`${gallery} > div.right-0.cursor-pointer`); await image(1);
    await page.click(`${gallery} > div.left-0.cursor-pointer`); await image(0);
    const bounds = await page.$eval(gallery, node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + Math.min(rect.height / 2, 240), delta: rect.width * 0.25 };
    });
    await page.mouse.click(bounds.x, bounds.y); await image(0);
    const drag = async direction => {
      await page.mouse.move(bounds.x, bounds.y); await page.mouse.down();
      await page.mouse.move(bounds.x + direction * bounds.delta, bounds.y, { steps: 12 });
      await page.mouse.up();
    };
    await drag(-1); await image(1); await drag(1); await image(0);
    const touch = (type, x) => session.send('Input.dispatchTouchEvent', { type,
      touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y: bounds.y, radiusX: 1, radiusY: 1, force: 1 }] });
    await touch('touchStart', bounds.x); await touch('touchMove', bounds.x - bounds.delta);
    await touch('touchCancel'); await image(0);
    await touch('touchStart', bounds.x); await touch('touchMove', bounds.x - bounds.delta);
    await touch('touchEnd'); await image(1);
    await touch('touchStart', bounds.x); await touch('touchMove', bounds.x + bounds.delta);
    await touch('touchEnd'); await image(0);
    assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('redbook').path), `/note/${post}`);
    console.log(JSON.stringify({ posture, clickNextPrevious: true, centerTapUnchanged: true,
      mouseSwipe: true, touchSwipe: true, touchCancelUnchanged: true, detailRouteUnchanged: true }));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, postures: 3, pageErrors: errors,
    scope: 'Actual mouse/touch gallery transport regression, not all-post/task qualification' }));
} finally { await browser.close(); }

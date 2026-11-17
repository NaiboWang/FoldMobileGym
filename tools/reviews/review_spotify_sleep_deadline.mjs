import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const frontend = ['mobilegym', 'foldmobilegym'].find(name => fs.existsSync(path.join(root, name, 'package.json')));
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3237/');
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
        const state = window.__SIM__.getState().apps.spotify;
        const track = { ...state.currentTrack, id: 'sleep-review-track', duration: '10:00' };
        window.__SIM__.setState({ apps: { spotify: { ...state, currentTrack: track, queue: [track], isPlaying: true,
          playback: { trackId: track.id, anchorPositionMs: 0, anchorTimeMs: baseTime }, repeat: 'track' } } }, { deep: false, reload: false });
        window.__OS__.openApp('spotify', '/player');
      }, { locale, posture, baseTime });

      const app = '[data-app-id="spotify"]';
      await page.waitForSelector(`${app} .spotify-player-reference`, { visible: true });
      await page.click(`${app} [data-trigger="player.trackMenu.open"]`);
      await page.waitForSelector(`${app} [data-trigger="player.timer.openFromMenu"]`, { visible: true });
      await page.click(`${app} [data-trigger="player.timer.openFromMenu"]`);
      await page.waitForSelector(`${app} [data-action="player.timer.set"][data-action-params='{"minutes":5}']`, { visible: true });
      assert.equal(await page.$(`${app} [data-action="player.timer.fade.toggle"]`), null);
      assert.ok(await page.$(`${app} [role="note"]`));
      await page.click(`${app} [data-action="player.timer.set"][data-action-params='{"minutes":5}']`);
      const currentTimer = await page.evaluate(() => window.__SIM__.getState().apps.spotify.settings.playback);
      assert.equal(currentTimer.sleepTimerDeadlineMs, baseTime + 300000, JSON.stringify(currentTimer));

      await page.evaluate(() => window.__OS__.goHome());
      await page.evaluate(() => window.__OS__.openApp('spotify', '/player'));
      await page.waitForSelector(`${app} .spotify-player-reference`, { visible: true });
      await page.click(`${app} [data-trigger="player.trackMenu.open"]`);
      await page.waitForSelector(`${app} [data-trigger="player.timer.openFromMenu"]`, { visible: true });
      await page.click(`${app} [data-trigger="player.timer.openFromMenu"]`);
      await page.waitForFunction(() => Boolean(document.querySelector('[data-sleep-timer-remaining]')));
      const remaining = `${app} [data-sleep-timer-remaining]`;
      const remainingText = await page.$eval(remaining, node => node.textContent.trim());
      assert.ok(remainingText.includes('5:00'), `${locale} timer should survive leaving and reopening the player: ${remainingText}`);

      await page.evaluate(time => window.__SIM_TIME__.setSimulatedTime(time, false), baseTime + 299999);
      await page.waitForFunction(() => window.__SIM__.getState().apps.spotify.isPlaying);
      await page.waitForFunction(() => document.querySelector('[data-sleep-timer-remaining]')?.textContent.includes('0:01'));
      await page.evaluate(time => window.__SIM_TIME__.setSimulatedTime(time, false), baseTime + 300000);
      await page.waitForFunction(() => {
        const state = window.__SIM__.getState().apps.spotify;
        return !state.isPlaying && state.settings.playback.sleepTimer === 0 && state.settings.playback.sleepTimerDeadlineMs === 0;
      });
      assert.deepEqual(errors, []);
      console.log('PASS', posture, locale, 'persisted timer, exact stop deadline, honest audio-fade limitation');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

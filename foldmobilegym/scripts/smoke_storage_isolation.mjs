/** Check OS setting persistence within a tab and isolation between tabs. */
import puppeteer from 'puppeteer';

const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.createBrowserContext();

async function ready(page) {
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__?.locale), { timeout: 30000 });
}

try {
  const first = await context.newPage();
  await ready(first);
  const firstNamespace = await first.evaluate(() => window.__STORAGE_ISOLATION__?.namespace);
  if (!firstNamespace) throw new Error('The first tab has no storage namespace');
  await first.evaluate(() => window.__OS__.locale.setLocale('en'));
  await first.waitForFunction(() => window.__OS__.locale.getLocale() === 'en', { timeout: 10000 });
  await first.evaluate(() => window.__OS__.device.setPreference('dark_mode', true));
  await first.waitForFunction(() => window.__OS__.device.getPreference('dark_mode') === true, { timeout: 10000 });
  await first.reload({ waitUntil: 'domcontentloaded' });
  await first.waitForFunction(() => Boolean(window.__OS__?.locale), { timeout: 30000 });
  if (await first.evaluate(() => window.__OS__.locale.getLocale()) !== 'en') {
    throw new Error('The first tab lost its language setting after reload');
  }
  if (await first.evaluate(() => window.__OS__.device.getPreference('dark_mode')) !== true) {
    throw new Error('The first tab lost its dark-mode setting after reload');
  }

  const second = await context.newPage();
  await ready(second);
  const secondState = await second.evaluate(() => ({
    namespace: window.__STORAGE_ISOLATION__?.namespace,
    locale: window.__OS__.locale.getLocale(),
    darkMode: window.__OS__.device.getPreference('dark_mode'),
  }));
  if (!secondState.namespace || secondState.namespace === firstNamespace) {
    throw new Error('The second tab reused the first tab storage namespace');
  }
  if (secondState.locale !== 'zh-Hans') {
    throw new Error(`The second tab inherited a setting from the first: ${secondState.locale}`);
  }
  if (secondState.darkMode === true) throw new Error('The second tab inherited dark mode from the first');
  console.log(JSON.stringify({ reloadedLocale: 'en', reloadedDarkMode: true, newTabLocale: secondState.locale, newTabDarkMode: secondState.darkMode, separateNamespaces: true }, null, 2));
} finally {
  await context.close();
  await browser.close();
}

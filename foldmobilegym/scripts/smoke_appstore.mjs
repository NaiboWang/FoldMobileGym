import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[2] || 'http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__));
  const registry = await page.evaluate(async () => {
    const { default: pm } = await import('/os/PackageManagerService.ts');
    const { getCatalog, searchCatalog } = await import('/apps/AppStore/catalog.ts');
    const catalog = getCatalog();
    for (const query of ['美团', 'Meituan', 'meituan_waimai']) {
      if (!searchCatalog(catalog, query).some(app => app.id === 'meituan_waimai')) throw Error(`Search failed: ${query}`);
    }
    if (catalog.some(app => ['workspace_docs', 'study_cards', 'food_info', 'video', 'fitness', 'tasks', 'calculator2'].includes(app.id))) throw Error('Excluded app in store');
    return { installed: pm.getInstalledPackages().length, catalog: catalog.length, storeRegistered: pm.isInstalled('appstore') };
  });
  if (!registry.storeRegistered || registry.catalog !== 29) throw Error(JSON.stringify(registry));
  await page.waitForSelector('[data-launcher="true"] button[aria-label="搜索"]');
  await page.click('[data-launcher="true"] button[aria-label="搜索"]');
  await page.type('[data-launcher="true"] input[type="search"]', 'App Store');
  await page.waitForFunction(() => document.querySelector('[data-launcher="true"]')?.innerText.includes('App Store'));
  await page.click('[data-launcher="true"] button[aria-label="关闭搜索"]');
  await page.evaluate(() => window.__OS__.openApp('appstore'));
  const app = '[data-app-id="appstore"]';
  await page.waitForSelector(`${app} .appstore-hero`);
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(p => window.__FOLDAGENT__.setPosture(p), posture);
    await new Promise(resolve => setTimeout(resolve, 400));
    const overflow = await page.$eval(`${app} .appstore-page`, node => node.scrollWidth > node.clientWidth + 1);
    if (overflow) throw Error(`Horizontal overflow: ${posture}`);
  }
  await page.click(`${app} [data-trigger="appstore.tab.apps"]`);
  await page.waitForFunction(() => document.querySelectorAll('[data-app-id="appstore"] .appstore-row').length === 29);
  await page.click(`${app} [data-trigger="appstore.tab.search"]`);
  await page.waitForSelector(`${app} input[type="search"]`);
  await page.type(`${app} input[type="search"]`, '美团');
  await page.click(`${app} [data-trigger="appstore.search.results"]`);
  await page.waitForFunction(() => document.querySelectorAll('[data-app-id="appstore"] .appstore-row').length === 1);
  await page.click(`${app} .appstore-row`);
  await page.waitForSelector(`${app} .appstore-open`);
  await page.click(`${app} [data-trigger="system.back"]`);
  await page.waitForFunction(() => document.querySelector('[data-app-id="appstore"] input')?.value === '美团');
  await page.click(`${app} .appstore-row`);
  await page.waitForSelector(`${app} .appstore-open`);
  await page.click(`${app} .appstore-open`);
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-app-id="meituan_waimai"]');
    return node && node.getBoundingClientRect().width > 0 && !node.querySelector('[data-app-launch-splash]');
  });
  await page.evaluate(() => window.__OS__.openApp('appstore', '/search?q=Quizlet'));
  await page.waitForSelector(`${app} .appstore-empty`);
  await page.evaluate(async () => { const { setLocale } = await import('/os/locale.ts'); setLocale('en'); });
  await page.waitForFunction(() => document.querySelector('[data-app-id="appstore"]')?.innerText.includes('No apps found'));
  await page.evaluate(() => window.__OS__.openApp('appstore', '/search?q=Meituan'));
  await page.waitForFunction(() => document.querySelectorAll('[data-app-id="appstore"] .appstore-row').length === 1);
  await page.evaluate(() => window.__OS__.openApp('appstore', '/app/workspace_docs'));
  await page.waitForFunction(() => document.querySelector('[data-app-id="appstore"]')?.innerText.includes('not in the current catalog'));
  await page.evaluate(async () => { const { setLocale } = await import('/os/locale.ts'); setLocale('zh-Hans'); window.__OS__.closeApp('appstore'); window.__OS__.openApp('appstore'); window.__FOLDAGENT__.setPosture('unfolded'); });
  await page.waitForSelector(`${app} .appstore-hero`);
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(JSON.stringify({ ...registry, search: 'zh/en passed', back: 'passed', openMeituan: 'passed', excludedApps: 'passed', postures: 3, errors }, null, 2));
} finally {
  await browser.close();
}

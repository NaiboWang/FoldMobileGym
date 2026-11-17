/** Verify optional apps are unregistered and absent from launcher search. */
import puppeteer from 'puppeteer';

const removed = [
  ['study_cards', 'Quizlet'],
  ['food_info', 'Yuka'],
  ['video', '本地视频'],
  ['fitness', '运动记录'],
  ['tasks', 'Microsoft To Do'],
  ['calculator2', '计算器2'],
];
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[2] || 'http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__));
  const result = await page.evaluate(async (ids) => {
    const { default: packages } = await import('/os/PackageManagerService.ts');
    const { normalizeLauncherLayout } = await import('/os/launcher/layout.ts');
    const installed = packages.getInstalledPackages();
    const items = Object.fromEntries(ids.map(id => [id, { id, kind: 'app', appId: id }]));
    const cleaned = normalizeLauncherLayout({
      version: 1, grid: { columns: 4, rows: 6 }, items,
      screens: [{ id: 'legacy', placements: ids.map((id, i) => ({
        itemId: id, container: 'workspace', screenId: 'legacy',
        cellX: i, cellY: 0, spanX: 1, spanY: 1,
      })) }],
      hotseat: [], folders: { old: { id: 'old', name: 'Old', items: ids } },
      hiddenApps: ids,
    }, installed);
    return {
      installedCount: installed.length,
      removedStillInstalled: ids.filter(id => packages.isInstalled(id)),
      oldItemsRemaining: Object.keys(cleaned.items),
      oldPlacementsRemaining: cleaned.screens.flatMap(s => s.placements).length,
      oldFolderItemsRemaining: cleaned.folders.old.items,
      oldHiddenAppsRemaining: cleaned.hiddenApps,
      meituanInstalled: packages.isInstalled('meituan_waimai'),
      calculatorInstalled: packages.isInstalled('calculator'),
    };
  }, removed.map(([id]) => id));
  if (result.installedCount !== 31 || result.removedStillInstalled.length ||
      result.oldItemsRemaining.length || result.oldPlacementsRemaining ||
      result.oldFolderItemsRemaining.length || result.oldHiddenAppsRemaining.length ||
      !result.meituanInstalled || !result.calculatorInstalled) throw new Error(JSON.stringify(result));
  await page.waitForSelector('[data-launcher="true"]');
  for (const [, name] of removed) {
    await page.click('[data-launcher="true"] button[aria-label="搜索"]');
    await page.type('[data-launcher="true"] input[type="search"]', name);
    await page.waitForFunction(() => document.querySelector('[data-launcher="true"]')?.innerText.includes('未找到应用'));
    await page.click('[data-launcher="true"] button[aria-label="关闭搜索"]');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ ...result, searchChecksPassed: removed.length }, null, 2));
} finally {
  await browser.close();
}

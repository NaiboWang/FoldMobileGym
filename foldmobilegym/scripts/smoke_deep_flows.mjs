/**
 * Browser smoke for common in-app paths that launch-only checks do not cover.
 * Uses fresh browser contexts. Never taps purchase, checkout, payment, or send.
 *
 *   node scripts/smoke_deep_flows.mjs http://127.0.0.1:3100/
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const flowFilter = process.argv.find((arg) => arg.startsWith('--flow='))?.slice('--flow='.length);
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const issues = [];
let checked = 0;

async function waitForTrigger(page, marker) {
  await page.waitForFunction((id) => [...document.querySelectorAll('[data-trigger]')]
    .some((el) => el.dataset.trigger === id && el.getClientRects().length > 0),
  { timeout: 20000 }, marker);
}

async function clickTrigger(page, marker) {
  await page.evaluate((id) => {
    const el = [...document.querySelectorAll('[data-trigger]')]
      .find((node) => node.dataset.trigger === id && node.getClientRects().length > 0);
    if (!el) throw new Error(`Missing visible trigger: ${id}`);
    el.click();
  }, marker);
}

async function leaveNotesEditorWithSystemBack(page, path) {
  const states = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.evaluate(() => window.__OS__.handleBack());
    await new Promise((resolve) => setTimeout(resolve, 80));
    const state = await page.evaluate(() => ({ route: window.__OS__.getAppRoute('notes'), keyboard: window.__OS__.keyboard.isVisible() }));
    states.push(state);
    if (state.route?.path !== path) return;
  }
  throw new Error(`System back stayed in notes editor: ${JSON.stringify(states)}`);
}

async function runFlow(name, appId, flow, preparePage) {
  if (flowFilter && name !== flowFilter) return;
  checked += 1;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    if (preparePage) await preparePage(page);
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate((id) => window.__OS__.openApp(id), appId);
    await flow(page);
    const appError = await page.evaluate((id) =>
      document.querySelector(`[data-app-id="${id}"]`)?.innerText.includes('应用出现问题') ?? false,
    appId);
    if (appError) throw new Error('App error boundary is visible');
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
  } catch (error) {
    issues.push({ flow: name, appId, issue: String(error?.message ?? error) });
  } finally {
    await context.close();
  }
}

try {
  await runFlow('permission_timeout_closes_stale_dialog', 'wechat', async (page) => {
    let stage = 'request permission';
    try {
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="wechat"]');
      return window.__OS__.getState().activeAppId === 'wechat'
        && app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
    }, { timeout: 30000 });
    await page.evaluate(() => {
      window.__permissionResult = null;
      void window.__OS__.permissions.requestPermissions('wechat', ['android.permission.CAMERA'])
        .then((result) => { window.__permissionResult = result; });
    });
    stage = 'dialog opens';
    await page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some((button) => button.textContent?.trim() === '拒绝'), { timeout: 5000 });
    stage = 'request resolves';
    await page.waitForFunction(() => window.__permissionResult?.['android.permission.CAMERA'] === 'denied',
      { timeout: 5000 });
    stage = 'dialog closes';
    await page.waitForFunction(() => ![...document.querySelectorAll('button')]
      .some((button) => button.textContent?.trim() === '拒绝'), { timeout: 5000 });
    } catch (error) {
      const snapshot = await page.evaluate(() => ({ result: window.__permissionResult,
        buttons: [...document.querySelectorAll('button')].map((button) => button.textContent?.trim()).filter(Boolean).slice(-8) }));
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
  }, async (page) => {
    await page.evaluateOnNewDocument(() => {
      const originalSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) =>
        originalSetTimeout(callback, delay === 60000 ? 1000 : delay, ...args);
    });
  });

  await runFlow('launcher_catalog_no_wps_meituan', 'meituan_waimai', async (page) => {
    await page.evaluate(() => window.__OS__.goHome());
    await page.waitForSelector('[data-launcher="true"] button[aria-label="搜索"]', { timeout: 10000 });
    await page.click('[data-launcher="true"] button[aria-label="搜索"]');
    const search = '[data-launcher="true"] input[placeholder="搜索应用"]';
    await page.waitForSelector(search, { timeout: 10000 });
    await page.type(search, 'WPS');
    await page.waitForFunction(() => document.querySelector('[data-launcher="true"]')?.textContent?.includes('未找到应用'),
      { timeout: 10000 });
    await page.click(search, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(search, '美团');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-launcher="true"] button')]
      .some((button) => button.textContent?.includes('美团')), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-launcher="true"] button')]
      .find((button) => button.textContent?.includes('美团'))?.click());
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="meituan_waimai"]');
      return app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
    }, { timeout: 20000 });
  });

  await runFlow('launcher_wallpaper_apply_reload', 'theme_store', async (page) => {
    let stage = 'read initial wallpaper';
    try {
    const wallpaper = () => page.evaluate(() => {
      const launcher = document.querySelector('[data-launcher="true"]');
      return launcher?.firstElementChild ? getComputedStyle(launcher.firstElementChild).backgroundImage : '';
    });
    await page.evaluate(() => window.__OS__.goHome());
    await page.waitForSelector('[data-launcher="true"]', { timeout: 10000 });
    const initial = await wallpaper();
    if (!initial.includes('url(')) throw new Error(`Initial wallpaper is missing: ${initial}`);
    stage = 'open wallpaper details';
    await page.evaluate(() => window.__OS__.openApp('theme_store', '/item/theme/0132f200-3467-4d4b-b8bd-1bd882145875'));
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="theme_store"] button')]
      .some((button) => button.textContent?.includes('只应用壁纸') && !button.disabled), { timeout: 20000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="theme_store"] button')]
      .find((button) => button.textContent?.includes('只应用壁纸'))?.click());
    stage = 'return to changed wallpaper';
    await page.evaluate(() => window.__OS__.goHome());
    await page.waitForFunction((previous) => {
      const launcher = document.querySelector('[data-launcher="true"]');
      return launcher?.firstElementChild && getComputedStyle(launcher.firstElementChild).backgroundImage !== previous;
    }, { timeout: 10000 }, initial);
    const changed = await wallpaper();
    await page.evaluate(async () => {
      const launcher = document.querySelector('[data-launcher="true"]');
      const background = launcher?.firstElementChild && getComputedStyle(launcher.firstElementChild).backgroundImage;
      const url = background?.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
      if (!url) throw new Error(`Applied wallpaper has no image URL: ${background}`);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth <= 0) throw new Error('Applied wallpaper decoded empty');
    });
    for (const posture of ['unfolded', 'folded']) {
      await page.evaluate((value) => window.__FOLDAGENT__.setPosture(value), posture);
      await page.waitForFunction((expected) => {
        const launcher = document.querySelector('[data-launcher="true"]');
        return launcher?.firstElementChild && getComputedStyle(launcher.firstElementChild).backgroundImage === expected;
      }, { timeout: 10000 }, changed);
    }
    stage = 'wallpaper after reload';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.waitForSelector('[data-launcher="true"]', { timeout: 10000 });
    const reloaded = await wallpaper();
    if (reloaded !== changed) throw new Error(`Wallpaper reverted after reload: ${JSON.stringify({ initial, changed, reloaded })}`);
    } catch (error) {
      const snapshot = await page.evaluate(() => {
        const launcher = document.querySelector('[data-launcher="true"]');
        return {
          activeApp: window.__OS__?.getState()?.activeAppId,
          wallpaper: launcher?.firstElementChild && getComputedStyle(launcher.firstElementChild).backgroundImage,
          storedWallpaper: JSON.parse(localStorage.getItem('foldagent_launcher_layout') || 'null')?.wallpaper,
          themeText: document.querySelector('[data-app-id="theme_store"]')?.innerText?.slice(0, 180),
        };
      }).catch(() => null);
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
  });

  await runFlow('settings_language_choice_reload', 'settings', async (page) => {
    const openPicker = async () => {
      await page.evaluate(() => window.__OS__.openApp('settings', '/page/locale_picker'));
      await page.waitForFunction(() => document.querySelector('[data-app-id="settings"]')?.innerText.includes('English'), { timeout: 20000 });
    };
    const choose = async (label) => page.evaluate((title) => {
      const item = [...document.querySelectorAll('[data-app-id="settings"] div')]
        .find((el) => el.textContent?.trim() === title && el.className?.includes('text-[15px]'));
      if (!item?.parentElement?.parentElement) throw new Error(`Missing language option: ${title}`);
      item.parentElement.parentElement.click();
    }, label);
    await openPicker();
    if (await page.evaluate(() => document.querySelector('[data-app-id="settings"]')?.innerText.includes('中文（繁體）'))) {
      throw new Error('Unsupported Traditional Chinese option is visible');
    }
    await choose('English');
    await page.waitForFunction(() => window.__OS__.locale.getLocale() === 'en', { timeout: 10000 });
    await choose('Simplified Chinese');
    await page.waitForFunction(() => window.__OS__.locale.getLocale() === 'zh-Hans', { timeout: 10000 });
    await choose('English');
    await page.waitForFunction(() => window.__OS__.locale.getLocale() === 'en', { timeout: 10000 });
    const beforeReload = await page.evaluate(() => ({
      locale: window.__OS__.locale.getLocale(),
      stored: JSON.parse(localStorage.getItem('os_state') || 'null')?.state?.settings?.global?.language,
      isolation: window.__STORAGE_ISOLATION__,
      sessionNamespace: sessionStorage.getItem('__MG_STORAGE_NS__'),
    }));
    await page.evaluateOnNewDocument(() => {
      window.__bootStoredLanguage = JSON.parse(localStorage.getItem('os_state') || 'null')?.state?.settings?.global?.language;
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    const afterReload = await page.evaluate(() => ({
      locale: window.__OS__.locale.getLocale(),
      stored: JSON.parse(localStorage.getItem('os_state') || 'null')?.state?.settings?.global?.language,
      bootStored: window.__bootStoredLanguage,
      isolation: window.__STORAGE_ISOLATION__,
      sessionNamespace: sessionStorage.getItem('__MG_STORAGE_NS__'),
    }));
    if (afterReload.locale !== 'en') throw new Error(`English locale did not persist: ${JSON.stringify({ beforeReload, afterReload })}`);
    await openPicker();
  });

  await runFlow('meeting_quick_end_history_reload', 'tencent_meeting', async (page) => {
    let stage = 'initial history';
    try {
    await waitForTrigger(page, 'home.history.open');
    await clickTrigger(page, 'home.history.open');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-trigger="history.detail.open"]')].length > 0,
      { timeout: 10000 });
    const initialHistoryCount = await page.$$eval('[data-trigger="history.detail.open"]', (items) => items.length);
    stage = 'quick meeting';
    await page.evaluate(() => window.__OS__.handleBack());
    await waitForTrigger(page, 'home.quick.open');
    await clickTrigger(page, 'home.quick.open');
    await waitForTrigger(page, 'quick.meeting.open');
    await clickTrigger(page, 'quick.meeting.open');
    stage = 'system back exit dialog';
    await waitForTrigger(page, 'meeting.exit.open');
    await page.evaluate(() => window.__OS__.handleBack());
    await waitForTrigger(page, 'meeting.end');
    stage = 'cancel and reopen exit dialog';
    await page.evaluate(() => window.__OS__.handleBack());
    await waitForTrigger(page, 'meeting.exit.open');
    await clickTrigger(page, 'meeting.exit.open');
    await waitForTrigger(page, 'meeting.end');
    await clickTrigger(page, 'meeting.end');
    stage = 'new history entry';
    await waitForTrigger(page, 'home.history.open');
    await clickTrigger(page, 'home.history.open');
    await page.waitForFunction((count) => document.querySelectorAll('[data-trigger="history.detail.open"]').length > count,
      { timeout: 10000 }, initialHistoryCount);
    const endedHistoryCount = await page.$$eval('[data-trigger="history.detail.open"]', (items) => items.length);
    stage = 'history after reload';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('tencent_meeting'));
    await waitForTrigger(page, 'home.history.open');
    await clickTrigger(page, 'home.history.open');
    await page.waitForFunction((count) => document.querySelectorAll('[data-trigger="history.detail.open"]').length === count,
      { timeout: 10000 }, endedHistoryCount);
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        app: document.querySelector('[data-app-id="tencent_meeting"]')?.innerText?.slice(0, 240),
        triggers: [...document.querySelectorAll('[data-app-id="tencent_meeting"] [data-trigger]')]
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => element.getAttribute('data-trigger')).slice(0, 20),
      })).catch(() => null);
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
  });

  await runFlow('video_english_player_labels', 'video', async (page) => {
    await page.evaluate(() => window.__OS__.locale.setLocale('en'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="video"] .vlist h1')?.textContent?.includes('Local videos'),
      { timeout: 10000 });
    await clickTrigger(page, 'video.asset.open');
    await page.waitForFunction(() => document.querySelector('[data-app-id="video"] .vplayer > p')?.textContent?.includes('Current time')
      && document.querySelector('[data-app-id="video"] [data-action="video.fact.verify"]')?.textContent?.includes('Verify current chapter'),
    { timeout: 10000 });
    await page.click('[data-app-id="video"] [data-action="video.fact.verify"]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="video"] [data-action="video.fact.verify"]')?.textContent?.includes('Chapter verified'),
      { timeout: 10000 });
  });

  await runFlow('video_chapter_fold_reload_back', 'video', async (page) => {
    await waitForTrigger(page, 'video.asset.open');
    await clickTrigger(page, 'video.asset.open');
    await page.waitForSelector('[data-app-id="video"] [data-benchmark-asset-id="foldable_lab_record"]', { timeout: 10000 });
    await page.click('[data-app-id="video"] [data-action="video.chapter.seek"][data-action-params*="145"]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="video"] .vplayer > p')?.textContent?.includes('02:25'),
      { timeout: 10000 });
    await page.click('[data-app-id="video"] [data-action="video.fact.verify"]');
    await page.evaluate(() => window.__FOLDAGENT__.setPosture('folded'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="video"] [data-benchmark-asset-id="foldable_lab_record"]')
      && document.querySelector('[data-app-id="video"] .vplayer > p')?.textContent?.includes('02:25'),
    { timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('video'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="video"] [data-benchmark-asset-id="foldable_lab_record"]')
      && document.querySelector('[data-app-id="video"] .vplayer > p')?.textContent?.includes('02:25')
      && document.querySelector('[data-app-id="video"] [data-action="video.fact.verify"]')?.textContent?.includes('章节已核对'),
    { timeout: 10000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => !document.querySelector('[data-app-id="video"] [data-benchmark-asset-id]'),
      { timeout: 10000 });
  });

  await runFlow('food_info_search_catalog_detail', 'food_info', async (page) => {
    await waitForTrigger(page, 'food.tab.search');
    await clickTrigger(page, 'food.tab.search');
    await page.waitForSelector('[data-app-id="food_info"] input[aria-label="搜索食品"]', { timeout: 10000 });
    await page.type('[data-app-id="food_info"] input[aria-label="搜索食品"]', '6901234567890');
    await page.waitForFunction(() => {
      const results = document.querySelectorAll('[data-app-id="food_info"] .yuka-search-results [data-action="food.catalog.item.open"]');
      return results.length === 1 && results[0].getAttribute('data-action-params')?.includes('oat_nut_bar');
    }, { timeout: 10000 });
    await page.click('[data-app-id="food_info"] .yuka-search-results [data-action="food.catalog.item.open"]');
    await page.waitForSelector('[data-app-id="food_info"] [data-benchmark-product-id="oat_nut_bar"]', { timeout: 10000 });
    await clickTrigger(page, 'food.tab.search');
    await page.waitForSelector('[data-app-id="food_info"] input[aria-label="搜索食品"]', { timeout: 10000 });
    await page.click('[data-app-id="food_info"] input[aria-label="搜索食品"]', { clickCount: 3 });
    await page.type('[data-app-id="food_info"] input[aria-label="搜索食品"]', '不存在的食品');
    await page.waitForFunction(() => document.querySelector('[data-app-id="food_info"] .yuka-search-empty')?.textContent?.includes('未找到'),
      { timeout: 10000 });
  });

  await runFlow('food_info_scan_verify_back_reload', 'food_info', async (page) => {
    await waitForTrigger(page, 'food.tab.scan');
    await clickTrigger(page, 'food.tab.scan');
    await page.waitForSelector('[data-app-id="food_info"] [data-action="food.scan.sample.submit"]', { timeout: 10000 });
    await page.click('[data-app-id="food_info"] [data-action="food.scan.sample.submit"]');
    await page.waitForSelector('[data-app-id="food_info"] [data-benchmark-product-id="plain_low_sugar_yogurt"]', { timeout: 10000 });
    await page.click('[data-app-id="food_info"] [data-action="food.analysis.item.verify"]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="food_info"] [data-action="food.analysis.item.verify"]')?.textContent?.includes('完整分析已核对'),
      { timeout: 10000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => !document.querySelector('[data-app-id="food_info"] [data-benchmark-product-id]'),
      { timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('food_info'));
    await page.waitForSelector('[data-app-id="food_info"] [data-action="food.catalog.item.open"][data-action-params*="plain_low_sugar_yogurt"]', { timeout: 10000 });
    await page.click('[data-app-id="food_info"] [data-action="food.catalog.item.open"][data-action-params*="plain_low_sugar_yogurt"]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="food_info"] [data-action="food.analysis.item.verify"]')?.textContent?.includes('完整分析已核对'),
      { timeout: 10000 });
  });

  await runFlow('fitness_english_detail_labels', 'fitness', async (page) => {
    await page.evaluate(() => window.__OS__.locale.setLocale('en'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="fitness"] .flist h1')?.textContent?.includes('Activity history'),
      { timeout: 10000 });
    await clickTrigger(page, 'fitness.activity.open');
    await page.waitForFunction(() => {
      const detail = document.querySelector('[data-app-id="fitness"] .fdetail');
      return detail?.textContent?.includes('Imported offline activity')
        && detail?.textContent?.includes('Average pace')
        && detail?.textContent?.includes('Verify activity data');
    }, { timeout: 10000 });
    await page.click('[data-app-id="fitness"] [data-action="fitness.fact.verify"]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="fitness"] [data-action="fitness.fact.verify"]')?.textContent?.includes('Data verified'),
      { timeout: 10000 });
  });

  await runFlow('fitness_activity_verify_back_reload', 'fitness', async (page) => {
    await waitForTrigger(page, 'fitness.activity.open');
    await clickTrigger(page, 'fitness.activity.open');
    await page.waitForSelector('[data-app-id="fitness"] [data-benchmark-activity-id]', { timeout: 10000 });
    const activityId = await page.$eval('[data-app-id="fitness"] [data-benchmark-activity-id]', (el) => el.dataset.benchmarkActivityId);
    await page.click('[data-app-id="fitness"] [data-action="fitness.fact.verify"]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="fitness"] [data-action="fitness.fact.verify"]')?.textContent?.includes('数据已核对'),
      { timeout: 10000 });
    await page.click('[data-app-id="fitness"] .fitness-back');
    await page.waitForFunction(() => !document.querySelector('[data-app-id="fitness"] [data-benchmark-activity-id]'),
      { timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('fitness'));
    await waitForTrigger(page, 'fitness.activity.open');
    await page.evaluate((id) => {
      const button = [...document.querySelectorAll('[data-app-id="fitness"] [data-trigger="fitness.activity.open"]')]
        .find((el) => JSON.parse(el.getAttribute('data-trigger-params') || '{}').id === id);
      if (!button) throw new Error(`Activity ${id} is missing after reload`);
      button.click();
    }, activityId);
    await page.waitForFunction((id) => document.querySelector(`[data-app-id="fitness"] [data-benchmark-activity-id="${id}"] [data-action="fitness.fact.verify"]`)?.textContent?.includes('数据已核对'),
      { timeout: 10000 }, activityId);
  });

  await runFlow('weather_city_forecast_reload', 'weather', async (page) => {
    await waitForTrigger(page, 'cities.open');
    await clickTrigger(page, 'cities.open');
    await page.waitForSelector('[data-app-id="weather"] #recycler_view_manager button[aria-label="北京市"]', { timeout: 20000 });
    await page.click('[data-app-id="weather"] #recycler_view_manager button[aria-label="北京市"]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="weather"] #activity_main_city_name2')?.textContent?.includes('北京'),
      { timeout: 20000 });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('[data-app-id="weather"] [data-trigger="forecast.daily.open"]')]
        .find((el) => JSON.parse(el.getAttribute('data-trigger-params') || '{}').cityId === 'beijing');
      if (!button) throw new Error('Beijing forecast button is missing');
      button.click();
    });
    await page.waitForFunction(() => document.querySelector('[data-app-id="weather"] [data-scroll-container="forecast"]'),
      { timeout: 20000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await waitForTrigger(page, 'cities.open');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('weather'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="weather"] #activity_main_city_name2')?.textContent?.includes('北京'),
      { timeout: 20000 });
  });

  await runFlow('reddit_post_comments_open_sort_back', 'reddit', async (page) => {
    await page.waitForFunction(() => [...document.querySelectorAll('[data-trigger="post.comments.open"]')]
      .some((el) => Number(el.textContent?.trim()) > 0),
    { timeout: 15000 });
    const postButton = await page.evaluateHandle(() => [...document.querySelectorAll('[data-trigger="post.comments.open"]')]
      .find((el) => Number(el.textContent?.trim()) > 0));
    if (!(await postButton.asElement())) throw new Error('Fixture comment button is missing');
    const title = await page.evaluate((button) => button.closest('.bg-app-surface.mb-2')?.querySelector('h3')?.textContent,
      postButton);
    if (!title) throw new Error('Fixture post title is missing');
    await postButton.asElement().click();
    await page.waitForFunction((expected) => {
      const app = document.querySelector('[data-app-id="reddit"]');
      const heading = [...(app?.querySelectorAll('.font-extrabold') || [])].find((el) => el.textContent === expected);
      return Boolean(heading && app?.querySelector('[data-comment-id]'));
    }, { timeout: 15000 }, title);
    const originalCount = await page.$$eval('[data-app-id="reddit"] [data-comment-id]', (items) => items.length);
    await page.click('[data-app-id="reddit"] button[aria-label="Sort comments"]');
    await page.waitForSelector('[data-app-id="reddit"] [role="dialog"]', { timeout: 10000 });
    await page.click('[data-app-id="reddit"] [data-action="postComments.sort.select.new"]');
    await page.waitForFunction(() => !document.querySelector('[data-app-id="reddit"] [role="dialog"]'),
      { timeout: 10000 });
    const sortedCount = await page.$$eval('[data-app-id="reddit"] [data-comment-id]', (items) => items.length);
    if (sortedCount !== originalCount || sortedCount === 0) {
      throw new Error(`Comments changed after sort: ${originalCount} -> ${sortedCount}`);
    }
    await page.click('[data-app-id="reddit"] button[aria-label="Close"]');
    await waitForTrigger(page, 'post.comments.open');
  });

  await runFlow('reddit_post_types_offline_media', 'reddit', async (page) => {
    const samples = [
      { id: 'post_1rfdbcx', title: 'People who have tried Padel recently', hasImage: false },
      { id: 'post_1rf5glo', title: 'Monkey grosses out by century egg', hasImage: true },
    ];
    for (const sample of samples) {
      await page.evaluate((id) => window.__OS__.openApp('reddit', `/post/${id}`), sample.id);
      await page.waitForFunction((expected) => {
        const detail = document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
          ?.closest('div.flex.flex-col.h-full.bg-app-surface');
        return Boolean(detail && [...detail.querySelectorAll('.font-extrabold')]
          .some((el) => el.textContent?.includes(expected)));
      }, { timeout: 20000 }, sample.title);
      if (sample.hasImage) {
        await page.waitForFunction(() => document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
          ?.closest('div.flex.flex-col.h-full.bg-app-surface')?.querySelector('[data-post-image-unavailable]'),
        { timeout: 20000 });
        await page.evaluate(() => {
          const detail = document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
            ?.closest('div.flex.flex-col.h-full.bg-app-surface');
          const retry = detail?.querySelector('[data-post-image-unavailable] button');
          if (!retry) throw new Error('Offline image has no retry action');
          retry.click();
        });
        await page.waitForFunction(() => document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
          ?.closest('div.flex.flex-col.h-full.bg-app-surface')?.querySelector('[data-post-image-unavailable][data-retry-attempt="1"] button'),
        { timeout: 20000 });
      } else if (await page.evaluate(() => Boolean(document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
        ?.closest('div.flex.flex-col.h-full.bg-app-surface')?.querySelector('[data-post-image-unavailable]')))) {
        throw new Error('Text-only post rendered an image placeholder');
      }
      if (await page.$eval('[data-app-id="reddit"]', (app) => app.innerText.includes('应用出现问题'))) {
        throw new Error(`Post detail crashed: ${sample.id}`);
      }
    }
  }, async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (/^https?:\/\/(?:external-preview|preview|i)\.redd\.it\//.test(request.url())) {
        request.abort();
      } else {
        request.continue();
      }
    });
  });

  await runFlow('reddit_post_image_hung_request', 'reddit', async (page) => {
    await page.evaluate(() => window.__OS__.openApp('reddit', '/post/post_1rf5glo'));
    await page.waitForFunction(() => {
      const detail = document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
        ?.closest('div.flex.flex-col.h-full.bg-app-surface');
      return Boolean(detail?.querySelector('img[src*="redd.it"]'));
    }, { timeout: 20000 });
    await page.evaluate(() => {
      const detail = document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
        ?.closest('div.flex.flex-col.h-full.bg-app-surface');
      detail?.querySelector('img[src*="redd.it"]')?.scrollIntoView();
    });
    await page.waitForFunction(() => {
      const detail = document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
        ?.closest('div.flex.flex-col.h-full.bg-app-surface');
      return Boolean(detail?.querySelector('[data-post-image-unavailable] button'));
    }, { timeout: 18000 });
    const fallback = await page.evaluate(() => {
      const detail = document.querySelector('[data-app-id="reddit"] button[aria-label="Close"]')
        ?.closest('div.flex.flex-col.h-full.bg-app-surface');
      return detail?.querySelector('[data-post-image-unavailable]')?.textContent ?? '';
    });
    if (!fallback || fallback.includes('应用出现问题')) throw new Error(`Hung image fallback is invalid: ${fallback}`);
  }, async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (/^https?:\/\/(?:external-preview|preview|i)\.redd\.it\//.test(request.url())) return;
      request.continue();
    });
  });

  await runFlow('sms_compose_contact_picker_back_without_send', 'sms', async (page) => {
    let stage = 'open compose';
    try {
    await waitForTrigger(page, 'compose.open');
    const initialCount = await page.$$eval('[data-app-id="sms"] [data-trigger="conversation.open"]', (items) => items.length);
    await clickTrigger(page, 'compose.open');
    stage = 'toggle contact picker';
    await page.waitForSelector('[data-app-id="sms"] button[aria-label="选择联系人"]', { timeout: 10000 });
    await page.click('[data-app-id="sms"] button[aria-label="选择联系人"]');
    await page.waitForSelector('[data-app-id="sms"] button[aria-label="取消"]', { timeout: 10000 });
    await page.click('[data-app-id="sms"] button[aria-label="取消"]');
    await page.waitForSelector('[data-app-id="sms"] input[placeholder="短信"]', { timeout: 10000 });
    stage = 'type draft and close keyboard';
    await page.type('[data-app-id="sms"] input[placeholder="短信"]', '稳定性测试草稿');
    if (!await page.evaluate(() => window.__OS__.keyboard.isVisible())) {
      throw new Error('SMS keyboard did not open for message draft');
    }
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => !window.__OS__.keyboard.isVisible(), { timeout: 5000 });
    // BackDispatcher deliberately de-duplicates back presses within one animation frame.
    await new Promise((resolve) => setTimeout(resolve, 80));
    stage = 'return to conversation list';
    await page.evaluate(() => window.__OS__.handleBack());
    await waitForTrigger(page, 'compose.open');
    const finalCount = await page.$$eval('[data-app-id="sms"] [data-trigger="conversation.open"]', (items) => items.length);
    if (finalCount !== initialCount) throw new Error(`SMS conversation count changed without sending: ${initialCount} -> ${finalCount}`);
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        route: window.__OS__?.getAppRoute('sms'),
        keyboard: window.__OS__?.keyboard.isVisible(),
        text: document.querySelector('[data-app-id="sms"]')?.innerText.slice(0, 180),
      }));
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
  });

  await runFlow('calculator_decimal_input_and_recovery', 'calculator', async (page) => {
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="calculator"] button')]
      .some((button) => button.textContent?.trim() === 'AC'), { timeout: 20000 });
    const press = async (label) => page.evaluate((value) => {
      const button = [...document.querySelectorAll('[data-app-id="calculator"] button')]
        .find((element) => element.textContent?.trim() === value);
      if (!button) throw new Error(`Calculator button missing: ${value}`);
      button.click();
    }, label);
    const display = () => page.$eval('[data-app-id="calculator"] .font-light.whitespace-nowrap', (element) => element.textContent?.trim());
    await press('AC');
    await press('.');
    if (await display() !== '0.') throw new Error(`Leading decimal is malformed: ${await display()}`);
    await press('5');
    await press('+');
    await press('.');
    await press('5');
    await press('=');
    if (await display() !== '1') throw new Error(`0.5 + 0.5 produced ${await display()}`);
    await press('AC');
    for (const label of ['1', '.', '.', '2', '+', '3', '=']) await press(label);
    if (await display() !== '4.2') throw new Error(`Repeated decimal produced ${await display()}`);
    await press('AC');
    for (const label of ['1', '÷', '0', '=']) await press(label);
    if (await display() !== 'Error') throw new Error('Division by zero did not show Error');
    await press('AC');
    if (await display() !== '0') throw new Error('AC did not recover after arithmetic error');
  });

  await runFlow('calculator2_arithmetic_scientific_panel', 'calculator2', async (page) => {
    let stage = 'arithmetic';
    try {
    await page.waitForSelector('[data-app-id="calculator2"] [data-action="calc.digit.7"]', { timeout: 20000 });
    const press = async (action) => page.$eval(`[data-app-id="calculator2"] [data-action="${action}"]`, (button) => button.click());
    for (const action of ['calc.digit.7', 'calc.operator.add', 'calc.digit.8', 'calc.result.evaluate']) await press(action);
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="calculator2"]');
      const display = app?.querySelector('div[style*="box-shadow"]');
      return [...(display?.children || [])].some((row) => row.textContent?.trim() === '15');
    }, { timeout: 10000 });
    stage = 'swipe to scientific panel';
    const bounds = await page.$eval('[data-app-id="calculator2"] [data-scroll-container="calculator_pads"]', (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, height: rect.height };
    });
    const y = bounds.top + bounds.height * 0.55;
    await page.mouse.move(bounds.right - 25, y);
    await page.mouse.down();
    await page.mouse.move(bounds.left + 25, y, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__OS__.getAppRoute('calculator2')?.path.includes('panel=advanced'), { timeout: 10000 });
    stage = 'scientific panel content';
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="calculator2"] [data-action="calc.function.sin"]')]
      .some((element) => element.getClientRects().length > 0), { timeout: 10000 });
    stage = 'swipe back to basic panel';
    await page.mouse.move(bounds.left + 25, y);
    await page.mouse.down();
    await page.mouse.move(bounds.right - 25, y, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__OS__.getAppRoute('calculator2')?.path === '/', { timeout: 10000 });
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        route: window.__OS__?.getAppRoute('calculator2'),
        text: document.querySelector('[data-app-id="calculator2"]')?.innerText.slice(0, 160),
      }));
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
  });

  await runFlow('compass_level_menu_pages_back', 'compass', async (page) => {
    await waitForTrigger(page, 'tab.level');
    await clickTrigger(page, 'tab.level');
    await page.waitForFunction(() => window.__OS__.getAppRoute('compass')?.path === '/level', { timeout: 10000 });
    await clickTrigger(page, 'menu.open.level');
    await waitForTrigger(page, 'permissions.open');
    await clickTrigger(page, 'permissions.open');
    await page.waitForFunction(() => window.__OS__.getAppRoute('compass')?.path === '/permissions', { timeout: 10000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => window.__OS__.getAppRoute('compass')?.path === '/level', { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await clickTrigger(page, 'menu.open.level');
    await waitForTrigger(page, 'privacy.open');
    await clickTrigger(page, 'privacy.open');
    await page.waitForFunction(() => window.__OS__.getAppRoute('compass')?.path === '/privacy', { timeout: 10000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => window.__OS__.getAppRoute('compass')?.path === '/level', { timeout: 10000 });
    await clickTrigger(page, 'tab.compass');
    await page.waitForFunction(() => window.__OS__.getAppRoute('compass')?.path === '/', { timeout: 10000 });
  });

  await runFlow('answer_sheet_fill_submit_reload_modify', 'answer_sheet', async (page) => {
    let stage = 'fill choice and count';
    try {
    await page.waitForSelector('[data-app-id="answer_sheet"] [data-scroll-container="sheet-form"]', { timeout: 20000 });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('[data-app-id="answer_sheet"] button')]
        .find((element) => element.textContent?.trim() === '北京');
      if (!button) throw new Error('Answer Sheet choice option missing');
      button.click();
    });
    await page.type('[data-app-id="answer_sheet"] input[placeholder="请填写整数"]', '3');
    stage = 'close keyboard after count';
    await page.waitForFunction(() => window.__OS__.keyboard.isVisible(), { timeout: 3000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => !window.__OS__.keyboard.isVisible(), { timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    stage = 'add repeatable date';
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="answer_sheet"] button')]
      .find((element) => element.textContent?.includes('添加一项'))?.click());
    await page.waitForSelector('[data-app-id="answer_sheet"] input[placeholder="如：周一"]', { timeout: 10000 });
    await page.type('[data-app-id="answer_sheet"] input[placeholder="如：周一"]', '周一');
    stage = 'close keyboard after date';
    await page.waitForFunction(() => window.__OS__.keyboard.isVisible(), { timeout: 3000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => !window.__OS__.keyboard.isVisible(), { timeout: 5000 });
    stage = 'submit';
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="answer_sheet"] button')]
      .find((element) => element.textContent?.trim() === '提交答案')?.click());
    await page.waitForFunction(() => document.querySelector('[data-app-id="answer_sheet"]')?.innerText.includes('答案已提交'), { timeout: 10000 });
    const formIsReadOnly = () => page.$eval('[data-app-id="answer_sheet"] [data-scroll-container="sheet-form"]', (form) => {
      const controls = [...form.querySelectorAll('input, select, button')];
      return controls.length > 0 && controls.every((control) => control.disabled);
    });
    if (!await formIsReadOnly()) throw new Error('Submitted answers remained editable');
    stage = 'reload persisted answer';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('answer_sheet'));
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="answer_sheet"]');
      return app?.innerText.includes('答案已提交')
        && app.querySelector('input[placeholder="请填写整数"]')?.value === '3'
        && app.querySelector('input[placeholder="如：周一"]')?.value === '周一';
    }, { timeout: 15000 });
    if (!await formIsReadOnly()) throw new Error('Submitted answers became editable after reload');
    stage = 'modify';
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="answer_sheet"] button')]
      .find((element) => element.textContent?.trim() === '修改答案')?.click());
    await page.waitForFunction(() => document.querySelector('[data-app-id="answer_sheet"]')?.innerText.includes('提交答案')
      && !document.querySelector('[data-app-id="answer_sheet"]')?.innerText.includes('答案已提交'), { timeout: 10000 });
    if (await formIsReadOnly()) throw new Error('Modify did not unlock the answer form');
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        keyboard: window.__OS__?.keyboard.isVisible(),
        route: window.__OS__?.getAppRoute('answer_sheet'),
        text: document.querySelector('[data-app-id="answer_sheet"]')?.innerText.slice(0, 200),
      }));
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
  });

  await runFlow('browser_home_back_never_blank', 'browser', async (page) => {
    const clickBottom = async (index) => page.evaluate((buttonIndex) => {
      const bar = document.querySelector('[data-app-id="browser"] div[class*="border-t border-slate-100 px-6"]');
      const button = bar?.querySelectorAll(':scope > button')[buttonIndex];
      if (!button) throw new Error(`Browser bottom button ${buttonIndex} is missing`);
      button.click();
    }, index);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .some((el) => el.textContent?.includes('科研楼停电通知')), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.textContent?.includes('科研楼停电通知'))?.click());
    await page.waitForSelector('[data-benchmark-page="local_power_notice"]', { timeout: 10000 });
    await clickBottom(3);
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.textContent?.includes('新标签页'))?.click());
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .some((el) => el.textContent?.includes('青禾打印店')), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.textContent?.includes('青禾打印店'))?.click());
    await page.waitForSelector('[data-benchmark-page="qinghe_print"]', { timeout: 10000 });
    await clickBottom(3);
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] .grid > div')]
      .find((el) => el.textContent?.includes('local_power_notice'))?.click());
    await page.waitForSelector('[data-benchmark-page="local_power_notice"]', { timeout: 10000 });
    await clickBottom(2);
    await page.waitForFunction(() => document.querySelector('[data-app-id="browser"]')?.innerText.includes('科研楼停电通知'),
      { timeout: 10000 });
    await clickBottom(0);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const backState = await page.evaluate(() => {
      const app = document.querySelector('[data-app-id="browser"]');
      return {
        route: window.__OS__.getAppRoute('browser')?.path,
        hasHome: app?.innerText.includes('科研楼停电通知'),
        blankSpinner: Boolean(app?.querySelector('.animate-spin')) && !app?.querySelector('[data-benchmark-page]'),
      };
    });
    if (backState.route !== '/' || !backState.hasHome || backState.blankSpinner) {
      throw new Error(`Browser back showed an invalid page: ${JSON.stringify(backState)}`);
    }
  });

  await runFlow('contacts_new_contact_keyboard_reload', 'contacts', async (page) => {
    let stage = 'open contacts tab';
    try {
    await waitForTrigger(page, 'tab.contacts');
    await clickTrigger(page, 'tab.contacts');
    stage = 'open new contact';
    await waitForTrigger(page, 'contact.new.open');
    await clickTrigger(page, 'contact.new.open');
    stage = 'fill form';
    await page.waitForSelector('[data-app-id="contacts"] input[placeholder="姓名"]', { timeout: 10000 });
    await page.type('[data-app-id="contacts"] input[placeholder="姓名"]', '稳定性巡检联系人');
    await page.type('[data-app-id="contacts"] input[placeholder="电话"]', '13900001111');
    await page.waitForFunction(() => window.__OS__.keyboard.isVisible(), { timeout: 3000 });
    stage = 'save contact';
    await page.click('[data-app-id="contacts"] button[aria-label="保存联系人"]');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="contacts"] button')]
      .some((button) => button.textContent?.trim() === '稳定性巡检联系人'), { timeout: 10000 });
    if (await page.$('[data-app-id="contacts"] input[placeholder="姓名"]')) {
      throw new Error('Contact editor remained open after saving');
    }
    stage = 'reload';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('contacts'));
    await waitForTrigger(page, 'tab.contacts');
    await clickTrigger(page, 'tab.contacts');
    stage = 'find persisted contact';
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="contacts"] button')]
      .some((button) => button.textContent?.trim() === '稳定性巡检联系人'), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="contacts"] button')]
      .find((button) => button.textContent?.trim() === '稳定性巡检联系人')?.click());
    stage = 'detail phone';
    await page.waitForFunction(() => document.querySelector('[data-app-id="contacts"] [data-benchmark-source-id]')
      ?.textContent?.includes('13900001111'), { timeout: 10000 });
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        route: window.__OS__?.getAppRoute('contacts'),
        keyboard: window.__OS__?.keyboard?.isVisible(),
        text: document.querySelector('[data-app-id="contacts"]')?.innerText.slice(0, 700),
        stored: (localStorage.getItem('provider_contacts') || '').includes('稳定性巡检联系人'),
        contactButtons: [...document.querySelectorAll('[data-app-id="contacts"] button')]
          .filter((button) => button.textContent?.includes('稳定性巡检')).map((button) => button.textContent),
      }));
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
  });

  let stationRequestFailedOnce = false;
  await runFlow('railway_station_list_retry_after_failure', 'railway12306', async (page) => {
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-app-id="railway12306"]')?.innerText || '';
      return text.includes('应用出现问题') && text.includes('HTTP 503') && text.includes('stationList');
    },
      { timeout: 20000 });
    if (!stationRequestFailedOnce) throw new Error('Station list request was not intercepted');
    await page.evaluate(() => document.querySelector('[data-app-id="railway12306"] button')?.click());
    await waitForTrigger(page, 'home.stationSelect.to');
    await clickTrigger(page, 'home.stationSelect.to');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="railway12306"] button')]
      .some((el) => el.textContent?.includes('北京')), { timeout: 15000 });
  }, async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (!stationRequestFailedOnce && /stationList(?:-[^/]+)?\.json(?:\?|$)/.test(request.url())) {
        stationRequestFailedOnce = true;
        void request.respond({ status: 503, contentType: 'application/json', body: '{}' });
      } else {
        void request.continue();
      }
    });
  });

  {
    let heldQueryRequests = 0;
    await runFlow('railway_transfer_gateway_timeout', 'railway12306', async (page) => {
    await waitForTrigger(page, 'home.stationSelect.to');
    await clickTrigger(page, 'home.stationSelect.to');
    const stationInput = '[data-app-id="railway12306"] input[placeholder^="请输入"]';
    await page.waitForSelector(stationInput, { timeout: 10000 });
    await page.type(stationInput, '杭州');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="railway12306"] span')]
      .some((el) => el.textContent === '杭州' && el.parentElement?.classList.contains('cursor-pointer')),
    { timeout: 15000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="railway12306"] span')]
      .find((el) => el.textContent === '杭州' && el.parentElement?.classList.contains('cursor-pointer'))?.parentElement.click());
    await waitForTrigger(page, 'home.queryResult');
    await clickTrigger(page, 'home.queryResult');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="railway12306"] div[class*="mx-3 mt-1.5 rounded-lg"]')]
      .some((el) => /[GDKTZ]\d{1,4}/.test(el.textContent || '')), { timeout: 30000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="railway12306"] button')]
      .find((el) => el.textContent?.trim() === '中转')?.click());
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="railway12306"]');
      const tab = [...(app?.querySelectorAll('button') ?? [])].find((el) => el.textContent?.trim() === '中转');
      return tab?.classList.contains('text-app-primary') && app?.innerText.includes('查询中...');
    }, { timeout: 10000 });
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="railway12306"]');
      return app && !app.innerText.includes('查询中...')
        && app.innerText.includes('网络暂不可用')
        && Boolean(app.querySelector('[data-railway-query-retry]'));
    }, { timeout: 16000 });
    if (heldQueryRequests === 0) throw new Error('Railway query gateway hang was not exercised');
    await page.click('[data-app-id="railway12306"] [data-railway-query-retry]');
    await page.waitForFunction(() => document.querySelector('[data-app-id="railway12306"]')?.innerText.includes('查询中...'),
      { timeout: 5000 });
  }, async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/api/gw/fetch')) {
        if (request.postData()?.includes('kyfw.12306.cn')) heldQueryRequests += 1;
        return;
      }
      void request.continue();
    });
  });
  }

  await runFlow('railway_station_search_direct_transfer', 'railway12306', async (page) => {
    await waitForTrigger(page, 'home.stationSelect.to');
    await clickTrigger(page, 'home.stationSelect.to');
    const stationInput = '[data-app-id="railway12306"] input[placeholder^="请输入"]';
    await page.waitForSelector(stationInput, { timeout: 10000 });
    await page.type(stationInput, '杭州');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="railway12306"] span')]
      .some((el) => el.textContent === '杭州' && el.parentElement?.classList.contains('cursor-pointer')),
    { timeout: 15000 });
    const city = await page.evaluateHandle(() => [...document.querySelectorAll('[data-app-id="railway12306"] span')]
      .find((el) => el.textContent === '杭州' && el.parentElement?.classList.contains('cursor-pointer'))?.parentElement);
    if (!(await city.asElement())) throw new Error('Hangzhou station result is missing');
    await city.asElement().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-trigger="home.stationSelect.to"] span')]
      .some((el) => el.textContent === '杭州'), { timeout: 10000 });
    // Home is retained while the picker closes; require its actual visible return.
    await waitForTrigger(page, 'home.queryResult');
    await clickTrigger(page, 'home.queryResult');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="railway12306"] div[class*="mx-3 mt-1.5 rounded-lg"]')]
      .some((el) => /[GDKTZ]\d{1,4}/.test(el.textContent || '')), { timeout: 30000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="railway12306"] button')]
      .find((el) => el.textContent?.trim() === '中转')?.click());
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="railway12306"]');
      const tab = [...(app?.querySelectorAll('button') ?? [])].find((el) => el.textContent?.trim() === '中转');
      return tab?.classList.contains('text-app-primary') && app?.innerText.includes('查询中...');
    }, { timeout: 10000 });
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="railway12306"]');
      return app && !app.innerText.includes('查询中...')
        && (app.innerText.includes('中转换乘') || app.innerText.includes('方案')
          || (app.innerText.includes('网络暂不可用') && Boolean(app.querySelector('[data-railway-query-retry]'))));
    }, { timeout: 30000 });
    await page.evaluate(() => window.__OS__.handleBack());
    await waitForTrigger(page, 'home.queryResult');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('railway12306'));
    await page.waitForFunction(() => [...document.querySelectorAll('[data-trigger="home.stationSelect.to"] span')]
      .some((el) => el.textContent === '杭州'), { timeout: 10000 });
  });

  await runFlow('browser_local_pages_tabs', 'browser', async (page) => {
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .some((el) => el.textContent?.includes('科研楼停电通知')), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.textContent?.includes('科研楼停电通知'))?.click());
    await page.waitForSelector('[data-benchmark-page="local_power_notice"]', { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.querySelector('span')?.textContent === '1')?.click());
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .some((el) => el.textContent?.includes('新标签页')), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.textContent?.includes('新标签页'))?.click());
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .some((el) => el.textContent?.includes('青禾打印店')), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.textContent?.includes('青禾打印店'))?.click());
    await page.waitForSelector('[data-benchmark-page="qinghe_print"]', { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] button')]
      .find((el) => el.querySelector('span')?.textContent === '2')?.click());
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="browser"] .grid > div')]
      .some((el) => el.textContent?.includes('local_power_notice')), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('[data-app-id="browser"] .grid > div')]
      .find((el) => el.textContent?.includes('local_power_notice'))?.click());
    await page.waitForSelector('[data-benchmark-page="local_power_notice"]', { timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('browser'));
    await page.waitForSelector('[data-benchmark-page="local_power_notice"]',
      { timeout: 10000 });
  });

  await runFlow('clock_alarm_note_save_with_keyboard_open', 'clock', async (page) => {
    await page.waitForFunction(() => document.querySelector('[data-app-id="clock"]')?.innerText.includes('闹钟'),
      { timeout: 10000 });
    const addButton = await page.evaluateHandle(() => [...document.querySelectorAll('[data-app-id="clock"] button')]
      .find((button) => button.classList.contains('rounded-full') && button.classList.contains('absolute')));
    if (!(await addButton.asElement())) throw new Error('Add alarm button is missing');
    await addButton.asElement().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="clock"] span')]
      .some((el) => el.textContent === '添加闹钟'), { timeout: 10000 });
    const noteInput = '[data-app-id="clock"] input[placeholder="输入内容"]';
    await page.waitForSelector(noteInput, { timeout: 10000 });
    await page.click(noteInput);
    await page.type(noteInput, '稳定性巡检闹钟');
    await page.waitForFunction(() => window.__OS__.keyboard.isVisible(), { timeout: 3000 });
    const saveButton = await page.evaluateHandle(() => {
      const title = [...document.querySelectorAll('[data-app-id="clock"] span')]
        .find((el) => el.textContent === '添加闹钟');
      return title?.parentElement?.parentElement?.querySelector('button:last-child');
    });
    if (!(await saveButton.asElement())) throw new Error('Save alarm button is missing');
    await saveButton.asElement().click();
    await page.waitForFunction(() => document.querySelector('[data-app-id="clock"]')?.innerText.includes('稳定性巡检闹钟')
      && ![...document.querySelectorAll('[data-app-id="clock"] span')].some((el) => el.textContent === '添加闹钟'),
    { timeout: 5000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('clock'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="clock"]')?.innerText.includes('稳定性巡检闹钟'),
      { timeout: 10000 });
  });

  await runFlow('ebay_search_product_cart', 'ebay', async (page) => {
    await waitForTrigger(page, 'home.search.open');
    await clickTrigger(page, 'home.search.open');
    await page.waitForSelector('[data-app-id="ebay"] input[type="text"]', { timeout: 10000 });
    await page.type('[data-app-id="ebay"] input[type="text"]', '手机');
    await page.keyboard.press('Enter');
    await waitForTrigger(page, 'search.item.open');
    await clickTrigger(page, 'search.item.open');
    await page.waitForSelector('[data-action="item.cart.add"]', { timeout: 10000 });
    const item = await page.evaluate(() => {
      const button = document.querySelector('[data-action="item.cart.add"]');
      const id = JSON.parse(button?.getAttribute('data-action-params') || '{}').productId;
      const image = document.querySelector('[data-scroll-container="item_detail"] img');
      return { id, src: image?.currentSrc };
    });
    if (!item.id || !item.src) throw new Error('Product identifier or image is missing');
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-scroll-container="item_detail"] img');
      return image?.complete && image.naturalWidth > 0;
    }, { timeout: 15000 });
    await page.evaluate(() => document.querySelector('[data-action="item.cart.add"]')?.click());
    await clickTrigger(page, 'system.back');
    await waitForTrigger(page, 'search.item.open');
    await waitForTrigger(page, 'cart.open');
    await clickTrigger(page, 'cart.open');
    await page.waitForFunction((id) => [...document.querySelectorAll('[data-trigger="cart.item.open"]')]
      .some((el) => JSON.parse(el.getAttribute('data-trigger-params') || '{}').id === id),
    { timeout: 10000 }, item.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('ebay'));
    await waitForTrigger(page, 'cart.open');
    await clickTrigger(page, 'cart.open');
    await page.waitForFunction((id) => [...document.querySelectorAll('[data-trigger="cart.item.open"]')]
      .some((el) => JSON.parse(el.getAttribute('data-trigger-params') || '{}').id === id),
    { timeout: 10000 }, item.id);
    await clickTrigger(page, 'cart.item.open');
    await page.waitForSelector('[data-action="item.cart.add"]', { timeout: 10000 });
  });

  await runFlow('taobao_product_cart_quantity', 'taobao', async (page) => {
    await waitForTrigger(page, 'taobao.product.open');
    await clickTrigger(page, 'taobao.product.open');
    await page.waitForSelector('.tb-detail-info h1', { timeout: 10000 });
    const title = await page.$eval('.tb-detail-info h1', (el) => el.textContent);
    await page.waitForFunction(() => {
      const image = document.querySelector('.tb-detail-media img');
      return image?.complete && image.naturalWidth > 0;
    }, { timeout: 10000 });
    await page.evaluate(() => document.querySelector('[data-trigger="taobao.item.sku.open"]')?.click());
    await page.waitForSelector('.tb-sku-sheet [data-action="taobao.item.cart.submit"]', { timeout: 10000 });
    await page.evaluate(() => document.querySelector('.tb-sku-sheet [data-action="taobao.item.cart.submit"]')?.click());
    await page.evaluate(() => document.querySelector('.tb-detail-header button')?.click());
    await waitForTrigger(page, 'taobao.tab.cart');
    await clickTrigger(page, 'taobao.tab.cart');
    await page.waitForFunction((name) => [...document.querySelectorAll('.tb-cart-item h3')]
      .some((el) => el.textContent === name), { timeout: 10000 }, title);
    const quantity = await page.evaluate((name) => {
      const row = [...document.querySelectorAll('.tb-cart-item')].find((el) => el.querySelector('h3')?.textContent === name);
      const before = Number(row?.querySelector('.tb-stepper span')?.textContent);
      row?.querySelector('[data-action="taobao.cart.item.increment"]')?.click();
      return before;
    }, title);
    await page.waitForFunction(([name, previous]) => {
      const row = [...document.querySelectorAll('.tb-cart-item')].find((el) => el.querySelector('h3')?.textContent === name);
      return Number(row?.querySelector('.tb-stepper span')?.textContent) === previous + 1;
    }, { timeout: 10000 }, [title, quantity]);
  });

  await runFlow('bilibili_video_back', 'bilibili', async (page) => {
    await waitForTrigger(page, 'video.open');
    await clickTrigger(page, 'video.open');
    await waitForTrigger(page, 'video.tab.switch');
    await clickTrigger(page, 'system.back');
    await waitForTrigger(page, 'video.open');
  });

  await runFlow('redbook_note_image', 'redbook', async (page) => {
    await waitForTrigger(page, 'note.open');
    await clickTrigger(page, 'note.open');
    await page.waitForFunction(() => [...document.images].some((image) =>
      image.currentSrc.includes('/cdn/redbook/images/posts/') && image.complete && image.naturalWidth > 0,
    ), { timeout: 15000 });
  });

  await runFlow('x_video_pauses_on_navigation', 'x', async (page) => {
    await page.evaluate(() => window.__OS__.openApp('x', '/status/p_2011516617243386317'));
    await page.waitForSelector('[data-app-id="x"] button[aria-label="Play video"]', { timeout: 20000 });
    await page.click('[data-app-id="x"] button[aria-label="Play video"]');
    await page.waitForSelector('[data-app-id="x"] video', { timeout: 10000 });
    await page.evaluate(() => {
      const video = document.querySelector('[data-app-id="x"] video');
      window.__xVideoUnderTest = video;
      window.__xVideoPauseCount = 0;
      Object.defineProperty(video, 'paused', { configurable: true, get() { return !this.__testPlaying; } });
      video.play = function play() { this.__testPlaying = true; return Promise.resolve(); };
      video.pause = function pause() { this.__testPlaying = false; window.__xVideoPauseCount += 1; };
      video.play();
      window.__OS__.openApp('x', '/messages');
    });
    await page.waitForFunction(() => !document.querySelector('[data-app-id="x"] video'), { timeout: 10000 });
    await page.waitForFunction(() => window.__xVideoUnderTest?.paused && window.__xVideoPauseCount > 0,
      { timeout: 10000 });
  });

  {
    let postsReplaced = false;
    let directFailures = 0;
    let proxyFailures = 0;
    await runFlow('x_video_double_failure_fallback', 'x', async (page) => {
      await page.evaluate(() => window.__OS__.openApp('x', '/status/p_2011516617243386317'));
      await page.waitForSelector('[data-app-id="x"] button[aria-label="Play video"]', { timeout: 20000 });
      await page.click('[data-app-id="x"] button[aria-label="Play video"]');
      await page.waitForFunction(() => document.querySelector('[data-app-id="x"]')?.textContent?.includes('视频加载失败'),
        { timeout: 15000 });
      if (!postsReplaced || directFailures === 0 || proxyFailures === 0) {
        throw new Error(`Failure paths not exercised: ${JSON.stringify({ postsReplaced, directFailures, proxyFailures })}`);
      }
      const requestsAtFallback = directFailures + proxyFailures;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (directFailures + proxyFailures !== requestsAtFallback) throw new Error('Failed video kept retrying');
    }, async (page) => {
      const posts = JSON.parse(fs.readFileSync(new URL('../apps/X/data/posts.json', import.meta.url), 'utf8'));
      const sample = posts.find((post) => post.id === 'p_2011516617243386317');
      if (!sample) throw new Error('X video sample post is missing');
      sample.video = 'https://media.example.invalid/broken.mp4';
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = decodeURIComponent(request.url());
        if (url.includes('/apps/X/data/posts.json') || /\/assets\/posts-[^/]+\.json/.test(url)) {
          postsReplaced = true;
          void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(posts) });
        } else if (url.includes('media.example.invalid')) {
          if (url.includes('/api/gw/proxy')) proxyFailures += 1;
          else directFailures += 1;
          void request.abort('failed');
        } else {
          void request.continue();
        }
      });
    });
  }

  await runFlow('x_message_thread', 'x', async (page) => {
    await waitForTrigger(page, 'tab.messages');
    await clickTrigger(page, 'tab.messages');
    await waitForTrigger(page, 'messages.conversation.open');
    await clickTrigger(page, 'messages.conversation.open');
    await page.waitForSelector('[data-action="chat.message.input"]', { timeout: 10000 });
  });

  await runFlow('wechat_camera_stream_cleanup', 'wechat', async (page) => {
    await page.evaluate(() => window.__OS__.openApp('wechat', '/camera'));
    await page.waitForFunction(() => {
      const audit = window.__cameraAudit;
      return audit.requests > 0 && Boolean(document.querySelector('[data-app-id="wechat"] video')?.srcObject);
    }, { timeout: 10000 });
    await page.evaluate(() => window.__OS__.closeApp('wechat'));
    await page.waitForFunction(() => window.__cameraAudit.stops === window.__cameraAudit.requests,
      { timeout: 10000 });

    await page.evaluate(() => {
      window.__cameraAudit.delay = true;
      window.__OS__.openApp('wechat', '/camera');
    });
    await page.waitForFunction(() => window.__cameraAudit.pending.length > 0, { timeout: 10000 });
    await page.evaluate(() => {
      window.__OS__.closeApp('wechat');
      window.__cameraAudit.pending.splice(0).forEach((resolve) => resolve());
    });
    await page.waitForFunction(() => window.__cameraAudit.stops === window.__cameraAudit.requests,
      { timeout: 10000 });
  }, async (page) => {
    await page.evaluateOnNewDocument(() => {
      const audit = { requests: 0, stops: 0, delay: false, pending: [] };
      window.__cameraAudit = audit;
      Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
        configurable: true,
        get() { return this.__mockStream ?? null; },
        set(value) { this.__mockStream = value; },
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia() {
            audit.requests += 1;
            const stream = { getTracks: () => [{ stop: () => { audit.stops += 1; } }] };
            if (audit.delay) return new Promise((resolve) => audit.pending.push(() => resolve(stream)));
            return Promise.resolve(stream);
          },
        },
      });
    });
  });

  await runFlow('wechat_distinct_avatars_do_not_double_tap', 'wechat', async (page) => {
    await waitForTrigger(page, 'chat.open');
    await page.evaluate(() => {
      const chat = [...document.querySelectorAll('[data-trigger="chat.open"]')]
        .find((el) => el.dataset.triggerParams?.includes('wxid_boss_007'));
      if (!chat) throw new Error('Boss chat entry is missing');
      chat.click();
    });
    await page.waitForFunction(() => document.querySelectorAll('[data-app-id="wechat"] img[data-action="chat.pat.send"]').length >= 2,
      { timeout: 10000 });
    const result = await page.evaluate(() => {
      const actions = [];
      window.addEventListener('mobilegym:agent-action', (event) => actions.push(event.detail.id));
      const [first, second] = [...document.querySelectorAll('[data-app-id="wechat"] img[data-action="chat.pat.send"]')];
      const fire = (element, type, pointerId) => element.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerType: 'touch', pointerId,
      }));
      fire(first, 'pointerdown', 1);
      fire(first, 'pointerup', 1);
      fire(second, 'pointerdown', 2);
      fire(second, 'pointerup', 2);
      return { actions, distinctElements: first !== second };
    });
    if (!result.distinctElements || result.actions.includes('chat.pat.send')) {
      throw new Error(`Separate avatars counted as a double tap: ${JSON.stringify(result)}`);
    }
  });

  await runFlow('wechat_same_avatar_double_tap', 'wechat', async (page) => {
    await waitForTrigger(page, 'chat.open');
    await page.evaluate(() => {
      const chat = [...document.querySelectorAll('[data-trigger="chat.open"]')]
        .find((el) => el.dataset.triggerParams?.includes('wxid_boss_007'));
      if (!chat) throw new Error('Boss chat entry is missing');
      chat.click();
    });
    await page.waitForSelector('[data-app-id="wechat"] img[data-action="chat.pat.send"]', { timeout: 10000 });
    const actions = await page.evaluate(() => {
      const ids = [];
      window.addEventListener('mobilegym:agent-action', (event) => ids.push(event.detail.id));
      const avatar = document.querySelector('[data-app-id="wechat"] img[data-action="chat.pat.send"]');
      const fire = (type, pointerId) => avatar.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerType: 'touch', pointerId,
      }));
      fire('pointerdown', 1);
      fire('pointerup', 1);
      fire('pointerdown', 2);
      fire('pointerup', 2);
      return ids;
    });
    if (actions.filter((id) => id === 'chat.pat.send').length !== 1) {
      throw new Error(`Same avatar double tap did not fire once: ${JSON.stringify(actions)}`);
    }
  });

  await runFlow('wechat_chat_back', 'wechat', async (page) => {
    await waitForTrigger(page, 'chat.open');
    await page.evaluate(() => {
      const chat = [...document.querySelectorAll('[data-trigger]')]
        .find((el) => el.dataset.trigger === 'chat.open' && el.dataset.triggerParams?.includes('wxid_boss_007'));
      if (!chat) throw new Error('Boss chat entry is missing');
      chat.click();
    });
    await page.waitForFunction(() => document.querySelector('[data-app-id="wechat"]')?.innerText.includes('Urgent:'),
      { timeout: 10000 });
    await waitForTrigger(page, 'system.back');
    await clickTrigger(page, 'system.back');
    await waitForTrigger(page, 'chat.open');
  });

  await runFlow('bookshelf_independent_long_press', 'wechat_reading', async (page) => {
    await waitForTrigger(page, 'tab.bookshelf');
    await clickTrigger(page, 'tab.bookshelf');
    await page.waitForFunction(() => document.querySelectorAll('[data-app-id="wechat_reading"] [data-scroll-container="main"] .group[data-trigger="reader.open"]').length >= 2,
      { timeout: 15000 });
    await page.evaluate(() => {
      window.__gestureAuditEvents = [];
      window.addEventListener('mobilegym:agent-action', (event) => window.__gestureAuditEvents.push(event.detail.id));
      const [first, second] = [...document.querySelectorAll('[data-app-id="wechat_reading"] [data-scroll-container="main"] .group[data-trigger="reader.open"]')];
      const fire = (element, type, pointerId) => element.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerType: 'touch', pointerId,
      }));
      fire(first, 'pointerdown', 1);
      fire(second, 'pointerdown', 2);
      fire(first, 'pointerup', 1);
      fire(second, 'pointerup', 2);
    });
    await new Promise((resolve) => setTimeout(resolve, 750));
    if (await page.$('[data-app-id="wechat_reading"] [data-action="bookshelf.item.select.toggle"]')) {
      throw new Error('Released long press activated bookshelf selection');
    }
    await page.evaluate(() => {
      const first = document.querySelector('[data-app-id="wechat_reading"] [data-scroll-container="main"] .group[data-trigger="reader.open"]');
      first.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 3 }));
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    const result = await page.evaluate(() => ({
      route: window.__OS__.getAppRoute('wechat_reading'),
      selectedItems: document.querySelectorAll('[data-app-id="wechat_reading"] [data-action="bookshelf.item.select.toggle"]').length,
      events: window.__gestureAuditEvents,
      samples: [...document.querySelectorAll('[data-app-id="wechat_reading"] [data-scroll-container="main"] .group[data-trigger="reader.open"]')]
        .slice(0, 3).map((element) => element.outerHTML.slice(0, 240)),
    }));
    if (result.selectedItems === 0) throw new Error(`Single long press did not activate selection: ${JSON.stringify(result)}`);
  });

  await runFlow('wechat_reading_book', 'wechat_reading', async (page) => {
    await waitForTrigger(page, 'reader.open');
    const bookResponse = page.waitForResponse((response) =>
      response.url().includes('/@app-assets/WechatReading/books/') && response.url().endsWith('.txt'),
    { timeout: 20000 });
    await page.evaluate(() => {
      const book = [...document.querySelectorAll('[data-trigger]')]
        .find((el) => el.dataset.trigger === 'reader.open' && el.dataset.triggerParams?.includes('"67"'));
      if (!book) throw new Error('Offline book entry is missing');
      book.click();
    });
    const response = await bookResponse;
    if (response.status() !== 200) throw new Error(`Book asset returned ${response.status()}`);
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-app-id="wechat_reading"]')?.innerText ?? '';
      return /\d+\/\d+/.test(text) && !text.includes('书籍内容暂时无法加载');
    }, { timeout: 15000 });
  });

  await runFlow('redbook_sample_post_images', 'redbook', async (page) => {
    const notes = JSON.parse(fs.readFileSync(new URL('../apps/RedBook/data/notes.json', import.meta.url), 'utf8'));
    const indices = [...new Set([
      0, 1, 100, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, notes.length - 1,
      ...Array.from({ length: 21 }, (_, step) => step * 200),
    ])];
    for (const index of indices) {
      const id = notes[index]?.id;
      if (!id) throw new Error(`Missing sampled post at index ${index}`);
      await page.evaluate((postId) => window.__OS__.openApp('redbook', `/note/${postId}`), id);
      await page.waitForFunction((postId) => {
        const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
        return image?.currentSrc.includes(`/images/posts/${postId}/`)
          && image.complete && image.naturalWidth > 0;
      }, { timeout: 15000 }, id);
    }
  });

  await runFlow('redbook_post_gallery_second_image', 'redbook', async (page) => {
    const id = '2kvlyjk5h';
    await page.evaluate((postId) => window.__OS__.openApp('redbook', `/note/${postId}`), id);
    await page.waitForFunction((postId) => {
      const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
      return image?.currentSrc.includes(`/images/posts/${postId}/0.jpg`)
        && image.complete && image.naturalWidth > 0;
    }, { timeout: 15000 }, id);
    await page.evaluate(() => {
      const next = document.querySelector('[data-app-id="redbook"] [data-image-swiper] > div.right-0.cursor-pointer');
      if (!next) throw new Error('Gallery next-image control is missing');
      next.click();
    });
    await page.waitForFunction((postId) => {
      const image = document.querySelector('[data-app-id="redbook"] [data-image-swiper] img');
      return image?.currentSrc.includes(`/images/posts/${postId}/1.jpg`)
        && image.complete && image.naturalWidth > 0;
    }, { timeout: 15000 }, id);
  });

  await runFlow('redbook_chat_keyboard_lifecycle', 'redbook', async (page) => {
    await waitForTrigger(page, 'tab.message');
    await clickTrigger(page, 'tab.message');
    await waitForTrigger(page, 'chat.open');
    await clickTrigger(page, 'chat.open');
    await page.waitForSelector('[data-app-id="redbook"] input', { timeout: 10000 });
    const timestamp = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="redbook-chat-timestamp"]');
      const source = Number(el?.getAttribute('data-timestamp'));
      return {
        shown: el?.textContent?.trim(),
        expected: new Date(source).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      };
    });
    if (timestamp.shown !== timestamp.expected) {
      throw new Error(`Chat timestamp does not match its message: ${JSON.stringify(timestamp)}`);
    }
    await page.evaluate(() => {
      const input = document.querySelector('[data-app-id="redbook"] input');
      input?.focus();
      input?.blur();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  await runFlow('reddit_chat_keyboard_lifecycle', 'reddit', async (page) => {
    await waitForTrigger(page, 'tab.chat');
    await clickTrigger(page, 'tab.chat');
    await waitForTrigger(page, 'chat.thread.open');
    await clickTrigger(page, 'chat.thread.open');
    await page.waitForSelector('[data-app-id="reddit"] textarea[placeholder="Message"]', { timeout: 10000 });
    await page.evaluate(() => {
      const input = document.querySelector('[data-app-id="reddit"] textarea[placeholder="Message"]');
      input?.focus();
      input?.blur();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  await runFlow('map_offline_restaurants', 'map', async (page) => {
    await page.waitForSelector('[data-map-category="restaurant"]', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-map-category="restaurant"]')?.click());
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-app-id="map"]')?.innerText ?? '';
      return text.includes('在此区域搜索') && text.includes('路线');
    }, { timeout: 15000 });
  });

  await runFlow('meituan_shop_cart', 'meituan_waimai', async (page) => {
    await waitForTrigger(page, 'meituan.shop.open');
    await clickTrigger(page, 'meituan.shop.open');
    await waitForTrigger(page, 'meituan.shop.reviews');
    await clickTrigger(page, 'meituan.shop.reviews');
    await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes('评价'));
    await clickTrigger(page, 'meituan.shop.menu');
    await page.waitForSelector('[data-action="meituan.cart.item.add"]', { timeout: 10000 });
    await page.evaluate(() => document.querySelector('[data-action="meituan.cart.item.add"]')?.click());
    await clickTrigger(page, 'meituan.cart.open');
    await page.waitForSelector('.mt-cart-row', { timeout: 10000 });
  });

  await runFlow('alipay_tab_scroll_restore', 'alipay', async (page) => {
    await waitForTrigger(page, 'tab.finance');
    const initial = await page.evaluate(() => {
      const el = document.querySelector('[data-app-id="alipay"] [data-scroll-container="main"]');
      if (!el) throw new Error('Alipay main scroll container is missing');
      const target = Math.min(200, el.scrollHeight - el.clientHeight);
      if (target < 20) throw new Error('Alipay home is not scrollable');
      el.scrollTop = target;
      return el.scrollTop;
    });
    await clickTrigger(page, 'tab.finance');
    await page.waitForFunction((expected) => Number(sessionStorage.getItem('alipay_layout_scroll_v1:/')) === expected,
      { timeout: 3000 }, initial).catch(async () => {
      const state = await page.evaluate(() => ({
        stored: sessionStorage.getItem('alipay_layout_scroll_v1:/'),
        text: document.querySelector('[data-app-id="alipay"]')?.innerText.slice(0, 80),
      }));
      throw new Error(`Finance tab did not save home scroll: ${JSON.stringify(state)}`);
    });
    await clickTrigger(page, 'tab.home');
    await page.waitForFunction((expected) => {
      const el = document.querySelector('[data-app-id="alipay"] [data-scroll-container="main"]');
      return el && Math.abs(el.scrollTop - expected) <= 2;
    }, { timeout: 3000 }, initial).catch(async () => {
      const state = await page.evaluate(() => {
        const el = document.querySelector('[data-app-id="alipay"] [data-scroll-container="main"]');
        return { scrollTop: el?.scrollTop, stored: sessionStorage.getItem('alipay_layout_scroll_v1:/'),
          text: document.querySelector('[data-app-id="alipay"]')?.innerText.slice(0, 80) };
      });
      throw new Error(`Home scroll did not restore to ${initial}: ${JSON.stringify(state)}`);
    });
  });

  await runFlow('spotify_skip_resets_elapsed', 'spotify', async (page) => {
    let stage = 'open';
    try {
    await waitForTrigger(page, 'player.open');
    await clickTrigger(page, 'player.open');
    await page.waitForSelector('[data-testid="spotify-player-elapsed"]', { timeout: 10000 });
    const title = await page.$eval('[data-testid="spotify-player-track-title"]', (el) => el.textContent);
    stage = 'start playback';
    await page.evaluate(() => document.querySelector('[data-action="track.play.toggle"]')?.click());
    stage = 'wait for elapsed time';
    await page.waitForFunction(() => {
      const elapsed = document.querySelector('[data-testid="spotify-player-elapsed"]')?.textContent ?? '0:00';
      const [minutes, seconds] = elapsed.split(':').map(Number);
      return minutes * 60 + seconds >= 2;
    }, { timeout: 10000 });
    stage = 'skip track';
    await page.evaluate(() => document.querySelector('[data-action="player.control.skipNext"]')?.click());
    stage = 'wait for next track';
    await page.waitForFunction((previous) =>
      document.querySelector('[data-testid="spotify-player-track-title"]')?.textContent !== previous,
    { timeout: 10000 }, title);
    const elapsedAfterSkip = await page.$eval('[data-testid="spotify-player-elapsed"]', (el) => el.textContent);
    if (!['0:00', '0:01'].includes(elapsedAfterSkip)) {
      throw new Error(`New track inherited elapsed time ${elapsedAfterSkip}`);
    }
    } catch (error) {
      const state = await page.evaluate(() => ({
        elapsed: document.querySelector('[data-testid="spotify-player-elapsed"]')?.textContent,
        title: document.querySelector('[data-testid="spotify-player-track-title"]')?.textContent,
        actions: [...document.querySelectorAll('[data-action]')].map((el) => el.getAttribute('data-action'))
          .filter((id) => id === 'track.play.toggle' || id === 'player.control.skipNext'),
      }));
      throw new Error(`${stage}: ${String(error?.message ?? error)}; ${JSON.stringify(state)}`);
    }
  });

  await runFlow('spotify_fallback_playlist_stable', 'spotify', async (page) => {
    const readTrackOrder = async () => {
      await waitForTrigger(page, 'playlist.trackMenu.open');
      return page.evaluate(() => [...document.querySelectorAll('[data-trigger="playlist.trackMenu.open"]')]
        .map((el) => el.getAttribute('data-trigger-params')));
    };
    await page.evaluate(() => window.__OS__.openApp('spotify', '/playlist/t1'));
    const first = await readTrackOrder();
    if (first.length < 2) throw new Error('Fallback playlist did not show multiple tracks');
    await page.evaluate(() => window.__OS__.closeApp('spotify'));
    await page.waitForFunction(() => !document.querySelector('[data-app-id="spotify"]'), { timeout: 10000 });
    await page.evaluate(() => window.__OS__.openApp('spotify', '/playlist/t1'));
    const second = await readTrackOrder();
    if (JSON.stringify(second) !== JSON.stringify(first)) {
      throw new Error(`Fallback track order changed between opens: ${JSON.stringify({ first, second })}`);
    }
  });

  await runFlow('spotify_missing_playlist_recovery', 'spotify', async (page) => {
    let stage = 'open missing playlist';
    try {
    await page.evaluate(() => window.__OS__.openApp('spotify', '/playlist/does-not-exist'));
    await page.waitForSelector('[data-testid="spotify-playlist-error"]', { timeout: 10000 });
    stage = 'retry';
    await page.evaluate(() => document.querySelector('[data-testid="spotify-playlist-retry"]')?.click());
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="spotify-playlist-error"]')?.getAttribute('data-retry-count') === '1',
    { timeout: 10000 });
    stage = 'show missing result again';
    await page.waitForSelector('[data-testid="spotify-playlist-error"]', { timeout: 10000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        hasError: !!document.querySelector('[data-testid="spotify-playlist-error"]'),
        text: document.querySelector('[data-app-id="spotify"]')?.textContent?.slice(0, 100),
      }));
      throw new Error(`${stage}: ${String(error?.message ?? error)}; ${JSON.stringify(state)}`);
    }
  });

  await runFlow('spotify_album_lookup_failure', 'spotify', async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/api/gw/fetch') && request.postData()?.includes('itunes.apple.com/lookup')) {
        void request.respond({ status: 503, contentType: 'application/json', body: '{}' });
      } else {
        void request.continue();
      }
    });
    await page.evaluate(() => window.__OS__.openApp('spotify', '/playlist/999999999999'));
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="spotify-playlist-error"]')?.textContent?.includes('暂时无法加载'),
    { timeout: 20000 });
  });

  await runFlow('spotify_offline_album', 'spotify', async (page) => {
    await page.evaluate(() => window.__OS__.openApp('spotify', '/playlist/159292399'));
    await waitForTrigger(page, 'playlist.trackMenu.open');
    const error = await page.$('[data-testid="spotify-playlist-error"]');
    if (error) throw new Error('Cached album showed the playlist error state');
  });

  await runFlow('spotify_album_lookup_timeout', 'spotify', async (page) => {
    await page.evaluate(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        let target = '';
        try { target = JSON.parse(init?.body ?? '{}').url ?? ''; } catch {}
        if (String(input).includes('/api/gw/fetch') && target.includes('itunes.apple.com/lookup')) {
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
          });
        }
        return originalFetch(input, init);
      };
    });
    await page.evaluate(() => window.__OS__.openApp('spotify', '/playlist/999999999999'));
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="spotify-playlist-error"]')?.textContent?.includes('暂时无法加载'),
    { timeout: 16000 });
  });

  await runFlow('calendar_edit_save_back_history', 'calendar', async (page) => {
    await page.evaluate(() => window.__OS__.openApp('calendar', '/event/fold_eval_weekly'));
    await page.waitForSelector('.calendar-event-detail[data-benchmark-source-id="fold_eval_weekly"]', { timeout: 10000 });
    await page.click('.calendar-event-detail button[aria-label="编辑"]');
    await page.waitForSelector('[data-app-id="calendar"] button[aria-label="保存"]', { timeout: 10000 });
    await page.click('[data-app-id="calendar"] button[aria-label="保存"]');
    await page.waitForSelector('.calendar-event-detail[data-benchmark-source-id="fold_eval_weekly"]', { timeout: 10000 });
    await page.click('.calendar-event-detail button[aria-label="关闭"]');
    await page.waitForFunction(() => !document.querySelector('.calendar-event-detail'), { timeout: 10000 });
    if (await page.$('[data-app-id="calendar"] button[aria-label="保存"]')) {
      throw new Error('Back from saved event detail reopened the editor');
    }

  });

  await runFlow('calendar_direct_edit_save', 'calendar', async (page) => {
    // Fresh browser context: no event detail entry exists below the editor.
    await page.evaluate(() => window.__OS__.openApp('calendar', '/event/fold_eval_weekly/edit'));
    await page.waitForSelector('[data-app-id="calendar"] button[aria-label="保存"]', { timeout: 10000 });
    await page.click('[data-app-id="calendar"] button[aria-label="保存"]');
    await page.waitForSelector('.calendar-event-detail[data-benchmark-source-id="fold_eval_weekly"]', { timeout: 10000 });
    await page.click('.calendar-event-detail button[aria-label="关闭"]');
    await page.waitForFunction(() => !document.querySelector('.calendar-event-detail'), { timeout: 10000 });
    if (await page.$('[data-app-id="calendar"] button[aria-label="保存"]')) {
      throw new Error('Back from directly edited event reopened the editor');
    }
  });

  await runFlow('calendar_new_event_save_with_keyboard_open', 'calendar', async (page) => {
    await page.evaluate(() => window.__OS__.openApp('calendar', '/new-event'));
    await page.waitForSelector('[data-benchmark-field="calendar-title"]', { timeout: 10000 });
    await page.type('[data-benchmark-field="calendar-title"]', '键盘保存日程');
    if (!await page.evaluate(() => window.__OS__.keyboard.isVisible())) {
      throw new Error('Keyboard closed before event save test');
    }
    await page.click('[data-app-id="calendar"] button[aria-label="保存"]');
    await page.waitForFunction(() => window.__OS__.getAppRoute('calendar')?.path === '/'
      && document.querySelector('[data-app-id="calendar"]')?.innerText.includes('键盘保存日程'),
    { timeout: 10000 });
  });

  await runFlow('notes_system_back_keeps_new_note', 'notes', async (page) => {
    const title = '速退测试';
    await page.evaluate(() => window.__OS__.openApp('notes', '/note/new'));
    await page.waitForSelector('[data-benchmark-field="notes-title"]', { timeout: 10000 });
    await page.type('[data-benchmark-field="notes-title"]', title);
    await leaveNotesEditorWithSystemBack(page, '/note/new');
    await page.waitForFunction((text) => document.querySelector('[data-app-id="notes"]')?.innerText.includes(text),
      { timeout: 3000 }, title);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('notes'));
    await page.waitForFunction((text) => document.querySelector('[data-app-id="notes"]')?.innerText.includes(text),
      { timeout: 20000 }, title);
  });

  await runFlow('notes_system_back_keeps_existing_edit', 'notes', async (page) => {
    const title = '已有便签速退';
    await page.evaluate(() => window.__OS__.openApp('notes', '/note/xn_1'));
    const input = '[data-benchmark-field="notes-title"]';
    await page.waitForSelector(input, { timeout: 10000 });
    await page.click(input, { clickCount: 3 });
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.type(input, title);
    await leaveNotesEditorWithSystemBack(page, '/note/xn_1');
    await page.waitForFunction((text) => document.querySelector('[data-app-id="notes"]')?.innerText.includes(text),
      { timeout: 3000 }, title);
  });

  await runFlow('notes_autosave_does_not_duplicate', 'notes', async (page) => {
    const title = '自动保存去重';
    await page.evaluate(() => window.__OS__.openApp('notes', '/note/new'));
    await page.waitForSelector('[data-benchmark-field="notes-title"]', { timeout: 10000 });
    await page.type('[data-benchmark-field="notes-title"]', title);
    await page.waitForFunction(() => /^\/note\/[^/]+$/.test(window.__OS__.getAppRoute('notes')?.path ?? '')
      && window.__OS__.getAppRoute('notes')?.path !== '/note/new',
      { timeout: 5000 });
    await leaveNotesEditorWithSystemBack(page, await page.evaluate(() => window.__OS__.getAppRoute('notes')?.path));
    const matches = await page.$$eval('[data-app-id="notes"] button', (buttons, text) =>
      buttons.filter((button) => button.textContent?.includes(text)).length, title);
    if (matches !== 1) throw new Error(`Expected one autosaved note, found ${matches}`);
  });

  await runFlow('file_manager_missing_text_asset_error', 'file_manager', async (page) => {
    let intercepted = false;
    let failAsset = true;
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/sdcard/README.md')) {
        intercepted = true;
        if (failAsset) void request.respond({ status: 404, contentType: 'text/plain', body: 'MISSING_ASSET_MARKER' });
        else void request.continue();
      } else {
        void request.continue();
      }
    });
    await page.evaluate(() => window.__OS__.openApp('file_manager', '/text?path=%2Fsdcard%2FREADME.md'));
    await page.waitForSelector('[data-app-id="file_manager"] [data-benchmark-source-id="/sdcard/README.md"]',
      { timeout: 10000 });
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-app-id="file_manager"]')?.innerText ?? '';
      return text.includes('无法打开这个文本文件') || text.includes('MISSING_ASSET_MARKER');
    }, { timeout: 10000 });
    const view = await page.$eval('[data-app-id="file_manager"]', (app) => app.innerText);
    if (!intercepted) throw new Error('Preset text asset request was not intercepted');
    if (!view.includes('无法打开这个文本文件') || view.includes('MISSING_ASSET_MARKER')) {
      throw new Error('404 response was shown as file content instead of an error');
    }
    failAsset = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('file_manager', '/text?path=%2Fsdcard%2FREADME.md'));
    await page.waitForFunction(() => {
      const app = document.querySelector('[data-app-id="file_manager"]');
      return Boolean(app?.querySelector('pre')?.textContent?.trim());
    }, { timeout: 20000 });
    const repaired = await page.$eval('[data-app-id="file_manager"]', (app) => Boolean(app.querySelector('pre')?.textContent?.trim()));
    if (!repaired) throw new Error('Missing seed file stayed broken after asset server recovered');
  });

  await runFlow('gallery_missing_seed_image_recovers', 'gallery', async (page) => {
    const photoPath = '/sdcard/Pictures/photo_001.jpg';
    const route = `/photo/${encodeURIComponent(photoPath)}`;
    let failedRequests = 0;
    let failAsset = true;
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/sdcard/Pictures/photo_001.jpg') && failAsset) {
        failedRequests += 1;
        void request.respond({ status: 404, contentType: 'text/plain', body: 'missing' });
      } else {
        void request.continue();
      }
    });
    await page.evaluate((path) => window.__OS__.openApp('gallery', path), route);
    await page.waitForSelector('.gallery-viewer-root[data-benchmark-source-id="/sdcard/Pictures/photo_001.jpg"]',
      { timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    if (!failedRequests) throw new Error('Seed image request was not intercepted');
    if (await page.$('.gallery-viewer-stage .animate-spin')) {
      throw new Error('Missing image showed a permanent loading spinner');
    }
    const nextPhotoPath = '/sdcard/Pictures/downloaded_image_copy.jpg';
    await page.evaluate((path) => window.__OS__.openApp('gallery', `/photo/${encodeURIComponent(path)}`), nextPhotoPath);
    await page.waitForFunction((path) => {
      const viewer = document.querySelector(`.gallery-viewer-root[data-benchmark-source-id="${path}"]`);
      const image = viewer?.querySelector('.gallery-viewer-image');
      return image?.complete && image.naturalWidth > 0;
    }, { timeout: 15000 }, nextPhotoPath);
    failAsset = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate((path) => window.__OS__.openApp('gallery', path), route);
    await page.waitForFunction(() => {
      const image = document.querySelector('.gallery-viewer-root[data-benchmark-source-id="/sdcard/Pictures/photo_001.jpg"] .gallery-viewer-image');
      return image?.complete && image.naturalWidth > 0 && image.currentSrc.startsWith('blob:');
    }, { timeout: 20000 });
  });

  await runFlow('mail_draft_survives_reload', 'mail', async (page) => {
    let stage = 'compose button';
    let preClick = null;
    try {
      await page.waitForSelector('[data-app-id="mail"] [data-action="mail.compose.open"]', { timeout: 10000 });
      stage = 'compose page';
      await page.click('[data-app-id="mail"] [data-action="mail.compose.open"]');
      await page.waitForSelector('[data-benchmark-route="compose"]', { timeout: 10000 });
      stage = 'fill draft';
      await page.type('[data-benchmark-field="mail-to"]', 'test@example.invalid');
      await page.type('[data-benchmark-field="mail-subject"]', '草稿保存检查');
      await page.type('[data-benchmark-field="mail-body"]', '不发送，仅验证本地草稿。');
      await page.waitForFunction(() => !document.querySelector('[data-benchmark-action="save-mail-draft"]')?.disabled,
        { timeout: 5000 });
      preClick = await page.evaluate(() => {
        const button = document.querySelector('[data-benchmark-action="save-mail-draft"]');
        const rect = button?.getBoundingClientRect();
        return { keyboard: window.__OS__.keyboard.isVisible(), rect: rect ? [rect.left, rect.top, rect.width, rect.height] : null };
      });
      if (!preClick.keyboard) throw new Error('Keyboard closed before testing one-tap draft save');
      await page.click('[data-benchmark-action="save-mail-draft"]');
      stage = 'saved count';
      await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="mail"] .section-label')]
        .some((label) => label.textContent?.includes('(1)')), { timeout: 10000 });
      stage = 'reload count';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
      await page.evaluate(() => window.__OS__.openApp('mail'));
      await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="mail"] .section-label')]
        .some((label) => label.textContent?.includes('(1)')), { timeout: 15000 });
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        labels: [...document.querySelectorAll('[data-app-id="mail"] .section-label')].map((label) => label.textContent?.trim()),
        compose: Boolean(document.querySelector('[data-benchmark-route="compose"]')),
        disabled: document.querySelector('[data-benchmark-action="save-mail-draft"]')?.disabled,
        values: [...document.querySelectorAll('[data-benchmark-field^="mail-"]')].map((input) => input.value),
        keyboard: window.__OS__?.keyboard?.isVisible(),
        saveHit: (() => {
          const button = document.querySelector('[data-benchmark-action="save-mail-draft"]');
          const rect = button?.getBoundingClientRect();
          return rect ? { rect: [rect.left, rect.top, rect.width, rect.height], hit: document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.outerHTML.slice(0, 180) } : null;
        })(),
      }));
      throw new Error(`${stage}: ${String(error?.message ?? error)} ${JSON.stringify({ preClick, snapshot })}`);
    }
  });

  await runFlow('tasks_save_with_keyboard_open', 'tasks', async (page) => {
    await page.waitForSelector('[data-benchmark-action="begin-task-form"]', { timeout: 10000 });
    await page.click('[data-benchmark-action="begin-task-form"]');
    await page.waitForSelector('[data-benchmark-route="task-form"]', { timeout: 10000 });
    await page.$eval('[data-benchmark-field="task-due"]', (input) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '2026-10-20T10:00');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.type('[data-benchmark-field="task-title"]', '键盘保存检查');
    await page.waitForFunction(() => !document.querySelector('[data-benchmark-action="save-task"]')?.disabled,
      { timeout: 5000 });
    const keyboardOpen = await page.evaluate(() => window.__OS__.keyboard.isVisible());
    if (!keyboardOpen) throw new Error('Keyboard closed before save test');
    const beforeSave = await page.evaluate(() => {
      const button = document.querySelector('[data-benchmark-action="save-task"]');
      const rect = button?.getBoundingClientRect();
      return { rect: rect ? [rect.left, rect.top, rect.width, rect.height] : null, hit: rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.outerHTML.slice(0, 160) : null };
    });
    await page.click('[data-benchmark-action="save-task"]');
    try {
      await page.waitForSelector('[data-benchmark-task-id="task_created_1"]', { timeout: 3000 });
    } catch (error) {
      const afterSave = await page.evaluate(() => ({
        keyboard: window.__OS__.keyboard.isVisible(),
        route: window.__OS__.getAppRoute('tasks'),
        form: Boolean(document.querySelector('[data-benchmark-route="task-form"]')),
        disabled: document.querySelector('[data-benchmark-action="save-task"]')?.disabled,
      }));
      throw new Error(`${String(error?.message ?? error)} ${JSON.stringify({ beforeSave, afterSave })}`);
    }
    await page.waitForFunction(() => !window.__OS__.keyboard.isVisible(), { timeout: 3000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('tasks'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="tasks"]')?.innerText.includes('键盘保存检查'),
      { timeout: 15000 });
  });

  await runFlow('study_cards_save_with_keyboard_open', 'study_cards', async (page) => {
    await page.waitForSelector('[data-app-id="study_cards"] [data-action="cards.form.open"]', { timeout: 10000 });
    await page.click('[data-app-id="study_cards"] [data-action="cards.form.open"]');
    await page.waitForSelector('[data-benchmark-route="card-form"]', { timeout: 10000 });
    await page.type('[data-benchmark-field="card-front"]', '键盘保存卡片');
    await page.type('[data-benchmark-field="card-back"]', '定义内容');
    await page.waitForFunction(() => !document.querySelector('[data-benchmark-action="save-card"]')?.disabled,
      { timeout: 5000 });
    if (!await page.evaluate(() => window.__OS__.keyboard.isVisible())) {
      throw new Error('Keyboard closed before card save test');
    }
    await page.click('[data-benchmark-action="save-card"]');
    try {
      await page.waitForFunction(() => !document.querySelector('[data-benchmark-route="card-form"]')
        && document.querySelector('[data-app-id="study_cards"]')?.innerText.includes('键盘保存卡片'),
      { timeout: 3000 });
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        keyboard: window.__OS__.keyboard.isVisible(),
        form: Boolean(document.querySelector('[data-benchmark-route="card-form"]')),
        disabled: document.querySelector('[data-benchmark-action="save-card"]')?.disabled,
        cards: [...document.querySelectorAll('[data-app-id="study_cards"] .flashcard b')].map((element) => element.textContent),
      }));
      throw new Error(`${String(error?.message ?? error)} ${JSON.stringify(snapshot)}`);
    }
    await page.waitForFunction(() => !window.__OS__.keyboard.isVisible(), { timeout: 3000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
    await page.evaluate(() => window.__OS__.openApp('study_cards'));
    await page.waitForFunction(() => document.querySelector('[data-app-id="study_cards"]')?.innerText.includes('键盘保存卡片'),
      { timeout: 15000 });
  });
} finally {
  await browser.close();
}

console.log(JSON.stringify({ checked, issues }, null, 2));
if (issues.length) process.exitCode = 1;

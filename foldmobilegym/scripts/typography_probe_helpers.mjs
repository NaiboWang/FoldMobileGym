/** Activate the app's own launch/resume route; not every home URL is bare '/'. */
export async function openTypographyApp(page, appId) {
  await page.evaluate(async appId => {
    window.__OS__.openApp(appId);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, appId);
  await page.waitForFunction(appId => {
    const app = document.querySelector(`[data-app-id="${appId}"]`);
    return window.__OS__.getState().activeAppId === appId && app && app.getBoundingClientRect().width > 0 &&
      !app.querySelector('[data-app-launch-splash]') && app.innerText.trim().length > 0;
  }, {}, appId);
  await page.evaluate(async appId => { await window.__SIM__.waitForData?.([appId]); await document.fonts.ready; }, appId);
  return page.evaluate(appId => window.__OS__.getAppRoute(appId)?.path, appId);
}

/** Set the simulated app's own language in an isolated browser profile. */
export async function setBilibiliReviewLocale(page, locale, openPilotApp) {
  await openPilotApp(page, 'bilibili', '/settings/language');
  const label = locale === 'en' ? 'English' : '简体中文';
  await page.waitForFunction(value => [...document.querySelectorAll('[data-app-id="bilibili"] div')]
    .some(el => el.checkVisibility() && el.textContent === value), {}, label);
  await page.evaluate(value => [...document.querySelectorAll('[data-app-id="bilibili"] div')]
    .find(el => el.checkVisibility() && el.textContent === value).click(), label);
  await page.waitForFunction(value => window.__SIM__.getState().apps.bilibili.settings.language === (value === 'en' ? 'en' : 'zh'), {}, locale);
}

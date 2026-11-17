/** Trusted pilot navigation; wait for the queued OS route before accepting an old identical URL. */
import assert from 'node:assert/strict';

/** Match the observable canonical Clock home, never accept an arbitrary redirect. */
export function expectedPilotRoute(appId, route) {
  if (appId !== 'clock') return route;
  if (route === '/' || route === '/?') return '/alarm';
  return route.startsWith('/?') ? '/alarm' + route.slice(1) : route;
}

export async function openPilotApp(page, appId, route = '/') {
  assert.match(appId, /^[a-z][a-z0-9_]*$/, 'Invalid pilot app ID');
  assert.ok(typeof route === 'string' && route.startsWith('/') && !route.startsWith('//'), 'Expected local app route');
  await page.evaluate(async ({ appId, route }) => {
    window.__OS__.openApp(appId, route);
    // openApp schedules its initial route in RAF, and its navigator applies
    // React routing asynchronously. An old identical /note/new is NOT an ack.
    // Wait through the dispatch frame and one following render frame before
    // checking the actual route/root. No business event, timeout or goal changes.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { appId, route });
  const expected = expectedPilotRoute(appId, route);
  await page.waitForFunction(({ appId, expected }) => window.__OS__.getState().activeAppId === appId
    && window.__OS__.getAppRoute(appId)?.path === expected, {}, { appId, expected });
  await page.waitForSelector(`[data-app-id="${appId}"]`, { visible: true });
}

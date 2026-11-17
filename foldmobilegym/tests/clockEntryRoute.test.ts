import { describe, expect, it, vi } from 'vitest';
import { normalizeClockEntryRoute } from '../system/Clock/entryRoute';
import { expectedPilotRoute, openPilotApp } from '../../tools/browser-automation/pilot_app_navigation.mjs';
import { NAVIGATION_DECLARATION } from '../system/Clock/navigation.declaration';
describe('Clock root entry resolution', () => {
  it.each(['/', '/?', '/?panel=add', '/?panel=edit&alarmId=a%2Fb%252F'])('resolves only the known home alias and preserves operands: %s', route => {
    const expected = route === '/?' ? '/alarm' : '/alarm' + route.slice(1);
    expect(normalizeClockEntryRoute(route)).toBe(expected);
    expect(expectedPilotRoute('clock', route)).toBe(expected);
  });
  it.each(['/alarm','/world','/timer','/stopwatch','/alarm?panel=add','/unknown','//example.invalid'])('does not rewrite real or unknown routes: %s', route => {
    expect(normalizeClockEntryRoute(route)).toBe(route);
    expect(expectedPilotRoute('clock', route)).toBe(route);
  });
  it('keeps other apps and their exact route acknowledgements unchanged', () => {
    for (const app of ['notes','wechat_reading','mail','reddit']) {
      for (const route of ['/','/?query=local','/alarm']) expect(expectedPilotRoute(app, route)).toBe(route);
    }
  });
  it('sends the raw root request unchanged, but acknowledges only the actual resolved route', async () => {
    const page = { evaluate: vi.fn().mockResolvedValue(undefined), waitForFunction: vi.fn().mockResolvedValue(undefined), waitForSelector: vi.fn().mockResolvedValue(undefined) };
    await openPilotApp(page,'clock','/');
    expect(page.evaluate.mock.calls[0][1]).toEqual({appId:'clock',route:'/'});
    expect(page.waitForFunction.mock.calls[0][2]).toEqual({appId:'clock',expected:'/alarm'});
  });
  it('keeps the root alias and declares the actual alarm home', () => {
    expect(NAVIGATION_DECLARATION.routes.find(route => route.path === '/')?.entryPoint).toBe('deepLink');
    expect(NAVIGATION_DECLARATION.routes.find(route => route.path === expectedPilotRoute('clock','/'))?.entryPoint).toBe('home');
  });
});

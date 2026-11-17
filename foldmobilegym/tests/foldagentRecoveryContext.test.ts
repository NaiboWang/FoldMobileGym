import { describe, expect, it } from 'vitest';
import { captureRetainedApps, retainedAppIds, retainedContextEqual } from '../foldagent_recovery_context';

const task = () => ({ apps: ['meituan_waimai', 'calculator', 'notes'],
  recovery: { app_id: 'notes', retained_apps: ['meituan_waimai', 'calculator'] } });
describe('Explicit cross-app recovery scope', () => {
  it('leaves legacy tasks unchanged', () => {
    expect(retainedAppIds({ apps: ['notes'], recovery: { app_id: 'notes' } })).toEqual([]);
    expect(retainedAppIds({ apps: ['notes'] })).toEqual([]);
  });
  it('returns a nonmutating scope copy', () => {
    const data = task(); retainedAppIds(data).reverse();
    expect(data.recovery.retained_apps).toEqual(['meituan_waimai', 'calculator']);
  });
  it.each([[], ['calculator', 'calculator'], ['notes'], ['unrelated'], [''], null, 'calculator', [1]].map(scope => [scope]))
    ('rejects invalid scope %j', scope => {
      const data = task(); data.recovery.retained_apps = scope as any;
      expect(() => retainedAppIds(data)).toThrow('recovery scope');
    });
  it('captures only declared data, not runtime route/lifecycle', () => {
    const apps = { calculator: { calculations: [{ id: 1 }], route: '/', transient: {}, lifecycle: {} }, notes: { content: 'private' } };
    const before = structuredClone(apps);
    const captured = captureRetainedApps(apps, ['calculator']);
    expect(captured).toEqual({ calculator: { calculations: [{ id: 1 }] } });
    (captured.calculator.calculations as any[]).push({ id: 2 });
    expect(apps).toEqual(before);
  });
  it.each([undefined, null, [], 'state'].map(value => [value]))('does not replace missing app %j with an empty successful context', value => {
    expect(() => captureRetainedApps({ calculator: value }, ['calculator'])).toThrow('Missing retained app');
  });
  it('ignores object-key order but detects lost/changed/reordered data', () => {
    expect(retainedContextEqual({ a: 1, b: { x: 2, y: 3 } }, { b: { y: 3, x: 2 }, a: 1 })).toBe(true);
    expect(retainedContextEqual({ records: [1, 2] }, { records: [2, 1] })).toBe(false);
    expect(retainedContextEqual({ records: [1, 2] }, { records: [1] })).toBe(false);
    expect(retainedContextEqual({ count: 2 }, { count: 1 })).toBe(false);
    expect(retainedContextEqual({ records: [] }, {})).toBe(false);
  });
});

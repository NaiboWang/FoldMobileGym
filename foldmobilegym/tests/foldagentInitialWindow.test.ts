import { describe, expect, it } from 'vitest';
import { requireSupportedInitialMode, validateInitialWindow, settleInitialWindow, type InitialWindowConfig } from '../foldagent_initial_window';

const expected = { appId: 'notes', posture: 'folded', layout: 'cover_single' };
const ready = { ...expected, visible: true, routeReady: true, launcher: false, recents: false };

describe('Initial window readiness', () => {
  it('returns without extra frames when foreground, route and geometry are ready', async () => {
    let frames = 0;
    await settleInitialWindow(expected, { read: () => ready, now: () => 0, nextFrame: async () => { frames++; } });
    expect(frames).toBe(0);
  });
  it.each([
    ['wrong-app', { appId: 'calculator' }], ['missing-app', { appId: undefined }],
    ['wrong-posture', { posture: 'unfolded' }], ['wrong-layout', { layout: 'inner_wide' }],
    ['invisible-app', { visible: false }], ['unmounted-route', { routeReady: false }],
    ['launcher', { launcher: true }], ['recents', { recents: true }],
  ])('waits past two frames for %s', async (_mode, change) => {
    let frames = 0;
    await settleInitialWindow(expected, { read: () => frames < 4 ? { ...ready, ...change } : ready,
      now: () => frames, nextFrame: async () => { frames++; } });
    expect(frames).toBe(4);
  });
  it('does not invent a layout requirement when legacy descriptor omits it', async () => {
    await settleInitialWindow({ appId: 'notes', posture: 'folded' }, {
      read: () => ({ ...ready, layout: undefined }), now: () => 0, nextFrame: async () => { throw Error('Unexpected wait'); },
    });
  });
  it('times out missing readiness as an environment error', async () => {
    let frames = 0;
    await expect(settleInitialWindow(expected, { read: () => ({ ...ready, routeReady: false }), now: () => frames,
      nextFrame: async () => { frames++; } }, 3)).rejects.toThrow('Initial app window did not settle: notes');
    expect(frames).toBe(3);
  });
  it.each(['split', 'triple', undefined])('does not admit fullscreen before observed mode settles: %s', async mode => {
    let frames = 0;
    await settleInitialWindow({ ...expected, mode: 'fullscreen' }, {
      read: () => ({ ...ready, mode: frames < 4 ? mode : 'fullscreen' }),
      now: () => frames, nextFrame: async () => { frames++; },
    });
    expect(frames).toBe(4);
  });
});

describe('Initial-mode capability admission', () => {
  it('admits actual fullscreen setup', () => {
    expect(() => requireSupportedInitialMode('fullscreen')).not.toThrow();
  });
  it.each(['freeform', 'triple', undefined, null])('rejects unsupported mode %s before setup', mode => {
    expect(() => requireSupportedInitialMode(mode)).toThrow('Unsupported initial window mode');
  });
  it.each(['fullscreen', 'split', 'freeform'])('keeps explicit no-setup diagnostics for %s', mode => {
    expect(() => requireSupportedInitialMode(mode, false)).not.toThrow();
  });
});

describe('Initial split contract', () => {
  it('settles folded initialization against the cover layout, preserving the requested inner direction', async () => {
    for (const orientation of ['side_by_side', 'stacked'] as const) {
      await settleInitialWindow({ ...expected, mode: 'split', orientation }, {
        read: () => ({ ...ready, mode: 'split', orientation: 'stacked' }),
        now: () => 0, nextFrame: async () => { throw Error('Expected cover layout was already ready'); },
      });
    }
  });
  const config: InitialWindowConfig = { posture: 'unfolded', layout: 'inner_wide', mode: 'split',
    focused_app: 'notes', split_apps: ['notes', 'calculator'], split_orientation: 'stacked', divider_ratio: 0.6 };
  it.each(['side_by_side', 'stacked'] as const)('admits %s with either app focused', split_orientation => {
    for (const focused_app of config.split_apps!) expect(() => validateInitialWindow({ ...config, split_orientation, focused_app }, ['notes', 'calculator'])).not.toThrow();
  });
  it.each([
    { split_apps: undefined }, { split_apps: ['notes', 'notes'] }, { split_apps: ['notes', 'missing'] },
    { focused_app: 'calendar' }, { split_orientation: undefined }, { split_orientation: 'diagonal' },
    { divider_ratio: 0.1 }, { divider_ratio: NaN }, { posture: 'tabletop' }, { mode: 'fullscreen' },
  ])('rejects invalid config before initialization: %j', change => {
    expect(() => validateInitialWindow({ ...config, ...change } as InitialWindowConfig, ['notes', 'calculator', 'calendar'])).toThrow();
  });
  it('waits until the requested orientation is observed', async () => {
    let frames = 0;
    await settleInitialWindow({ ...expected, mode: 'split', orientation: 'stacked' }, {
      read: () => ({ ...ready, mode: 'split', orientation: frames < 3 ? 'side_by_side' : 'stacked' }),
      now: () => frames, nextFrame: async () => { frames++; },
    });
    expect(frames).toBe(3);
  });
});

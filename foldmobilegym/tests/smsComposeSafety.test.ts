import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { smsMessageStatusKey } from '../system/Sms/messageStatus';
import { strings } from '../system/Sms/res/strings';
import { stringsEn } from '../system/Sms/res/strings.en';
import { NAVIGATION_DECLARATION } from '../system/Sms/navigation.declaration';

describe('SMS status presentation does not fabricate delivery', () => {
  it.each([
    ['sending', 'status_sending'], ['sent', 'status_sent'], ['delivered', 'status_delivered'],
    ['read', 'status_read'], ['failed', 'status_failed'],
  ] as const)('maps only the actual %s state', (status, key) => { expect(smsMessageStatusKey(status)).toBe(key); });
  it.each([undefined, null, ''])('does not invent a status for %s', status => { expect(smsMessageStatusKey(status)).toBeUndefined(); });
  it.each(['pending', 'unknown', 'SENT', false, 0, {}])('keeps unrecognized state %s neutral', status => { expect(smsMessageStatusKey(status)).toBe('status_unknown'); });
  it('distinguishes failure, delivery and read in both locales', () => {
    for (const resources of [strings, stringsEn]) {
      expect(resources.status_failed).not.toBe(resources.status_sent);
      expect(resources.status_delivered).not.toBe(resources.status_sent);
      expect(resources.status_read).not.toBe(resources.status_sent);
    }
  });
  it('declares explicit Send actions in both base and attachment surfaces', () => {
    const actions = NAVIGATION_DECLARATION.routes.flatMap(route => route.uiStates.flatMap(state => 'actions' in state ? state.actions ?? [] : []));
    const ids = actions.map(action => action.id);
    expect(ids).toEqual(expect.arrayContaining(['sms.compose.send.submit', 'sms.compose.attachments.send.submit', 'sms.conversation.send.submit', 'sms.conversation.attachments.send.submit']));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const h = vi.hoisted(() => ({ cleanup: [] as Array<() => void>, state: {
  activeTaskId: 'sms-task', isLauncherVisible: false, isRecentsVisible: false,
  tasks: [{ taskId: 'sms-task', stack: [{ activityId: 'sms-activity' }] }],
} }));
vi.mock('../os/TaskManager', () => ({ default: { getState: () => h.state } }));
vi.mock('../os/ActivityContext', () => ({ useActivityId: () => 'sms-activity' }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useLayoutEffect: (effect: () => void | (() => void)) => {
  const cleanup = effect(); if (cleanup) h.cleanup.push(cleanup);
} }));
import { createElement, useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, UNSAFE_NavigationContext, type Navigator } from 'react-router-dom';
import { useSmsComposeOwner } from '../system/Sms/hooks/useSmsComposeOwner';
let owns: () => boolean, history: Navigator;
function Probe() { owns = useSmsComposeOwner(); history = useContext(UNSAFE_NavigationContext).navigator; return null; }
function mount() { renderToString(createElement(MemoryRouter, { initialEntries: ['/', '/new?address=2025550100'], initialIndex: 1 }, createElement(Probe))); }
describe('SMS explicit-send Activity and immediate history owner', () => {
  beforeEach(() => { h.cleanup = []; h.state = { activeTaskId: 'sms-task', isLauncherVisible: false, isRecentsVisible: false,
    tasks: [{ taskId: 'sms-task', stack: [{ activityId: 'sms-activity' }] }] }; });
  afterEach(() => { for (const cleanup of h.cleanup) cleanup(); });
  it('accepts the owned foreground entry', () => { mount(); expect(owns()).toBe(true); });
  it.each(['isLauncherVisible', 'isRecentsVisible'] as const)('rejects %s', key => { mount(); h.state[key] = true; expect(owns()).toBe(false); });
  it('rejects background Clock', () => { mount(); h.state.activeTaskId = 'clock-task'; expect(owns()).toBe(false); });
  it('rejects a borrowed Activity above SMS', () => { mount(); h.state.tasks[0].stack.push({ activityId: 'picker' }); expect(owns()).toBe(false); });
  it.each(['push', 'replace'] as const)('rejects immediate %s before React commits', method => { mount(); history[method]('/new?panel=contacts'); expect(owns()).toBe(false); });
  it('rejects immediate Back before React commits', () => { mount(); history.go(-1); expect(owns()).toBe(false); });
  it('rejects another entry for the same URL', () => { mount(); history.push('/new?address=2025550100'); expect(owns()).toBe(false); });
  it('rejects unmounted callbacks', () => { mount(); for (const cleanup of h.cleanup) cleanup(); h.cleanup = []; expect(owns()).toBe(false); });
});

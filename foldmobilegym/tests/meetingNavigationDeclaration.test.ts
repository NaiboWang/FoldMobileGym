import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION as nav } from '../apps/TencentMeeting/navigation.declaration';

describe('scheduled meeting navigation declaration', () => {
  const transition = (id: string) => nav.transitions.find(item => item.id === id);
  it('declares the existing detail route and URL-driven menu', () => {
    const detail = nav.routes.find(route => route.path === '/meeting/detail')!;
    expect(detail.component).toBe('MeetingDetailPage');
    expect(detail.entryPoint).toBe('none');
    expect(detail.uiStates.map(state => state.search)).toEqual([{}, { dialog: 'actions' }]);
  });
  it('opens the menu only from the base detail state', () => {
    const item = transition('meeting.detail.actions.open')!;
    expect(item.from).toEqual({ path: '/meeting/detail', search: { dialog: null } });
    expect(item.to).toBe('/meeting/detail');
    expect(item.search).toEqual({ dialog: 'actions' });
    expect(item.mode).toBe('push');
  });
  it('replaces the menu with edit so back returns to detail', () => {
    const item = transition('meeting.detail.edit.open')!;
    expect(item.from).toEqual({ path: '/meeting/detail', search: { dialog: 'actions' } });
    expect(item.to).toBe('/meeting/edit');
    expect(item.search).toEqual({});
    expect(item.mode).toBe('replace');
  });
  it('retains the real detail and history-entry transitions, not a fake history return', () => {
    expect(transition('home.meeting.detail')?.to).toBe('/meeting/detail');
    expect(transition('meeting.edit.complete')?.to).toBe('/meeting/detail');
    expect(transition('history.detail.open')?.to).toBe('/history/:meetingId');
    expect(transition('history.detail.back')).toBeUndefined();
    expect(nav.capabilities.historyBack).toBe(true);
  });
});

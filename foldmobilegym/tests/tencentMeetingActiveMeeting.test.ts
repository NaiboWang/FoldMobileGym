import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION as nav } from '../apps/TencentMeeting/navigation.declaration';

describe('Tencent Meeting active-meeting navigation model', () => {
  const route = nav.routes.find(item => item.path === '/meeting')!;
  const transition = (id: string) => nav.transitions.find(item => item.id === id);
  const uiState = (id: string) => route.uiStates.find(item => item.id === id);
  const actions = (id: string) => (uiState(id) as { actions?: readonly { id: string }[] } | undefined)?.actions ?? [];

  it('owns every blocking meeting panel in URL state', () => {
    expect(route.uiStates.map(state => state.search)).toEqual([
      {},
      { dialog: 'more' },
      { dialog: 'members' },
      { dialog: 'profile' },
      { dialog: 'rename' },
      { dialog: 'chat' },
      { dialog: 'recipient' },
      { dialog: 'exit' },
    ]);
    expect(route.queryParams).toEqual({ member: 'string' });
  });

  it('opens base panels with history pushes and replaces More with Chat', () => {
    for (const id of ['meeting.more.open', 'meeting.members.open', 'meeting.chat.open', 'meeting.exit.open']) {
      expect(transition(id)?.from).toEqual({ path: '/meeting', search: { dialog: null } });
      expect(transition(id)?.mode).toBe('push');
    }
    expect(transition('meeting.more.chat.open')).toMatchObject({
      from: { path: '/meeting', search: { dialog: 'more' } },
      search: { dialog: 'chat' },
      mode: 'replace',
    });
  });

  it('keeps member identity in the URL for profile and rename layers', () => {
    expect(transition('meeting.member.open')).toMatchObject({
      search: { dialog: 'profile' },
      searchParams: { member: 'string' },
      mode: 'push',
    });
    expect(transition('meeting.member.rename.open')).toMatchObject({
      from: { path: '/meeting', search: { dialog: 'profile' } },
      search: { dialog: 'rename' },
      searchParams: { member: 'string' },
      mode: 'push',
    });
  });

  it('declares active controls and form actions on their owning states', () => {
    expect(actions('meeting.base').map(action => action.id)).toEqual([
      'meeting.microphone.toggle',
      'meeting.video.toggle',
      'meeting.sharing.toggle',
    ]);
    expect(actions('meeting.dialog.more').map(action => action.id)).toEqual([
      'meeting.recording.toggle',
      'meeting.layout.toggle',
      'meeting.captions.toggle',
    ]);
    expect(actions('meeting.dialog.chat').map(action => action.id)).toEqual([
      'meeting.chat.message.input',
      'meeting.chat.message.submit',
    ]);
    expect(actions('meeting.dialog.rename').map(action => action.id)).toEqual([
      'meeting.member.rename.input',
      'meeting.member.rename.submit',
    ]);
  });

  it('models the real multi-device exit choices without changing participant data', () => {
    expect(transition('meeting.leave')).toMatchObject({ to: '/', mode: 'replace' });
    expect(transition('meeting.leave.all')).toMatchObject({ to: '/', mode: 'replace' });
    expect(transition('meeting.end')).toMatchObject({ to: '/', mode: 'replace' });
  });
});

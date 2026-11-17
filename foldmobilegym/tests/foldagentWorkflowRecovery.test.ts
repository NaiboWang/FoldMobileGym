import { describe, expect, it } from 'vitest';
import { workflowActivity, workflowRoute, workflowRecoveryIdentity } from '../foldagent_workflow_recovery';
import type { WorkflowContract } from '../foldagent_workflow_contract';
import { AppNavigatorRegistry } from '../os/AppNavigatorRegistry';

const contract = (kind: 'note' | 'sms') => ({
  version: 1, card: kind === 'note' ? 'CA03' : 'CA06',
  source: { app: 'source', selector: '', facts: [] }, protected_paths: [],
  target: { app: kind === 'note' ? 'notes' : 'sms', kind,
    route: kind === 'note' ? '^/note/' : '^/new(?:[?#]|$)', field: '', phone: '13900007312' },
}) as WorkflowContract;

describe('Workflow Recovery identity and borrowed Activities', () => {
  it('observes Activity routes without overwriting app navigation, and removes stale routes', () => {
    let path = '/new';
    AppNavigatorRegistry.register('route-test-sms', { navigate: () => {}, back: () => false,
      route: () => ({ app: 'route-test-sms', path: '/' }) });
    AppNavigatorRegistry.registerActivityRoute('route-test-activity', () => ({ app: 'route-test-sms', path }));
    try {
      expect(AppNavigatorRegistry.getAppRoute('route-test-sms')?.path).toBe('/');
      path = '/new?panel=contacts';
      expect(AppNavigatorRegistry.getActivityRoute('route-test-activity')?.path).toBe(path);
    } finally {
      AppNavigatorRegistry.unregisterActivityRoute('route-test-activity');
      AppNavigatorRegistry.unregister('route-test-sms');
    }
    expect(AppNavigatorRegistry.getActivityRoute('route-test-activity')).toBeNull();
  });
  const os = () => ({ activeTaskId: 'contact-task', tasks: [
    { taskId: 'sms-task', rootAppId: 'sms', stack: [{ activityId: 'old-sms', appId: 'sms', initialRoute: '/' }] },
    { taskId: 'contact-task', rootAppId: 'contacts', stack: [
      { activityId: 'contact', appId: 'contacts', initialRoute: '/' },
      { activityId: 'borrowed-sms', appId: 'sms', initialRoute: '/new', intent: { data: { address: '13900007312' } } },
    ] },
  ] });

  it('reads the visible borrowed Activity, including current dialog parameters', () => {
    const state = os();
    expect(workflowActivity(state, 'sms')?.activity.activityId).toBe('borrowed-sms');
    expect(workflowRoute(state, 'sms', id => id === 'borrowed-sms' ? '/new?panel=contacts' : '/', () => '/'))
      .toBe('/new?panel=contacts');
    expect(workflowRoute(state, 'sms', () => undefined, () => '/')).toBe('');
    expect(workflowRoute(state, 'contacts', () => undefined, () => '/contacts/id')).toBe('/contacts/id');
  });

  it('does not replace the visible route with a background instance or initialRoute', () => {
    const state = os();
    state.activeTaskId = 'sms-task';
    expect(workflowRoute(state, 'sms', id => id === 'old-sms' ? '/new?dialog=invalidRecipient' : '/new', () => '/'))
      .toBe('/new?dialog=invalidRecipient');
    expect(workflowActivity({ tasks: [] }, 'sms')).toBeNull();
  });

  it('requires a persisted new note, not an empty editor or a protected seed note', () => {
    const c = contract('note');
    const initial = { apps: { notes: { notes: [{ id: 'old' }] } } };
    const state = { apps: { notes: { notes: [{ id: 'old' }, { id: 'new-id', title: '', content: 'draft' }] } },
      runtime: { app_routes: { notes: '/note/new' } } };
    expect(workflowRecoveryIdentity(c, state, initial)).toBeNull();
    state.runtime.app_routes.notes = '/note/old';
    expect(workflowRecoveryIdentity(c, state, initial)).toBeNull();
    state.runtime.app_routes.notes = '/note/new-id';
    expect(workflowRecoveryIdentity(c, state, initial)).toEqual({ kind: 'note', id: 'new-id' });
    state.apps.notes.notes[1] = { id: 'new-id', title: 'any partial title', content: '' };
    expect(workflowRecoveryIdentity(c, state, initial)).toEqual({ kind: 'note', id: 'new-id' });
    state.runtime.app_routes.notes = '/note/missing';
    expect(workflowRecoveryIdentity(c, state, initial)).toBeNull();
    state.runtime.app_routes.notes = '/note/%ZZ';
    expect(workflowRecoveryIdentity(c, state, initial)).toBeNull();
  });

  it('binds SMS readiness to the active compose key and exact recipient identity', () => {
    const c = contract('sms'), state: any = { os: os(), apps: { sms: { composeDrafts: {} } },
      runtime: { app_routes: { sms: '/new' } } };
    expect(workflowRecoveryIdentity(c, state, {})).toEqual({ kind: 'sms', draft_key: '["13900007312",""]', recipient_phone: '13900007312' });
    state.os.tasks[1].stack[1].intent = undefined;
    state.apps.sms.composeDrafts['unrelated'] = { recipient: '13900007312' };
    expect(workflowRecoveryIdentity(c, state, {})).toBeNull();
    state.apps.sms.composeDrafts['["",""]'] = { recipient: '13900007318' };
    expect(workflowRecoveryIdentity(c, state, {})).toBeNull();
    state.apps.sms.composeDrafts['["",""]'] = { recipient: 'Person', boundPhone: '+86 13900007312' };
    expect(workflowRecoveryIdentity(c, state, {})).toEqual({ kind: 'sms', draft_key: '["",""]', recipient_phone: '13900007312' });
  });

  it('keeps deep-link body requests separate from ordinary drafts', () => {
    const state = { os: { activeTaskId: 'sms-task', tasks: [os().tasks[0]] }, apps: { sms: { composeDrafts: {} } },
      runtime: { app_routes: { sms: '/new?address=13900007312&body=hello' } } };
    expect(workflowRecoveryIdentity(contract('sms'), state, {})).toEqual({
      kind: 'sms', draft_key: '["13900007312","hello"]', recipient_phone: '13900007312',
    });
  });
});

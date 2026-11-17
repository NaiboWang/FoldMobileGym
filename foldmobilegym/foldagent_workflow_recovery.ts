/** Private workflow identity and Activity selection; never model observations. */
import type { WorkflowContract } from './foldagent_workflow_contract';
import { smsComposeDraftKey } from './system/Sms/composeDrafts';

type Dict = Record<string, any>;
export function workflowActivity(os: Dict | undefined, appId: string) {
  const tasks: Dict[] = os?.tasks ?? [];
  const active = tasks.find(task => task.taskId === os?.activeTaskId);
  const task = active?.stack?.at(-1)?.appId === appId ? active
    : tasks.find(candidate => candidate.rootAppId === appId && candidate.stack?.at(-1)?.appId === appId);
  return task ? { task, activity: task.stack.at(-1) as Dict } : null;
}

export function workflowRoute(os: Dict | undefined, appId: string,
  readActivity: (activityId: string) => string | undefined,
  readApp: (appId: string) => string | undefined): string {
  const selected = workflowActivity(os, appId);
  if (selected) {
    const route = readActivity(selected.activity.activityId);
    if (route !== undefined) return route;
    // The app-level navigator may describe an unrelated background instance.
    if (selected.task.rootAppId !== appId) return '';
  }
  return readApp(appId) ?? '';
}

const phoneDigits = (value: unknown) => String(value ?? '').replace(/[^0-9]/g, '').replace(/^86(?=\d{11}$)/, '');

export function workflowRecoveryIdentity(c: WorkflowContract, state: Dict, initial: Dict): Dict | null {
  const target = c.target, route = state.runtime?.app_routes?.[target.app] ?? '';
  if (!new RegExp(target.route).test(route)) return null;
  if (target.kind === 'note') {
    const segment = /^\/note\/([^/?#]+)(?:[?#]|$)/.exec(route)?.[1];
    if (!segment || segment === 'new') return null;
    let id: string;
    try { id = decodeURIComponent(segment); } catch { return null; }
    const note = state.apps?.[target.app]?.notes?.find((item: Dict) => item.id === id);
    if (!note || note.trashedAt || note.isPrivate
      || initial.apps?.[target.app]?.notes?.some((item: Dict) => item.id === id)) return null;
    // Any authored title or body can establish identity; correctness is judged
    // separately, without requiring a gold prefix or a particular field order.
    return { kind: 'note', id };
  }
  if (target.kind === 'sms') {
    const selected = workflowActivity(state.os, target.app);
    if (!selected) return null;
    const data = selected.activity.intent?.data;
    const params = new URLSearchParams(route.split('?')[1]?.split('#')[0] ?? '');
    const address = typeof data?.address === 'string' ? data.address : params.get('address') ?? '';
    const body = typeof data?.body === 'string' ? data.body : params.get('body') ?? '';
    const key = smsComposeDraftKey(address, body);
    const draft = state.apps?.[target.app]?.composeDrafts?.[key]
      ?? { recipient: address, boundPhone: null };
    const phone = phoneDigits(draft.boundPhone || draft.recipient);
    if (!phone || phone !== phoneDigits(target.phone)) return null;
    // An Intent can establish a compose identity before the first text edit.
    // Recovery must replay that Intent and preserve the actual recipient field.
    return { kind: 'sms', draft_key: key, recipient_phone: phone };
  }
  return target.id ? { kind: target.kind, id: target.id } : null;
}

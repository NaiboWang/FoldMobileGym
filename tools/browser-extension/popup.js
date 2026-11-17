import {controlPage} from './bridge.js';
const $ = id => document.getElementById(id);
let busy = false, state = null;
async function run(request) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw Error('找不到当前网页标签。');
    const results = await chrome.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN', func: controlPage, args: [request]});
    const result = results[0]?.result;
    if (!result?.ok) throw Error(result?.error || '无法连接网页。');
    state = result;
    render(result);
    $('status').className = '';
    $('status').textContent = result.benchmark ? '评测模式：仅查看，人工控制已禁用。' : '已连接本地 foldmobilegym';
  } catch (error) {
    $('status').className = 'error';
    $('status').textContent = error.message;
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => b.disabled = Boolean(state?.benchmark) && b.id !== 'refresh');
  }
}
function render(result) {
  const s = result.state, d = s.displays[s.active_display];
  $('model').textContent = s.model;
  $('canvas').textContent = `${Number(d.width.toFixed(2))} × ${Number(d.height.toFixed(2))} CSS px`;
  $('native').textContent = d.resolution_width == null ? '待确认' : `${d.resolution_width} × ${d.resolution_height}`;
  document.querySelectorAll('[data-posture]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.posture === s.posture)));
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === s.multi_window.mode)));
  ['primary', 'secondary', 'tertiary'].forEach((id, index) => {
    const select = $(id), previous = select.value;
    select.replaceChildren();
    select.add(new Option('请选择已打开的应用', ''));
    result.tasks.forEach(task => select.add(new Option(`${task.app} · ${task.id.slice(-6)}`, task.id)));
    const active = [s.multi_window.primary_task_id, s.multi_window.secondary_task_id, s.multi_window.tertiary_task_id][index];
    select.value = result.tasks.some(t => t.id === previous) ? previous : active || result.tasks[index]?.id || '';
  });
  $('ratio').value = String(Math.round(s.multi_window.divider_ratio * 100));
  $('ratio-label').textContent = `${$('ratio').value}%`;
}
document.querySelectorAll('[data-posture]').forEach(button => button.addEventListener('click', () => run({kind: 'posture', value: button.dataset.posture})));
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => run({kind: 'window', mode: button.dataset.mode,
  tasks: [$('primary').value, $('secondary').value, $('tertiary').value], ratio: Number($('ratio').value) / 100})));
$('ratio').addEventListener('input', () => $('ratio-label').textContent = `${$('ratio').value}%`);
$('refresh').addEventListener('click', () => run({kind: 'read'}));
run({kind: 'read'});

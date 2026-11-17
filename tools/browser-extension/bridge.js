// Self-contained: Chrome serializes this function into the page's MAIN world.
export function controlPage(request) {
  try {
    const url = new URL(window.location.href);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
      || url.username || url.password) throw Error('请先打开本地 foldmobilegym 网页。');
    const api = window.__FOLDAGENT__, os = window.__OS__;
    if (!api?.getState || !os?.getState) throw Error('此页面不是已加载的 foldmobilegym 工程，请等待或刷新网页。');
    if (request.kind !== 'read' && url.searchParams.get('foldagent_benchmark') === '1') {
      throw Error('评测模式禁止扩展人工控制，请使用评测控制器。');
    }
    const tasks = os.getState().tasks.filter(t => t.stack?.length);
    if (request.kind === 'posture') {
      if (!['folded', 'unfolded'].includes(request.value)) throw Error('只支持折叠和展开。');
      api.setPosture(request.value);
    } else if (request.kind === 'window') {
      if (!['fullscreen', 'split', 'triple'].includes(request.mode)) throw Error('无效窗口模式。');
      if (request.mode === 'fullscreen') {
        api.setMultiWindow('fullscreen');
      } else {
        if (api.getState().posture !== 'unfolded') throw Error('请先展开设备。');
        const ids = request.mode === 'triple' ? request.tasks?.slice(0, 3) : request.tasks?.slice(0, 2);
        const count = request.mode === 'triple' ? 3 : 2;
        if (!ids || ids.length !== count || new Set(ids).size !== count
          || ids.some(id => !tasks.some(t => t.taskId === id))) throw Error(`请选择 ${count} 个不同的已打开任务。`);
        const ratio = Number(request.ratio);
        if (!Number.isFinite(ratio) || ratio < .33 || ratio > .67) throw Error('分栏比例须在 33%–67% 之间。');
        os.launchTaskById(ids[0]);
        api.setMultiWindow(request.mode, ids[0], ids[1], ratio, ids[2] ?? null, .5);
      }
    } else if (request.kind !== 'read') throw Error('无效命令。');
    return {ok: true, state: api.getState(), tasks: tasks.map(t => ({id: t.taskId, app: t.rootAppId})),
      benchmark: url.searchParams.get('foldagent_benchmark') === '1'};
  } catch (error) { return {ok: false, error: error.message}; }
}

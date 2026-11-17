/** FoldMobileGym screenshot/action transport; model requests live in foldagent/api.mjs. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const FORBIDDEN = new Map([
  ['fold', 'fold'], ['unfold', 'unfold'],
  ['setposture', 'set_posture'], ['set_posture', 'set_posture'],
  ['sethingeangle', 'set_hinge_angle'], ['set_hinge_angle', 'set_hinge_angle'],
]);
const OPEN_APP_ALIASES = new Map([
  ['微信', 'wechat'], ['wechat', 'wechat'],
  ['日历', 'calendar'], ['calendar', 'calendar'],
  ['笔记', 'notes'], ['notes', 'notes'],
  ['淘宝', 'taobao'], ['taobao', 'taobao'],
  ['地图', 'map'], ['map', 'map'],
  ['maps', 'map'],
  ['美团外卖', 'meituan_waimai'], ['meituan waimai', 'meituan_waimai'],
  ['外卖', 'meituan_waimai'], ['美团', 'meituan_waimai'], ['meituan', 'meituan_waimai'], ['点餐', 'meituan_waimai'],
  ['app store', 'appstore'], ['应用商店', 'appstore'],
  ['计算器', 'calculator'],
  ['时钟', 'clock'], ['短信', 'sms'], ['messages', 'sms'],
  ['设置', 'settings'], ['指南针', 'compass'],
  ['主题商店', 'theme_store'], ['themes', 'theme_store'],
  ['wps', 'workspace_docs'], ['wps office', 'workspace_docs'], ['文档', 'workspace_docs'], ['workspace docs', 'workspace_docs'],
  ['待办', 'tasks'], ['任务', 'tasks'], ['tasks', 'tasks'],
  ['microsoft to do', 'tasks'], ['to do', 'tasks'],
  ['学习卡片', 'study_cards'], ['闪卡', 'study_cards'], ['study cards', 'study_cards'], ['quizlet', 'study_cards'],
  ['食品信息', 'food_info'], ['open food facts', 'food_info'], ['food info', 'food_info'], ['yuka', 'food_info'],
  ['视频', 'video'], ['video', 'video'], ['本地视频', 'video'],
  ['相册', 'gallery'], ['gallery', 'gallery'],
  ['文件管理', 'file_manager'], ['文件管理器', 'file_manager'], ['file manager', 'file_manager'],
  ['文件', 'file_manager'], ['files', 'file_manager'],
  ['健康', 'fitness'], ['健身', 'fitness'], ['fitness', 'fitness'],
  ['运动记录', 'fitness'],
  ['邮件', 'mail'], ['mail', 'mail'], ['gmail', 'mail'],
  ['邮箱', 'mail'], ['谷歌邮箱', 'mail'],
  ['浏览器', 'browser'], ['browser', 'browser'], ['chrome', 'browser'],
  ['谷歌浏览器', 'browser'], ['google chrome', 'browser'],
  ['联系人', 'contacts'], ['通讯录', 'contacts'], ['contacts', 'contacts'],
  ['电话', 'contacts'], ['通话', 'contacts'], ['phone', 'contacts'],
  ['支付宝', 'alipay'], ['alipay', 'alipay'],
  ['哔哩哔哩', 'bilibili'], ['bilibili', 'bilibili'],
  ['ebay', 'ebay'], ['铁路12306', 'railway12306'], ['12306', 'railway12306'],
  ['小红书', 'redbook'], ['redbook', 'redbook'], ['reddit', 'reddit'],
  ['rednote', 'redbook'], ['手机淘宝', 'taobao'],
  ['spotify', 'spotify'], ['腾讯会议', 'tencent_meeting'], ['天气', 'weather'],
  ['tencent meeting', 'tencent_meeting'], ['railway 12306', 'railway12306'],
  ['微信读书', 'wechat_reading'], ['x', 'x'], ['twitter', 'x'],
  ['weread', 'wechat_reading'], ['answer sheet', 'answer_sheet'], ['answersheet', 'answer_sheet'],
  ['答题卡', 'answer_sheet'],
]);

export function resolveOpenAppText(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return null;
  if (OPEN_APP_ALIASES.has(normalized)) return OPEN_APP_ALIASES.get(normalized);
  return /^[a-z][a-z0-9_]*$/.test(normalized) ? normalized : null;
}

export function normalizeNativeInputText(inputType, text) {
  const type = String(inputType || '').toLowerCase();
  const raw = String(text || '').trim();
  if (type === 'datetime-local') {
    const match = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}${match[6] ? `:${match[6]}` : ''}` : null;
  }
  if (type === 'date') {
    const match = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  }
  if (type === 'time') {
    return /^\d{2}:\d{2}(?::\d{2})?$/.test(raw) ? raw : null;
  }
  return raw;
}

const SYSTEM_PROMPTS = {
  v1: `You are a screenshot-only mobile GUI agent. Complete the user's task safely.
The screenshot coordinate space is normalized: top-left is [0,0], bottom-right is [1000,1000].
Return exactly one action per response in this format:
Action: <brief description>
<tool_call>
{"name":"mobile_use","arguments":{"action":"click|long_press|swipe|type|system_button|open|wait|terminate", ...}}
</tool_call>

Arguments:
- click / long_press: coordinate [x,y]
- swipe: coordinate [x1,y1], coordinate2 [x2,y2]
- type: text
- system_button: button is Back, Home, Menu, or Enter
- open: text is the visible app name
- wait: time in seconds
- terminate: status is success or failure

Rules:
- Folding, unfolding, posture changes, window resizing, and benchmark/controller APIs are forbidden.
- Never send, call, purchase, pay, delete, sign in, or use a real location.
- Read the current screenshot carefully. Do not repeat an action that had no effect.
- Use terminate success only after the requested state is visibly complete.`,
  v2: `You are a screenshot-only mobile GUI agent. Complete the user's task safely.
The screenshot coordinate space is normalized: top-left is [0,0], bottom-right is [1000,1000].
Return exactly one action per response in this format:
Action: <brief description>
<tool_call>
{"name":"mobile_use","arguments":{"action":"click|long_press|swipe|type|system_button|open|wait|terminate", ...}}
</tool_call>

Arguments:
- click / long_press: coordinate [x,y]
- swipe: coordinate [x1,y1], coordinate2 [x2,y2]
- type: text
- system_button: button is Back, Home, Menu, or Enter
- open: text is the visible app name
- wait: time in seconds
- terminate: status is success or failure

General operating policy:
- Complete source reading first, remember the needed facts, then leave the source app and continue in the target app.
- To switch apps, use Home and click the visible target app icon. Back navigates within the current app.
- If the same coordinate/action already failed to change the screen, do not repeat it; use Back, Home, scroll, or another visible control.
- For a draft task, enter the requested content but never press Send. A visible unsent draft is the final state.
- Before terminate success, visually verify every requested field and that no forbidden action occurred.
- Folding, unfolding, posture changes, window resizing, and benchmark/controller APIs are forbidden.
- Never send, call, purchase, pay, delete, sign in, or use a real location.`,
  v3: `You are a screenshot-only mobile GUI agent. Complete the user's task safely.
The screenshot coordinate space is normalized: top-left is [0,0], bottom-right is [1000,1000].
Return exactly one action per response in this format:
Action: <brief description>
<tool_call>
{"name":"mobile_use","arguments":{"action":"click|long_press|swipe|type|system_button|open|wait|terminate", ...}}
</tool_call>

Arguments:
- click / long_press: coordinate [x,y]
- swipe: coordinate [x1,y1], coordinate2 [x2,y2]
- type: text
- system_button: button is Back, Home, Menu, or Enter
- open: text is the currently visible app name
- wait: time in seconds
- terminate: status is success or failure

General operating policy:
- Read source information from visible text. Once the required facts are visible, remember them and leave the source app; do not click non-control text repeatedly.
- To switch apps, press Home. Click the target icon only when its label is visible. If it is not visible, swipe the launcher horizontally once and inspect the new page before clicking.
- If an action did not change the screen, do not repeat the same coordinate. Re-inspect the screenshot and choose Back, Home, a launcher swipe, or another visible control.
- Before typing, click the specific destination field. After typing, visually verify that the text appeared in the intended field before moving on or saving.
- For a draft task, enter the requested content but never press Send. A visible unsent draft is the final state.
- Before terminate success, visually verify every requested field and that no forbidden action occurred.
- Folding, unfolding, posture changes, window resizing, and benchmark/controller APIs are forbidden.
- Never send, call, purchase, pay, delete, sign in, or use a real location.`,
  v4: `You are a screenshot-observation mobile GUI agent using structured mobile actions. Complete the user's task safely.
The screenshot coordinate space is normalized: top-left is [0,0], bottom-right is [1000,1000].
Return exactly one action per response in this format:
Action: <brief description>
<tool_call>
{"name":"mobile_use","arguments":{"action":"click|long_press|swipe|type|system_button|open|wait|terminate", ...}}
</tool_call>

Arguments:
- click / long_press: coordinate [x,y]
- swipe: coordinate [x1,y1], coordinate2 [x2,y2]
- type: text
- system_button: button is Back, Home, Menu, or Enter
- open: text is the exact target app name stated in the instruction or visible in the UI
- wait: time in seconds
- terminate: status is success or failure

General operating policy:
- Read source information from visible text. Once the required facts are visible, remember them and leave the source app; do not click non-control text repeatedly.
- For cross-app tasks, use the open action with the target app name instead of navigating launcher pages. This is an allowed agent action; folding and posture controls are not.
- If an action did not change the screen, do not repeat the same coordinate. Re-inspect the screenshot and choose Back, open, or another visible control.
- Before typing, click the specific destination field. After typing, visually verify that the text appeared in the intended field before moving on or saving.
- For a draft task, enter the requested content but never press Send. A visible unsent draft is the final state.
- Before terminate success, visually verify every requested field and that no forbidden action occurred.
- Folding, unfolding, posture changes, window resizing, and benchmark/controller APIs are forbidden.
- Never send, call, purchase, pay, delete, sign in, or use a real location.`,
  v5: `You are a screenshot-observation mobile GUI agent using structured mobile actions. Complete the user's task safely.
The screenshot coordinate space is normalized: top-left is [0,0], bottom-right is [1000,1000].
Return exactly one action per response in this format:
Action: <brief description>
<tool_call>
{"name":"mobile_use","arguments":{"action":"click|long_press|swipe|type|system_button|open|wait|terminate", ...}}
</tool_call>

Arguments:
- click / long_press: coordinate [x,y]
- swipe: coordinate [x1,y1], coordinate2 [x2,y2]
- type: text
- system_button: button is Back, Home, Menu, or Enter
- open: text is the exact target app name stated in the instruction or visible in the UI
- wait: time in seconds
- terminate: status is success or failure

General operating policy:
- Read source information from visible text. If the instruction asks to verify or confirm source facts and the source app presents an explicit visible control such as 完成阅读, 核验, or 确认, use that control after reading and before leaving the source app.
- For cross-app tasks, use the open action with the target app name instead of navigating launcher pages. This is an allowed agent action; folding and posture controls are not.
- If an action did not change the screen, do not repeat the same coordinate. Re-inspect the screenshot and choose Back, open, or another visible control.
- Before typing, click the specific destination field. After typing, visually verify that the text appeared in the intended field before moving on or saving.
- Treat words such as 日期, 时间, 地点, 标题, and 内容 inside a quoted output template as placeholders to replace with source facts. Preserve every literal separator, space, and punctuation mark in the requested template exactly; do not add or remove punctuation.
- For a draft task, enter the requested content but never press Send. A visible unsent draft is the final state.
- Before terminate success, visually verify every requested field and that no forbidden action occurred.
- Folding, unfolding, posture changes, window resizing, and benchmark/controller APIs are forbidden.
- Never send, call, purchase, pay, delete, sign in, or use a real location.`,
  v6: `You are a screenshot-observation mobile GUI agent using structured mobile actions. Complete the user's task safely.
The screenshot coordinate space is normalized: top-left is [0,0], bottom-right is [1000,1000].
Return exactly one action per response in this format:
Action: <brief description>
<tool_call>
{"name":"mobile_use","arguments":{"action":"click|long_press|swipe|type|system_button|open|wait|terminate", ...}}
</tool_call>

Arguments:
- click / long_press: coordinate [x,y]
- swipe: coordinate [x1,y1], coordinate2 [x2,y2]
- type: text
- system_button: button is Back, Home, Menu, or Enter
- open: text is the exact target app name stated in the instruction or visible in the UI
- wait: time in seconds
- terminate: status is success or failure

General operating policy:
- Read source information from visible text. If the instruction asks to verify or confirm source facts and the source app presents an explicit visible control such as 完成阅读, 核验, or 确认, use that control after reading and before leaving the source app.
- For cross-app tasks, use the open action with the target app name instead of navigating launcher pages. This is an allowed agent action; folding and posture controls are not.
- If an action did not change the screen, do not repeat the same coordinate. Re-inspect the screenshot and choose Back, open, or another visible control.
- Before every type action, click the field whose visible label or placeholder matches that value, even when another field is already focused or the keyboard is open. Never type a title into a body/content field or body/content into a title field.
- In a multi-field editor, inspect and correct every requested field, including prefilled fields. Keep semantic roles distinct: a place name is not a street address, and an arrival instruction is not part of an address.
- After typing, visually verify that the exact text appeared in the intended field before moving on or saving.
- Treat words such as 日期, 时间, 地点, 标题, and 内容 inside a quoted output template as placeholders to replace with source facts. Preserve every literal separator, space, newline, and punctuation mark in the requested template exactly; do not add or remove punctuation.
- For a draft task, enter the requested content but never press Send. A visible unsent draft is the final state.
- Use an explicit Done or Save control once when the app requires a commit. Once all requested committed objects or unsent drafts are visibly correct, terminate success immediately; do not navigate away or click any additional action.
- Before terminate success, visually verify every requested field and that no forbidden action occurred.
- Folding, unfolding, posture changes, window resizing, and benchmark/controller APIs are forbidden.
- Never send, call, purchase, pay, delete, sign in, or use a real location.`,
  v7: `你是一个手机 GUI-Agent 操作专家。你需要根据用户任务、手机屏幕截图和历史操作，一次输出一个动作来完成任务。
坐标系为归一化 0-1000，左上角是 [0,0]，右下角是 [1000,1000]。

必须严格使用以下格式：
<THINK>简要分析当前屏幕和下一步。</THINK>
<ANSWER>{"action":"动作类型", ...}</ANSWER>

可用动作：
- 点击：{"action":"CLICK","point":[x,y]}
- 长按：{"action":"LONGPRESS","point":[x,y]}
- 输入：{"action":"TYPE","value":"文本"}；输入前必须先点击正确字段
- 滑动：{"action":"SWIPE","point1":[x1,y1],"point2":[x2,y2]}
- 返回/桌面/最近任务/回车：{"action":"BACK|HOME|RECENT|ENTER"}
- 打开应用：{"action":"AWAKE","value":"任务中指定或界面可见的应用名"}
- 等待：{"action":"WAIT","value":秒数}
- 完成：{"action":"COMPLETE","return":"完成说明"}
- 中止：{"action":"ABORT","value":"原因"}

安全与操作规则：
- 先从可见界面读取来源事实；若有“完成阅读、核验、确认”等明确控件，离开来源应用前使用它。
- 跨应用任务优先使用 AWAKE。禁止折叠、展开、改变姿态、调整窗口或调用 benchmark/controller API。
- 每次输入前点击与该值语义对应的具体字段；标题、正文、日期、时间、地点等字段不得混写。输入后检查内容是否进入正确字段。
- 草稿任务只填写草稿，绝不点击发送。完成要求的未发送草稿或持久对象后立即 COMPLETE，不做额外操作。
- 不得进行任务禁止的发送、呼叫、购买、支付、删除、登录或真实定位操作。
- 动作无效时重新观察，不要重复同一坐标。`,
};

SYSTEM_PROMPTS.v8 = `${SYSTEM_PROMPTS.v7}
- 草稿界面语义：精确文本留在消息输入框中就表示草稿已经自动保存，不需要点击任何“保存”或“发送”控件；确认文本正确后立即 COMPLETE。`;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const asExpression = value => JSON.stringify(value).replaceAll('</script', '<\\/script');

export function resolvePythonExecutable({ root = ROOT, configured = process.env.FOLDAGENT_PYTHON_PATH,
  platform = process.platform } = {}) {
  if (configured) {
    if (!fs.existsSync(configured) || !fs.statSync(configured).isFile()) throw new Error('FOLDAGENT_PYTHON_PATH must point to a Python executable');
    return configured;
  }
  const local = path.join(root, '.venv', ...(platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']));
  if (fs.existsSync(local)) {
    if (!fs.statSync(local).isFile()) throw new Error('Local .venv Python path is not a file; repair the environment or set FOLDAGENT_PYTHON_PATH');
    return local;
  }
  return platform === 'win32' ? 'python' : 'python3';
}

export function resolveBrowserExecutable({ configured = process.env.FOLDAGENT_BROWSER_PATH,
  candidates = EDGE_CANDIDATES } = {}) {
  if (configured) {
    if (!fs.existsSync(configured) || !fs.statSync(configured).isFile()) {
      throw new Error('FOLDAGENT_BROWSER_PATH must point to a Chromium executable file; no fallback from an explicit invalid path');
    }
    return configured;
  }
  const browser = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!browser) throw new Error('No Edge/Chrome executable found; set FOLDAGENT_BROWSER_PATH to a Chromium executable');
  return browser;
}

export async function startEpisode(cdp, episode, options = {}) {
  const metadata = {
    task_hash: episode.task_hash,
    seed_hash: episode.seed_hash,
    run_metadata: episode.run_metadata,
  };
  return await cdp.eval(`window.__FOLDAGENT_BENCH__.start(${asExpression(episode.task)}, {
    seedState: ${asExpression(episode.seed_state)}, strictSeed: true, automatic: false,
    openInitialApp: true, episodeMetadata: ${asExpression(metadata)},
    allowAgentPosture: ${options.allowFold === true}
  })`);
}

export function irrecoverableEvaluatorLimit(task, report) {
  const evaluator = task?.evaluator || {};
  const checks = [
    ['invalid_actions', evaluator.max_invalid_actions, report?.invalid_actions],
    ['repeated_actions', evaluator.max_repeated_actions, report?.repeated_actions],
  ];
  for (const [metric, rawLimit, rawObserved] of checks) {
    const limit = Number(rawLimit);
    const observed = Number(rawObserved);
    if (Number.isFinite(limit) && Number.isFinite(observed) && observed > limit) {
      return { metric, observed, limit };
    }
  }
  return null;
}

export function cyclicRepeatedActions(actionTrace) {
  const seen = new Set();
  let repeats = 0;
  for (const item of actionTrace || []) {
    if (!item || item.terminal || !item.id || !item.pre_state_hash || !item.post_state_hash) continue;
    const signature = JSON.stringify([item.id, item.pre_state_hash, item.post_state_hash]);
    if (seen.has(signature)) repeats += 1;
    else seen.add(signature);
  }
  return repeats;
}

export function repeatedActionNgrams(actionTrace, minLength = 3, maxLength = 8) {
  const items = (actionTrace || []).filter(item => item && !item.terminal).map(item => JSON.stringify([
    item.id,
    item.kind || '',
    item.params?.coordinate || null,
    item.params?.requested || item.params?.app || null,
    item.params?.text || null,
  ]));
  let repeats = 0;
  for (let size = minLength; size <= Math.min(maxLength, items.length); size += 1) {
    const counts = new Map();
    for (let start = 0; start + size <= items.length; start += 1) {
      const key = items.slice(start, start + size).join('\n');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const count of counts.values()) repeats = Math.max(repeats, count - 1);
  }
  return repeats;
}

export function applyRunnerInteractionChecks(task, report) {
  if (!report || !Object.hasOwn(report, 'passed')
    || ![true, false, null].includes(report.passed)) {
    throw new Error('Invalid benchmark outcome: passed must be true, false, or null');
  }
  const cyclic = cyclicRepeatedActions(report?.action_trace);
  const ngramRepeated = repeatedActionNgrams(report?.action_trace);
  const nativeRepeated = Number(report?.repeated_actions) || 0;
  const combinedRepeated = Math.max(nativeRepeated, cyclic, ngramRepeated);
  const maxRepeated = Number(task?.evaluator?.max_repeated_actions);
  const cyclicLimitPassed = !Number.isFinite(maxRepeated) || combinedRepeated <= maxRepeated;
  const passed = cyclicLimitPassed ? report.passed : false;
  return {
    ...report,
    passed,
    outcome: passed === null ? 'unproven' : passed ? 'success' : 'failure',
    interaction_quality: Boolean(report?.interaction_quality) && cyclicLimitPassed,
    repeated_actions: combinedRepeated,
    runner_checks: {
      cyclic_repeated_actions: cyclic,
      ngram_repeated_actions: ngramRepeated,
      native_repeated_actions: nativeRepeated,
      combined_repeated_actions: combinedRepeated,
      max_repeated_actions: Number.isFinite(maxRepeated) ? maxRepeated : null,
      cyclic_limit_passed: cyclicLimitPassed,
    },
  };
}

export function buildModelMessages(opts, instruction, history, screenshot) {
  const historyText = history.length
    ? history.map(item => `Step ${item.step}: ${item.summary}`).join('\n')
    : 'No previous actions.';
  const visualHistory = opts.visionHistory > 0 ? history.slice(-opts.visionHistory).filter(item => item.screenshot) : [];
  return [
    { role: 'system', content: SYSTEM_PROMPTS[opts.promptVersion] },
    ...visualHistory.flatMap(item => [
      { role: 'user', content: [
        { type: 'text', text: `Previous observation at step ${item.step}, before its action. This is NOT the current screen.` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${item.screenshot}` } },
      ] },
      { role: 'assistant', content: item.response || item.summary },
    ]),
    { role: 'user', content: [
      { type: 'text', text: `Instruction: ${instruction}\n\nPrevious actions:\n${historyText}\n\nChoose the next single action.` },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot}` } },
    ] },
  ];
}

async function viewport(cdp) {
  const metrics = await cdp.send('Page.getLayoutMetrics');
  return {
    width: metrics.cssLayoutViewport?.clientWidth || metrics.layoutViewport.clientWidth,
    height: metrics.cssLayoutViewport?.clientHeight || metrics.layoutViewport.clientHeight,
  };
}

function checkedScreenBounds(bounds) {
  if (!bounds || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key]))
    || bounds.x < 0 || bounds.y < 0 || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error('Invalid screen capture bounds');
  }
  return bounds;
}

export async function captureAgentScreen(cdp) {
  // Trusted observation transport only: no DOM or geometry is sent to the model.
  const bounds = checkedScreenBounds(await cdp.eval(`(() => {
    const root = document.getElementById('root');
    if (!root || document.documentElement.dataset.foldagentPresentation === 'true') return null;
    const rect = root.getBoundingClientRect();
    const style = getComputedStyle(root);
    if (root.getAnimations().length || style.display === 'none' || style.visibility === 'hidden'
      || Number(style.opacity) === 0 || rect.right > innerWidth || rect.bottom > innerHeight) return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  })()`));
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88,
    fromSurface: true, captureBeyondViewport: false, clip: { ...bounds, scale: 1 } });
  await cdp.eval('window.__FOLDAGENT_BENCH__?.recordAgentObservation?.()');
  return { ...shot, bounds };
}

export async function waitForActiveAppReady(cdp, appId, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  let previous = '';
  let stable = 0;
  let snapshot = null;
  while (Date.now() < deadline) {
    snapshot = await cdp.eval(`(() => {
      const active=String(window.__OS__?.getState?.()?.activeAppId || '');
      const route=String(window.__OS__?.getAppRoute?.(${asExpression(appId)})?.path || '');
      const controls=[...document.querySelectorAll('button,input,textarea,select,a,[role="button"],[data-action],[data-trigger]')]
        .filter(node => {
          const style=getComputedStyle(node), r=node.getBoundingClientRect();
          if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||r.width<=0||r.height<=0||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;
          const x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2));
          const y=Math.max(0,Math.min(innerHeight-1,r.top+Math.min(r.height/2,24)));
          const hit=document.elementFromPoint(x,y); return hit&&(hit===node||node.contains(hit)||hit.contains(node));
        }).length;
      return {active,route,controls};
    })()`);
    const signature = JSON.stringify(snapshot);
    stable = snapshot.active === appId && snapshot.controls > 0 && signature === previous ? stable + 1 : 0;
    if (stable >= 2) return { ready: true, ...snapshot };
    previous = signature;
    await delay(100);
  }
  return { ready: false, ...(snapshot || {}) };
}

const clamp = value => Math.max(0, Math.min(1000, Number(value) || 0));
const actionPoint = (args, key = 'coordinate') => {
  if (Array.isArray(args?.[key])) return args[key];
  // Some OpenAI-compatible models emit {"x":[x,y]} despite the requested
  // coordinate field. Treat that as the same point rather than charging the
  // agent with an adapter-induced invalid action.
  if (key === 'coordinate' && Array.isArray(args?.x)) return args.x;
  if (key === 'coordinate' && args?.x != null && args?.y != null) return [args.x, args.y];
  if (key === 'coordinate2' && args?.x2 != null && args?.y2 != null) return [args.x2, args.y2];
  return null;
};
const pxPoint = (raw, size) => ({
  x: (size.x || 0) + Math.min(clamp(raw?.[0]) * size.width / 1000, Math.max(0, size.width - (size.x == null ? 0 : 0.01))),
  y: (size.y || 0) + Math.min(clamp(raw?.[1]) * size.height / 1000, Math.max(0, size.height - (size.y == null ? 0 : 0.01))),
});

async function targetMetadata(cdp, point) {
  return await cdp.eval(`(() => {
    const hit = document.elementFromPoint(${point.x}, ${point.y});
    const node = hit?.closest?.('[data-action],[data-trigger]');
    const field = hit?.closest?.('[data-benchmark-field]');
    const raw = node?.dataset.actionParams || node?.dataset.triggerParams || '';
    let params = {}; try { params = raw ? JSON.parse(raw) : {}; } catch {}
    return {
      id: node?.dataset.action || node?.dataset.trigger || 'dom.click',
      kind: node?.dataset.action ? 'action' : node?.dataset.trigger ? 'transition' : 'interaction',
      params: {...params, ...(field?.dataset.benchmarkField ? {benchmark_field: field.dataset.benchmarkField} : {})},
      target: hit?.getAttribute?.('aria-label') || hit?.textContent?.trim?.().slice(0, 80) || hit?.tagName || '',
    };
  })()`);
}

async function mouseGesture(cdp, type, start, end = start, durationMs = 120) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', buttons: 1, clickCount: 1 });
  if (type !== 'click') {
    const frames = 8;
    for (let i = 1; i <= frames; i += 1) {
      const t = i / frames;
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t, button: 'left', buttons: 1,
      });
      await delay(durationMs / frames);
    }
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...end, button: 'left', buttons: 0, clickCount: 1 });
}

async function touchSwipe(cdp, start, end, durationMs = 800) {
  // Trusted touch input lets Chromium scroll overflow containers and dispatches
  // PointerEvents to system edge/divider handlers. A mouse drag only selects text.
  const point = p => ({ x: p.x, y: p.y, radiusX: 1, radiusY: 1, force: 1, id: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(start)] });
  try {
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point({ x: start.x + (end.x-start.x)*t, y: start.y + (end.y-start.y)*t })] });
      await delay(durationMs / 8);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } catch (error) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {});
    throw error;
  }
}

export async function executeAction(cdp, args, options = {}) {
  const name = String(args?.action || '').trim().toLowerCase();
  if (!name) return { id: 'agent.invalid', kind: 'invalid', params: {}, valid: false, terminal: false };
  if (options.allowFold === true && ['fold', 'unfold'].includes(name)) {
    return await cdp.eval(`(() => {
      const controller = window.__FOLDAGENT_BENCH__;
      if (typeof controller?.performAgentPostureAction !== 'function')
        return { id: 'agent.posture_unavailable', kind: 'invalid', params: {}, valid: false, terminal: false };
      return controller.performAgentPostureAction(${asExpression(name)});
    })()`);
  }
  if (FORBIDDEN.has(name)) {
    const canonical = FORBIDDEN.get(name);
    return { id: canonical, kind: canonical, params: {}, valid: false, terminal: false };
  }
  const size = options.screenBounds ? checkedScreenBounds(options.screenBounds) : await viewport(cdp);
  if (name === 'click' || name === 'long_press' || name === 'double_tap') {
    const coordinate = actionPoint(args);
    if (!coordinate) return { id: 'agent.invalid_coordinate', kind: 'invalid', params: { action: name }, valid: false, terminal: false };
    const point = pxPoint(coordinate, size);
    const meta = await targetMetadata(cdp, point);
    await mouseGesture(cdp, name, point, point, name === 'long_press' ? Math.max(800, Number(args.time || 1) * 1000) : 80);
    if (name === 'double_tap') {
      await delay(80);
      await mouseGesture(cdp, name, point, point, 80);
    }
    return { ...meta, params: { ...meta.params, coordinate, target: meta.target }, valid: true, terminal: false };
  }
  if (name === 'swipe') {
    const coordinate = actionPoint(args);
    const coordinate2 = actionPoint(args, 'coordinate2');
    if (!coordinate || !coordinate2) return { id: 'agent.invalid_coordinate', kind: 'invalid', params: { action: name }, valid: false, terminal: false };
    const start = pxPoint(coordinate, size);
    const end = pxPoint(coordinate2, size);
    await touchSwipe(cdp, start, end);
    return { id: 'agent.swipe', kind: 'interaction', params: { coordinate, coordinate2 }, valid: true, terminal: false };
  }
  if (name === 'type') {
    const requestedPoint = actionPoint(args);
    if (requestedPoint) {
      const point = pxPoint(requestedPoint, size);
      await mouseGesture(cdp, 'click', point, point, 80);
      await delay(100);
    }
    const meta = await cdp.eval(`(() => {
      const hit=document.activeElement; const node=hit?.closest?.('[data-action],[data-trigger]');
      const inputType=hit?.tagName==='INPUT' ? String(hit.type||'text').toLowerCase() : '';
      const benchmarkField=hit?.dataset?.benchmarkField || '';
      const editable = Boolean(hit && !hit.disabled && !hit.readOnly &&
        (hit.isContentEditable || hit.tagName==='TEXTAREA' ||
          (hit.tagName==='INPUT' && ['text','search','email','url','tel','password','number','date','time','datetime-local'].includes(inputType))));
      if (!editable) return null;
      return {id:node?.dataset.action||node?.dataset.trigger||'agent.type',kind:node?.dataset.action?'action':node?.dataset.trigger?'transition':'interaction',inputType,benchmarkField};
    })()`);
    if (!meta) return { id: 'agent.no_editable_focus', kind: 'invalid', params: {}, valid: false, terminal: false };
    const rawText = String(args.text || '');
    if (['date', 'time', 'datetime-local'].includes(meta.inputType)) {
      const value = normalizeNativeInputText(meta.inputType, rawText);
      if (value == null) return { id: 'agent.invalid_native_input', kind: 'invalid', params: { input_type: meta.inputType, text: rawText }, valid: false, terminal: false };
      const accepted = await cdp.eval(`(() => {
        const hit=document.activeElement;
        if(!(hit instanceof HTMLInputElement) || hit.type!==${asExpression(meta.inputType)}) return false;
        const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
        if(!setter) return false;
        setter.call(hit,${asExpression(value)});
        hit.dispatchEvent(new Event('input',{bubbles:true}));
        hit.dispatchEvent(new Event('change',{bubbles:true}));
        return hit.value===${asExpression(value)};
      })()`);
      if (!accepted) return { id: 'agent.native_input_rejected', kind: 'invalid', params: { input_type: meta.inputType, text: rawText, normalized: value }, valid: false, terminal: false };
    } else {
      await cdp.send('Input.insertText', { text: rawText });
    }
    const { inputType, benchmarkField, ...actionMeta } = meta;
    return { ...actionMeta, params: { text: rawText, ...(inputType ? { input_type: inputType } : {}), ...(benchmarkField ? { benchmark_field: benchmarkField } : {}) }, valid: true, terminal: false };
  }
  if (name === 'system_button') {
    const button = String(args.button || 'Back');
    if (button === 'Enter') {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    } else {
      const method = { Home: 'goHome', Menu: 'showRecents', Back: 'handleBack' }[button];
      const available = method && await cdp.eval(`(() => { const os=window.__OS__; if(typeof os?.${method} !== 'function') return false; os.${method}(); return true; })()`);
      if (!available) return { id: 'agent.system_button_unavailable', kind: 'invalid', params: { button }, valid: false, terminal: false };
    }
    return { id: `system.${button.toLowerCase()}`, kind: 'system', params: {}, valid: true, terminal: false };
  }
  if (name === 'open') {
    const requested = String(args.text || '');
    const appId = resolveOpenAppText(requested);
    if (!appId) {
      return { id: 'agent.unknown_app', kind: 'invalid', params: { requested }, valid: false, terminal: false };
    }
    await cdp.eval(`window.__OS__?.openApp?.(${asExpression(appId)})`);
    const readiness = await waitForActiveAppReady(cdp, appId);
    const activeAppId = readiness.active || '';
    const valid = activeAppId === appId && readiness.ready;
    return {
      id: valid ? 'system.open_app' : 'agent.open_app_failed',
      kind: valid ? 'system' : 'invalid',
      params: { requested, app: appId, active_app_id: activeAppId, ready: readiness.ready, route: readiness.route, visible_controls: readiness.controls },
      valid,
      terminal: false,
    };
  }
  if (name === 'wait') {
    await delay(Math.max(0, Math.min(10, Number(args.time || 1))) * 1000);
    return { id: 'agent.wait', kind: 'interaction', params: { seconds: Number(args.time || 1) }, valid: true, terminal: false };
  }
  if (name === 'terminate') {
    return { id: 'agent.terminate', kind: 'terminal', params: { status: String(args.status || 'success') }, valid: true, terminal: true };
  }
  return { id: `agent.${name}`, kind: 'invalid', params: {}, valid: false, terminal: false };
}


import {installedAppPrompt} from './public_observation.mjs';
import {UNFOLDED_STATIC,UNFOLDED_MULTI_WINDOW} from './task_profiles.mjs';

// Tool semantics and experiment policy only; no navigation/editing strategies.
export function toolsOnlySystemPrompt(o) {
  const fullscreen=o.benchmarkProfile===UNFOLDED_STATIC;
  const multiWindow=o.benchmarkProfile===UNFOLDED_MULTI_WINDOW;
  const fixedUnfolded=fullscreen||multiWindow;
  let system=`你是通过截图操作手机的 GUI agent。根据完整任务、当前截图和操作历史完成任务。
每次只输出一个符合 JSON Schema 的动作对象，不输出解释；不用的字段填 null。

可用工具：
- click：点击 coordinate。
- double_tap：双击 coordinate。
- long_press：长按 coordinate。
- swipe：从 coordinate 滑动到 coordinate2。
- type：输入 text；在当前焦点的光标处插入，有选区时替换选区。
- system_button：按 button，取值为 Back、Home、Menu 或 Enter。
- open：打开应用，text 使用下方应用清单中的规范 ID。
- wait：等待 time 秒，范围 0–10。
${o.allowFold?'- fold：折叠到外屏；unfold：展开到内屏。均无参数，每次计为一步；保留应用和数据，已处于目标姿态时不切换。\n':''}- terminate：结束任务，status 为 success 或 failure；自报 success 不代替独立判题。

coordinate 和 coordinate2 是当前截图的 0–1000 归一化坐标，左上角 [0,0]、右下角 [1000,1000]；X 向右，Y 向下。
仅通过以上工具操作，只依据任务、截图和公开操作反馈作出判断。不得调用隐藏接口、DOM、判题器或读取参考答案。
遵守任务要求；草稿任务不要发送。不得发送消息、拨号、购买、支付、删除、登录或使用真实位置。`;
  if(fixedUnfolded) {
    system+='\n本轮全程保持展开态内屏，不会注入姿态变化。不得折叠、展开、半折叠、建立悬浮窗或进行恢复干预。';
    system+=fullscreen
      ?'\n本轮使用单应用全屏；跨应用任务依次切换应用。不得建立双应用分屏或调整系统窗口。应用内部的列表—详情、侧栏或多列允许使用。'
      :'\n本轮允许左右、上下双应用分屏及全屏，允许通过可见界面建立、关闭或调整窗格。应用身份、顺序、读取/编辑布局和最终窗口状态须符合任务要求。';
  } else {
    if(!o.allowFold)system+='\n不得主动折叠或展开；姿态由环境控制。';
    system+=o.allowSplit?'\n允许通过可见界面操作双应用分屏和调整窗格。':'\n不得主动调整窗口布局。';
    system+='不得使用半折叠、悬浮窗或隐藏窗口接口。';
  }
  return system+'\n'+installedAppPrompt(o.installedApps)+'\n公开执行反馈只说明动作执行状态，不提供任务判定或答案。';
}

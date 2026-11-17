import {buildModelMessages} from '../foldagent_runtime/browser_executor.mjs';
import {installedAppPrompt,publicFeedbackMessage} from './public_observation.mjs';
import {UNFOLDED_STATIC,UNFOLDED_MULTI_WINDOW} from './task_profiles.mjs';
import {toolsOnlySystemPrompt} from './prompts_tools_only.mjs';

export function validatePromptDetail({promptDetail='detailed',promptVersion='v4'}={}) {
  if(!['detailed','tools-only'].includes(promptDetail))throw Error('--prompt-detail must be detailed or tools-only');
  if(promptDetail==='tools-only'&&promptVersion!=='v4')throw Error('--prompt-detail tools-only requires v4 prompts');
  return promptDetail;
}

// Read dimensions from the actual transported image, never from the CSS viewport.
export function screenshotSize(base64) {
  const b=Buffer.from(base64||'','base64');
  if(b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  if(b.length<4||b[0]!==0xff||b[1]!==0xd8)return null;
  let offset=2;
  while(offset+3<b.length) {
    if(b[offset++]!==0xff)return null;
    while(b[offset]===0xff)offset++;
    const marker=b[offset++];if(marker===0xda||marker===0xd9)return null;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    if(offset+2>b.length)return null;
    const length=b.readUInt16BE(offset);if(length<2||offset+length>b.length)return null;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7)return {width:b.readUInt16BE(offset+5),height:b.readUInt16BE(offset+3)};
    offset+=length;
  }
  return null;
}

export function coordinateReminder(screenshot, unfoldedStatic=false) {
  const size=screenshotSize(screenshot);
  return `当前截图的坐标规则（每一步都适用）：
- 左上角是 [0,0]，右下角是 [1000,1000]；X 向右，Y 向下。
- coordinate 和 coordinate2 必须是 0–1000 归一化坐标，不是原图像素坐标。
${size?`- 当前原图宽 W=${size.width}、高 H=${size.height} 像素。`:'- W、H 指当前原图的宽、高。'}
- 如果你先得到原图像素点 [px,py]，输出前必须换算：x=px/W*1000，y=py/H*1000。不要直接把像素值填入 coordinate。
- 只根据当前截图定位；${unfoldedStatic?'页面':'折叠或页面'}变化后，旧截图中的位置不能直接沿用。`;
}

function legacyMessages(o,instruction,history,screenshot) {
  const messages=buildModelMessages({promptVersion:'v6',visionHistory:o.visionHistory},instruction,history,screenshot);
  messages[0].content=messages[0].content.replace(/Return exactly one action per response in this format:[\s\S]*?<\/tool_call>/,
    'Return exactly one action as a JSON object matching the response schema.');
  if(o.allowSplit) {
    messages[0].content=messages[0].content.replaceAll('window resizing, ','');
    messages[0].content+='\nThis experiment permits visible user-level split gestures. A task may start with two apps side by side or stacked. On an unfolded screen with an app open, swipe from bottom center toward upper left (for example [500,995] to [220,730]), then select the second app on the visible launcher. Click inside the intended pane before typing or system Back. In a side-by-side split, swipe inward from the outer left edge to close the left app or from the outer right edge to close the right app. In a stacked split, swipe inward from either outer side edge within the app you want to close. Start inside the app content, away from the divider and system bars; use a deliberate horizontal swipe. The other app becomes fullscreen and retains its state. Drag the central divider to an outer edge to keep the other pane fullscreen without removing the dismissed task from Recents. No direct fold/posture/controller calls are permitted.';
  }
  messages[0].content+='\nReturn exactly ONE JSON object conforming to the response schema, without tool_call tags or Markdown. Unused fields must be null. Use only task text, visible screenshots and your action history. The model does not receive fixture data, target answers, DOM or judge results. A terminate success action states your belief; the independent benchmark judge decides actual success.';
  return messages;
}

export function modelMessages(o,instruction,history,screenshot) {
  const toolsOnly=validatePromptDetail(o)==='tools-only';
  const unfoldedStatic=o.benchmarkProfile===UNFOLDED_STATIC;
  const unfoldedMultiWindow=o.benchmarkProfile===UNFOLDED_MULTI_WINDOW;
  const fixedUnfolded=unfoldedStatic||unfoldedMultiWindow;
  const allowSplit=unfoldedMultiWindow||o.allowSplit;
  const allowFold=o.allowFold===true;
  if(allowFold&&fixedUnfolded)throw Error('Fixed-unfolded tasks do not permit agent fold/unfold');
  if(allowFold&&o.promptVersion&&o.promptVersion!=='v4')throw Error('Agent fold/unfold requires v4 prompts');
  if(unfoldedStatic&&o.allowSplit)throw Error('unfolded_static_v1 requires v4 without split');
  if(fixedUnfolded&&o.promptVersion&&o.promptVersion!=='v4')throw Error(`${o.benchmarkProfile} requires v4`);
  if(o.promptVersion==='v1')return legacyMessages(o,instruction,history,screenshot);
  if(toolsOnly)return observationMessages(o,instruction,history,screenshot,toolsOnlySystemPrompt(o));
  const publicContext=!o.promptVersion||o.promptVersion==='v4';
  const editing=o.promptVersion==='v2'
    ? '输入前先点击正确输入框，输入后检查内容；追加时保留原文。'
    : '输入前先点击正确输入框使其聚焦。点击文字会将光标移到该位置；type 从当前光标处插入，有选区则替换选区，不会自动移到末尾或清空。追加时先把光标放到原文末尾并保留原文；已聚焦且光标/选区正确时直接 type，勿重复点击取消选区。输入后检查截图中的实际内容。';
  const finishing=o.promptVersion==='v2'
    ? '任务完成后 terminate，不继续无关操作。'
    : '检查任务要求均已满足后，下一步输出 action="terminate", status="success"，其他字段为 null。草稿任务在目标草稿内容正确、原文保留且未发送时即可结束，无需发送、关闭键盘或寻找完成按钮；不确定内容正确时先检查或修正。确实无法继续时输出 terminate/failure。自报 success 不代替独立判题。';
  let system=`你是通过截图操作手机的 GUI agent。根据完整任务、当前截图和历史操作选择下一步。
每次只输出一个符合 JSON Schema 的动作对象，不输出解释；不用的字段填 null。
动作：click / double_tap / long_press 使用 coordinate；swipe 使用 coordinate 和 coordinate2；type 使用 text；system_button 使用 Back、Home、Menu 或 Enter；${publicContext?'open 使用下方已安装应用清单中的规范 text 参数':'open 使用任务中或界面可见的应用名称'}；wait 使用 time（秒）；${allowFold?'fold 折叠到外屏、unfold 展开到内屏，均不需要参数，其他字段全部填 null；':''}terminate 使用 status=success 或 failure。
所有坐标都是当前截图的 0–1000 归一化坐标，左上角 [0,0]、右下角 [1000,1000]，不是原图像素。
只依据可见内容操作；看清同名条目的日期、时间等区别。跨应用可用 open。${editing}
遵守任务要求；草稿任务不要发送。${finishing}动作无效时重新看图，不反复点击相同位置。
${allowFold?'不得调用隐藏接口、DOM 或判题器。允许通过 fold、unfold 动作自主选择屏幕形态。':'不得调用隐藏接口、DOM、判题器或主动折叠/展开。姿态由环境控制，变化后以当前截图为准。'}不得发送消息、拨号、购买、支付、删除、登录或使用真实位置。`;
  if(allowFold)system+='\n主动折叠工具：手机有折叠态外屏和展开态内屏，内屏通常能展示更多内容或不同布局。仅根据任务、当前可见画面和操作历史判断是否值得展开或折叠；不要求为了使用工具而切换。每次 fold/unfold 都计为一步，已经处于目标姿态时不会再次切换。切换保留应用与当前数据，重新观察新截图后再定位，禁止沿用旧坐标。工具反馈只描述执行和屏幕状态，不包含任务答案或判题结果。半折叠和任意铰链角度不在工具范围内。';
  if(publicContext)system+='\n页面探索：受手机屏幕尺寸、分屏窗格大小或屏幕键盘占用空间的限制，页面内容可能无法一次完整显示。目标暂不可见时，可使用 swipe 在对应应用的内容区域内滚动查找：向上滑动查看下方内容，向下滑动查看上方内容。每次滑动后重新观察当前截图。滚动页面时，手势起止位置应位于同一应用窗格的内容区域内，避开分隔条、系统栏和屏幕边缘，以免触发窗口操作。';
  if(allowSplit)system+='\n允许通过可见手势操作分屏：展开态从底边中点向左上滑动后选择第二个应用；输入或返回前先点击目标窗口；从对应窗口外侧边缘向内滑动可关闭该窗口。不得直接调用窗口或控制器接口。';
  else system+=' 不得主动调整窗口布局。';
  if(allowSplit&&publicContext)system+='\n分屏方向通用说明：展开态新建双应用分屏默认左右排列，先打开的应用在左，选择的第二个应用在右。若任务要求上下分屏，点击两窗口分隔条上的“↻”（切换分屏方向）按钮；原左侧应用变为上方应用，原右侧应用变为下方应用。该按钮仅在展开态双应用分屏时显示，也可将上下切回左右。操作后根据当前截图确认方向和应用顺序；若已经是任务要求的布局，不要重复切换。任务要求在指定分屏中读取或编辑时，应先建立并确认布局，再读取来源信息、编辑目标内容。'+(fixedUnfolded?'':allowFold?'折叠后系统自动采用上下分屏，展开后恢复先前的展开态方向，同时保留两个应用及其顺序。':'折叠后系统自动采用上下分屏，展开后恢复先前的展开态方向；姿态变化由环境控制，不要主动折叠来切换方向。');
  if(allowSplit&&publicContext)system+='\n分隔条调整：允许根据需要拖动可见分隔条，扩大当前需要读取或编辑的应用窗格，无需保持或恢复初始比例，除非任务明确要求特定比例。使用 swipe，从分隔条本身开始拖动；左右分屏沿水平方向拖动，上下分屏沿垂直方向拖动。调整大小后重新观察截图。任务要求保留双应用分屏时，避免将分隔条拖到屏幕边缘导致退出分屏，并保持任务要求的应用顺序和分屏方向。';
  if(publicContext)system+='\n'+installedAppPrompt(o.installedApps)+'\n每步观察中的公开执行反馈只说明上一动作是否执行，不提供任务判定或答案。打开失败时检查应用清单并更正参数，不要反复尝试不存在的名称。';
  if(fixedUnfolded)system=system.replace('姿态由环境控制，变化后以当前截图为准。','本轮全程保持展开态内屏，不会注入姿态变化。');
  if(unfoldedStatic) {
    system=system.replace('受手机屏幕尺寸、分屏窗格大小或屏幕键盘占用空间的限制','受展开态手机屏幕尺寸或屏幕键盘占用空间的限制');
    system+='\n本轮评测为固定展开态、单应用全屏。跨应用任务按顺序使用 open、桌面或最近任务切换；无需先关闭前一个应用。应用内部的列表—详情、侧栏或多列属于同一个应用，可以正常操作。不得建立双应用分屏、悬浮窗或调整系统窗口；不要尝试折叠、展开、半折叠或恢复干预。';
  }
  if(unfoldedMultiWindow)system+='\n本轮评测为固定展开态双应用任务，允许左右、上下分屏以及按任务要求建立或关闭窗格。任务已经提供分屏时，优先在相应窗格中操作；要求新建分屏时，通过可见手势和方向切换按钮建立。以任务指定的应用顺序、读取/编辑布局和最终状态为准；有些任务完成后要求只保留目标应用全屏。不要尝试折叠、半折叠、悬浮窗或恢复干预。';
  return observationMessages(o,instruction,history,screenshot,system);
}

function observationMessages(o,instruction,history,screenshot,system) {
  const toolsOnly=o.promptDetail==='tools-only';
  const publicContext=!o.promptVersion||o.promptVersion==='v4';
  const fixedUnfolded=[UNFOLDED_STATIC,UNFOLDED_MULTI_WINDOW].includes(o.benchmarkProfile);
  const allowFold=o.allowFold===true;
  const messages=[{role:'system',content:system}];
  for(const item of o.visionHistory>0?history.slice(-o.visionHistory):[]) {
    if(!item.screenshot)continue;
    messages.push({role:'user',content:[{type:'text',text:`历史第 ${item.step} 步操作前截图，仅供回忆，不是当前画面。`},{type:'image_url',image_url:{url:`data:image/jpeg;base64,${item.screenshot}`}}]},
      {role:'assistant',content:item.response||item.summary});
  }
  messages.push({role:'user',content:[
    {type:'text',text:`完整任务：${instruction}\n\n最近操作${publicContext?'及公开执行反馈':''}：\n${history.length?history.map(item=>`第 ${item.step} 步：${item.summary}${publicContext&&item.public_result?`\n公开执行反馈：${publicFeedbackMessage(item.public_result,o.promptDetail)}`:''}`).join('\n'):'无，这是第一步。'}${allowFold?`\n\n本轮允许 fold（折叠）和 unfold（展开），其他字段填 null。${o.currentPosture==='folded'?'当前为折叠态外屏。':o.currentPosture==='unfolded'?'当前为展开态内屏。':''}${toolsOnly?'':'依据截图和任务需要决定是否切换；每次切换后重新定位。'}`:''}\n\n${coordinateReminder(screenshot,fixedUnfolded)}\n\n下面是当前截图。选择完成任务的下一步，只输出一个动作 JSON。`},
    {type:'image_url',image_url:{url:`data:image/jpeg;base64,${screenshot}`}},
  ]});
  return messages;
}

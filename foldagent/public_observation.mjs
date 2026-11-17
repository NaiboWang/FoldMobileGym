import {resolveOpenAppText} from '../foldagent_runtime/browser_executor.mjs';

// Only this public app-directory projection may leave the browser for the prompt.
// Never return the simulator state, app contents, routes, DOM or evaluator data.
export async function readInstalledApps(cdp) {
  const apps=await cdp.eval(`(() => {
    const apps=window.__SIM__?.getState?.()?.os?.installedApps;
    return Array.isArray(apps)?apps.map(({id,name})=>({id,name})):null;
  })()`);
  return normalizeInstalledApps(apps);
}

// Physical device status only; never expose getState() or application contents.
export async function readPublicPosture(cdp) {
  const posture=await cdp.eval('window.__FOLDAGENT__?.getState?.()?.posture');
  if(!['folded','unfolded'].includes(posture))throw Error('Public fold/unfold device posture is unavailable');
  return posture;
}

export function normalizeInstalledApps(apps) {
  if(!Array.isArray(apps)||!apps.length)throw Error('Public installed-app directory is unavailable');
  const byId=new Map();
  for(const app of apps) {
    if(typeof app?.id!=='string'||!/^[a-z][a-z0-9_]*$/.test(app.id)||typeof app.name!=='string'||!app.name.trim())
      throw Error('Invalid entry in public installed-app directory');
    byId.set(app.id,{id:app.id,name:app.name.trim()});
  }
  return [...byId.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}

export function installedAppPrompt(apps) {
  const list=normalizeInstalledApps(apps);
  return `当前模拟器实际安装的应用（名称 → open 的规范 text 参数）：\n${list.map(app=>`- ${JSON.stringify(app.name)} → open(text=${JSON.stringify(app.id)})`).join('\n')}
open(text=...) 只是参数示意，实际仍输出动作 JSON：action="open"、text 为上表中的 ID，其余字段为 null。
只使用上表列出的应用 ID，不要自行猜测其他产品名称。应用清单仅说明可以打开哪些应用，具体操作仍须遵守任务限制。`;
}

// Explicit allowlist: do not serialize record.params, target, action IDs, errors,
// report fields or readiness/DOM details. Success means dispatch, not task success.
export function publicActionResult(action,record,installedApps,options={}) {
  const result=detailedActionResult(action,record,installedApps);
  return {...result,message:publicFeedbackMessage(result,options.promptDetail)};
}

// Keep the same public error categories, without corrective strategies in the
// tools-only condition. Also used when rendering previously recorded history.
export function publicFeedbackMessage(result,promptDetail='detailed') {
  if(promptDetail!=='tools-only')return result.message;
  const messages={
    posture_not_allowed:'折叠/展开未执行：本轮未启用主动折叠工具，或任务策略不允许。',
    app_not_installed:'打开失败：请求的应用不在已安装应用清单中。',
    app_open_failed:'打开失败：该应用已安装，但未能确认打开就绪。',
    invalid_action:'动作未执行：输出格式或动作参数无效。',
    invalid_coordinate:'动作未执行：坐标无效。坐标范围为当前截图的 0–1000。',
    no_editable_focus:'输入未执行：当前没有聚焦可编辑的输入框。',
    invalid_input:'输入未执行：内容格式不适用于当前日期或时间输入框。',
    input_rejected:'输入未被当前输入框接受。',
    system_button_unavailable:'系统按键未执行：当前环境不支持该按键。',
    execution_error:'动作执行发生错误，效果未确认。',
    posture_unavailable:'折叠/展开未执行：模拟器接口不可用。',
    action_failed:'动作未成功执行。',
    unconfirmed:'动作执行状态未确认。',
    folded:'屏幕现为折叠态外屏；不表示任务已经完成或判题通过。',
    unfolded:'屏幕现为展开态内屏；不表示任务已经完成或判题通过。',
    executed:'动作已执行；不表示任务已经完成或判题通过。',
  };
  return messages[result.code]||messages.unconfirmed;
}

function detailedActionResult(action,record,installedApps) {
  const failed=(code,message)=>({status:'failed',code,message});
  if(record?.valid===false) {
    if(['fold','unfold'].includes(action?.action)&&['fold','unfold'].includes(record.id))
      return failed('posture_not_allowed','折叠/展开未执行：本轮未启用主动折叠工具，或任务策略不允许。');
    if(action?.action==='open'&&['agent.unknown_app','agent.open_app_failed'].includes(record.id)) {
      const requested=String(action.text||'').trim();
      const id=resolveOpenAppText(requested);
      if(!installedApps.some(app=>app.id===id))
        return failed('app_not_installed',`打开失败：不存在名为 ${JSON.stringify(requested.slice(0,120))} 的已安装应用。请使用应用清单中的规范 text 参数。`);
      return failed('app_open_failed','打开失败：该应用已安装，但未能确认打开就绪。请根据当前截图重新选择操作。');
    }
    const messages={
      'agent.invalid':['invalid_action','动作未执行：输出格式或动作参数无效，请按动作 JSON 格式重新选择操作。'],
      'agent.invalid_coordinate':['invalid_coordinate','动作未执行：坐标无效，请使用当前截图的 0–1000 归一化坐标。'],
      'agent.no_editable_focus':['no_editable_focus','输入未执行：当前没有聚焦可编辑的输入框。请先点击输入框，并确认光标或选区位置。'],
      'agent.invalid_native_input':['invalid_input','输入未执行：内容格式不适用于当前日期或时间输入框，请检查格式。'],
      'agent.native_input_rejected':['input_rejected','输入未被接受：请检查当前输入框及输入格式。'],
      'agent.system_button_unavailable':['system_button_unavailable','系统按键未执行：当前环境不支持该按键。'],
      'agent.execution_error':['execution_error','动作执行发生错误，效果未确认；请依据当前截图重新选择操作。'],
      'agent.posture_unavailable':['posture_unavailable','折叠/展开未执行：模拟器接口不可用，请使用支持主动折叠工具的最新服务。'],
    };
    const info=messages[record.id];
    return info?failed(...info):failed('action_failed','动作未成功执行；请依据当前截图重新选择操作。');
  }
  if(record?.valid!==true)return failed('unconfirmed','动作执行状态未确认；请依据当前截图判断。');
  if(['fold','unfold'].includes(action?.action)) {
    const posture=action.action==='fold'?'折叠态外屏':'展开态内屏';
    return {status:'executed',code:action.action==='fold'?'folded':'unfolded',
      message:`屏幕现为${posture}。请重新观察当前截图并定位；这不表示任务已经完成或判题通过。`};
  }
  return {status:'executed',code:'executed',message:'动作已执行；请依据当前截图确认效果。这不表示任务已经完成或判题通过。'};
}

#!/usr/bin/env node
/** Small screenshot-only GPT scaffold sharing FoldAgent's real controller/executor. */
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  resolveBrowserExecutable,resolvePythonExecutable,startEpisode,captureAgentScreen,
  executeAction,waitForActiveAppReady,applyRunnerInteractionChecks,irrecoverableEvaluatorLimit,
} from '../foldagent_runtime/browser_executor.mjs';
import {callModel,buildRequest,requestEvidence,API_PROTOCOL_VERSION} from './api.mjs';
import {modelMessages,validatePromptDetail} from './prompts.mjs';
import {readInstalledApps,readPublicPosture,publicActionResult} from './public_observation.mjs';
import {isFixedUnfolded,isUnfoldedMultiWindow,validateTaskProfile,installTaskProfileGuard} from './task_profiles.mjs';
export {modelMessages} from './prompts.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const require=createRequire(path.join(ROOT,'foldmobilegym/package.json'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const json=value=>JSON.stringify(value);
export const HELP=`FoldMobileGym screenshot agent (run commands from the repository root)

node foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --check
node --env-file=foldagent/.env foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --headed

Choose exactly one input:
  --task ID                 Optional registered task in foldagent_runtime/tasks/converted (not bundled)
  --task-file PATH          Custom executable v2 task (requires --seed-file PATH)
  --episode-file PATH       Existing frozen episode.json (no seed/instance overrides)
Options:
  --instance ID             Registered instance (default base) / custom label
  --run-seed N              Posture protocol seed, default 0; 0 unfolded, 1 folded
  --check                   Initialize, verify, save screenshot; no model API request
  --headed                  Show a separate disposable browser window
  --env-url URL             Default http://127.0.0.1:3100/
  --model ID                Otherwise OPENAI_MODEL; required except --check
  --base-url URL            Otherwise OPENAI_BASE_URL or https://api.openai.com/v1
  --api MODE                responses (default) or chat-completions
  --max-steps N             Default 24
  --vision-history N        Previous screenshot turns, default 6, range 0..12
  --prompt-version v1|v2|v3|v4 Default v4: installed apps and public action feedback
  --prompt-detail MODE      detailed (default) or tools-only (v4 only)
  --max-output-tokens N     Default 4096, includes reasoning tokens
  --reasoning-effort VALUE  Optional: only set if your selected model supports it
  --api-timeout-ms N        Default 120000 per request
  --retries N               Transient API retries, default 2, range 0..3
  --page-ready-timeout-ms N  Default 60000
  --allow-split             Experimental user-level split gestures; separate protocol
  --allow-fold              Enable agent fold/unfold tools (v4, no fixed-unfolded profile or scheduled events)
  --output-dir PATH         New/empty run directory; default foldagent/runs/<unique-id>

Set OPENAI_API_KEY in the environment or with Node --env-file=foldagent/.env.
FOLDAGENT_PYTHON_PATH / FOLDAGENT_BROWSER_PATH override executable discovery (relative paths resolve from the repository root).
Exit codes: 0 successful check/task; 1 infrastructure/setup/API error;
            2 evaluated but unsuccessful; 3 judge outcome unproven.
Read foldagent/README_ZH.md for task formats, traces, and limitations.`;

export function parseArgs(args,env=process.env) {
  const o={envUrl:'http://127.0.0.1:3100/',model:env.OPENAI_MODEL||'',baseUrl:env.OPENAI_BASE_URL||'https://api.openai.com/v1',
    api:env.FOLDAGENT_API||'responses',promptVersion:'v4',promptDetail:'detailed',maxSteps:24,visionHistory:6,maxOutputTokens:4096,apiTimeoutMs:120000,retries:2,pageReadyTimeoutMs:60000};
  const keys={'--task':'task','--task-file':'taskFile','--seed-file':'seedFile','--episode-file':'episodeFile','--instance':'instance','--run-seed':'runSeed',
    '--env-url':'envUrl','--model':'model','--base-url':'baseUrl','--api':'api','--max-steps':'maxSteps','--vision-history':'visionHistory',
    '--max-output-tokens':'maxOutputTokens','--reasoning-effort':'reasoningEffort','--api-timeout-ms':'apiTimeoutMs','--retries':'retries',
    '--page-ready-timeout-ms':'pageReadyTimeoutMs','--output-dir':'outputDir','--prompt-version':'promptVersion','--prompt-detail':'promptDetail'};
  const flags={'--check':'check','--headed':'headed','--allow-split':'allowSplit','--allow-fold':'allowFold'};
  const numbers={maxSteps:[1,1000],visionHistory:[0,12],maxOutputTokens:[16,128000],apiTimeoutMs:[1000,600000],retries:[0,3],pageReadyTimeoutMs:[1000,300000],runSeed:[0,Number.MAX_SAFE_INTEGER]};
  const seen=new Set();
  for(let i=0;i<args.length;i++) {
    const key=args[i];if(['--help','-h'].includes(key))return {help:true};
    if(seen.has(key))throw Error('Duplicate option: '+key);seen.add(key);
    if(flags[key]){o[flags[key]]=true;continue;}
    if(!keys[key])throw Error('Unknown option: '+key);
    const v=args[++i];if(v==null||!v.trim()||v.startsWith('--'))throw Error('Missing value: '+key);
    o[keys[key]]=numbers[keys[key]]?Number(v):v;
  }
  if(['task','taskFile','episodeFile'].filter(k=>o[k]).length!==1)throw Error('Choose exactly one: --task, --task-file, --episode-file');
  if(Boolean(o.taskFile)!==Boolean(o.seedFile))throw Error('--task-file and --seed-file must be supplied together');
  if(o.episodeFile&&(o.instance!==undefined||o.runSeed!==undefined))throw Error('Frozen episodes do not accept instance/run-seed overrides');
  for(const [key,[min,max]] of Object.entries(numbers))if(o[key]!==undefined&&(!Number.isSafeInteger(o[key])||o[key]<min||o[key]>max))throw Error(`Invalid ${key}: expected integer ${min}..${max}`);
  if(!['responses','chat-completions'].includes(o.api))throw Error('--api must be responses or chat-completions');
  if(!['v1','v2','v3','v4'].includes(o.promptVersion))throw Error('--prompt-version must be v1, v2, v3 or v4');
  validatePromptDetail(o);
  if(o.allowFold&&o.promptVersion!=='v4')throw Error('--allow-fold requires v4 prompts');
  for(const key of ['envUrl','baseUrl']) {
    const url=new URL(o[key]);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||(key==='baseUrl'&&url.search))throw Error(`Invalid ${key}; use an HTTP(S) URL without credentials`);
  }
  o.baseUrl=o.baseUrl.replace(/\/+$/,'');
  if(/\/(responses|chat\/completions)$/.test(o.baseUrl))throw Error('--base-url must end at the API base (e.g. /v1), not /responses or /chat/completions');
  if(!o.check&&!o.model.trim())throw Error('Set OPENAI_MODEL or --model to a vision-capable model');
  return o;
}

export function materializeInput(o) {
  const args=[path.join(import.meta.dirname,'prepare_episode.py')];
  for(const [key,flag] of Object.entries({task:'--task',taskFile:'--task-file',seedFile:'--seed-file',episodeFile:'--episode-file',instance:'--instance',runSeed:'--run-seed'}))
    if(o[key]!==undefined)args.push(flag,String(o[key]));
  const text=execFileSync(resolvePythonExecutable(),args,{cwd:process.cwd(),encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONUTF8:'1'},maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
  return JSON.parse(text);
}

function viewer(out,task,trajectory,result,redact) {
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const {benchmark_report,...overview}=result;
  overview.judge_checks=benchmark_report?{target_checks:benchmark_report.target_checks,safety_checks:benchmark_report.safety_checks,
    event_coverage:benchmark_report.event_coverage,post_transition_action:benchmark_report.post_transition_action,
    runner_checks:benchmark_report.runner_checks}:null;
  const html=`<!doctype html><meta charset="utf-8"><title>FoldAgent run</title>
<style>body{max-width:1100px;margin:30px auto;font:16px system-ui;padding:0 15px}pre{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:47%;max-height:700px;object-fit:contain}article{border-top:1px solid #ccc;padding:18px 0}</style>
<h1>${esc(task.id)}</h1><p>${esc(task.instruction)}</p><pre>${esc(JSON.stringify(overview,null,2))}</pre>
<p><a href="screenshots/initial.jpg">Initial screenshot</a> · <a href="result.json">Result JSON</a></p>
${trajectory.map(step=>`<article><h2>Step ${step.step}</h2><pre>${esc(JSON.stringify({action:step.parsed_action,response:step.response,public_result:step.public_result,passed_after_step:step.passed_after_step,fired_events:step.fired_events},null,2))}</pre><a href="${esc(step.screenshot)}"><img src="${esc(step.screenshot)}"></a>${step.screenshot_after?`<a href="${esc(step.screenshot_after)}"><img src="${esc(step.screenshot_after)}"></a>`:''}</article>`).join('')}`;
  fs.writeFileSync(path.join(out,'trajectory.html'),redact(html),'utf8');
}

export async function run(o) {
  o={...o,promptDetail:validatePromptDetail(o)};
  const apiKey=process.env.OPENAI_API_KEY||'';
  if(!o.check&&(!apiKey||apiKey==='replace_with_your_api_key'))throw Error('Set your OPENAI_API_KEY (environment or Node --env-file); --check does not require a key');
  let episode;
  try {episode=materializeInput(o);} catch(error) {throw Error(`Task preparation failed: ${String(error.stderr||error.message)}`);}
  validateTaskProfile(episode.task,o);
  if(isUnfoldedMultiWindow(episode.task))o={...o,allowSplit:true};
  const browserPath=resolveBrowserExecutable();
  const out=path.resolve(o.outputDir||path.join(import.meta.dirname,'runs',`${new Date().toISOString().replace(/[:.]/g,'')}_${episode.task.id}_${process.pid}`));
  if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Output directory must be new or empty: '+out);
  fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});fs.mkdirSync(path.join(out,'responses'),{recursive:true});fs.mkdirSync(path.join(out,'requests'),{recursive:true});
  const redact=s=>apiKey?String(s).split(apiKey).join('[REDACTED]'):String(s);
  const save=(name,value)=>fs.writeFileSync(path.join(out,name),redact(JSON.stringify(value,null,2))+'\n','utf8');
  const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const config={...o,browserPath,api_protocol_version:API_PROTOCOL_VERSION,source_sha256:{runner:digest(import.meta.filename),api:digest(path.join(import.meta.dirname,'api.mjs')),prompts:digest(path.join(import.meta.dirname,'prompts.mjs')),public_observation:digest(path.join(import.meta.dirname,'public_observation.mjs')),adapter:digest(path.join(ROOT,'foldagent_runtime/browser_executor.mjs'))},
    prompt_name:`gpt_api_${o.promptVersion||'v4'}${isFixedUnfolded(episode.task)?'_'+episode.task.metadata.benchmark_profile:o.allowSplit?'_split_experimental':''}${o.allowFold?'_active_fold_v1':''}${o.promptDetail==='tools-only'?'_tools_only_v1':''}`,system_prompt:null,system_prompt_sha256:null,installed_apps:null};
  config.source_sha256.prompts_tools_only=digest(path.join(import.meta.dirname,'prompts_tools_only.mjs'));
  config.source_sha256.task_profiles=digest(path.join(import.meta.dirname,'task_profiles.mjs'));
  save('episode.json',episode);save('config.json',config);
  const trajectory=[],history=[],runtimeErrors=[];
  const result={schema_version:'foldagent.simple_gpt_run.v1',task_id:episode.task.id,task_hash:episode.task_hash,seed_hash:episode.seed_hash,
    run_metadata:episode.run_metadata,run_status:'starting',started_at:new Date().toISOString(),model:o.model||null,api:o.api,
    prompt_name:config.prompt_name,prompt_detail:o.promptDetail,system_prompt_sha256:null,passed:null,benchmark_report:null,termination:null,api_requests:0,usage:[]};
  let browser,browserUserDataDir,page,cdp,started=false,stage='browser_start',exitCode=1;
  const shot=async name=>{
    // Controller.flush can return while CSS posture/viewport transitions are still running.
    // Never feed an intermediate layout to the model or reuse its stale coordinates.
    const deadline=Date.now()+10000;
    while(true)try {
      const s=await captureAgentScreen(cdp);
      fs.writeFileSync(path.join(out,'screenshots',name),Buffer.from(s.data,'base64'));return s;
    }catch(error){
      if(error.message!=='Invalid screen capture bounds'||Date.now()>=deadline)throw error;
      await delay(100);
    }
  };
  try {
    browserUserDataDir=fs.mkdtempSync(path.join(tmpdir(),'foldagent-browser-'));
    browser=await require('puppeteer').launch({headless:!o.headed,executablePath:browserPath,userDataDir:browserUserDataDir,args:['--disable-gpu','--no-first-run','--no-default-browser-check','--mute-audio','--no-sandbox'],defaultViewport:{width:1140,height:1250,deviceScaleFactor:1}});
    page=await browser.newPage();
    // Local diagnostics only: these errors never enter the model's observation.
    page.on('pageerror',error=>runtimeErrors.push({kind:'pageerror',stage,step:trajectory.at(-1)?.step??0,message:redact(error.message)}));
    page.on('error',error=>runtimeErrors.push({kind:'page_crash',stage,step:trajectory.at(-1)?.step??0,message:redact(error.message)}));
    const session=await page.createCDPSession();
    cdp={send:(...args)=>session.send(...args),eval:expression=>page.evaluate(expression)};
    stage='page_ready';const url=new URL(o.envUrl);url.searchParams.set('foldagent_benchmark','1');
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:o.pageReadyTimeoutMs});
    await page.waitForFunction(()=>document.readyState==='complete'&&window.__SIM__&&window.__FOLDAGENT_BENCH__,{timeout:o.pageReadyTimeoutMs});
    if(await page.$('.foldagent-demo-panel, .foldagent-page-brand'))throw Error('Presentation controls leaked into the benchmark observation');
    stage='task_start';const initial=await startEpisode(cdp,episode,o);started=true;save('initial_report.json',initial);
    await installTaskProfileGuard(cdp,episode.task);
    const ready=await waitForActiveAppReady(cdp,episode.task.initial_window.focused_app,o.pageReadyTimeoutMs);
    if(!ready.ready)throw Error('Initial app did not become interactive');
    stage='public_app_directory';
    const installedApps=await readInstalledApps(cdp);
    const promptOptions={...o,installedApps,benchmarkProfile:isFixedUnfolded(episode.task)?episode.task.metadata.benchmark_profile:undefined};
    config.installed_apps=installedApps;
    config.system_prompt=modelMessages(promptOptions,episode.task.instruction,[],'')[0].content;
    config.system_prompt_sha256=createHash('sha256').update(config.system_prompt).digest('hex');
    result.system_prompt_sha256=config.system_prompt_sha256;
    save('config.json',config);
    await shot('initial.jpg');
    if(initial.passed===true)throw Error('Task is already passed at initialization; revise fixture/success rules before spending API calls');
    console.log(`Task ${episode.task.id}; output ${out}`);
    if(o.check) {result.run_status='preflight_passed';result.termination={status:'check_only'};exitCode=0;}
    else {
      result.termination={status:'max_steps'};
      for(let step=1;step<=o.maxSteps;step++) {
        stage='observation';const tag=String(step).padStart(3,'0');const screenshot=`screenshots/step_${tag}_before.jpg`;
        const observation=await shot(`step_${tag}_before.jpg`);
        const entry={step,screenshot,screen_bounds_css:observation.bounds};trajectory.push(entry);save('trajectory.json',trajectory);
        stage='model_api';
        let decision;
        const currentPrompt=o.allowFold?{...promptOptions,currentPosture:await readPublicPosture(cdp)}:promptOptions;
        const messages=modelMessages(currentPrompt,episode.task.instruction,history.slice(-12),observation.data);
        save(`requests/step_${tag}.json`,requestEvidence(buildRequest(o,messages)));
        try {decision=await callModel({...o,apiKey},messages);}
        catch(error){result.api_requests+=error.attempts||0;entry.api_attempts=error.attempts||0;if(error.apiPayload)save(`responses/step_${tag}_error.json`,error.apiPayload);throw error;}
        result.api_requests+=decision.attempts;result.usage.push({step,...decision.usage});
        save(`responses/step_${tag}.json`,decision.payload);
        Object.assign(entry,{response:decision.raw,parsed_action:decision.action||null,parse_error:decision.parseError||null,api_attempts:decision.attempts,usage:decision.usage});save('trajectory.json',trajectory);
        stage='action';let record;
        if(!decision.action)record={id:'agent.invalid',kind:'invalid',params:{error:decision.parseError},valid:false,terminal:false};
        else try {record=await executeAction(cdp,decision.action,{screenBounds:observation.bounds,allowFold:o.allowFold===true});}
        catch(error){record={id:'agent.execution_error',kind:'invalid',params:{error:redact(error.message)},valid:false,terminal:false};}
        const publicResult=publicActionResult(decision.action,record,installedApps,o);
        entry.public_result=publicResult;
        await delay(decision.action?.action==='type'?1100:700);
        stage='judge';await cdp.eval(`window.__FOLDAGENT_BENCH__.recordAgentAction(${json(record)})`);
        const report=applyRunnerInteractionChecks(episode.task,await cdp.eval('window.__FOLDAGENT_BENCH__.flush()'));
        if(report.task_id!==episode.task.id || report.episode?.task_hash!==episode.task_hash)
          throw Error('Simulator episode was replaced or lost (for example by a development server reload); discard this run and restart against a stable build.');
        Object.assign(entry,{benchmark_action:record,passed_after_step:report.passed,fired_events:report.fired_events});
        save('trajectory.json',trajectory);save('latest_report.json',report);
        stage='post_action_observation';await shot(`step_${tag}_after.jpg`);
        entry.screenshot_after=`screenshots/step_${tag}_after.jpg`;save('trajectory.json',trajectory);
        const summary=decision.action?JSON.stringify(decision.action):`Invalid output: ${decision.parseError}`;
        history.push({step,summary,screenshot:observation.data,response:decision.raw,public_result:publicResult});if(history.length>12)history.shift();
        console.log(`step ${step}: ${summary}; judge=${report.passed}`);
        if(record.terminal){result.termination={status:record.params.status,step};break;}
        const limit=irrecoverableEvaluatorLimit(episode.task,report);
        if(limit){result.termination={status:'policy_limit',step,reason:limit};break;}
      }
      stage='final_judge';result.benchmark_report=applyRunnerInteractionChecks(episode.task,await cdp.eval('window.__FOLDAGENT_BENCH__.flush()'));
      if(result.benchmark_report.task_id!==episode.task.id || result.benchmark_report.episode?.task_hash!==episode.task_hash)
        throw Error('Simulator episode identity changed before final judgment.');
      result.passed=result.benchmark_report.passed;result.run_status='completed';exitCode=result.passed===true?0:result.passed===null?3:2;
    }
  } catch(error) {
    result.run_status='error';result.error={stage,message:redact(error.message)};
    result.termination={status:'error',stage};
    if(started)try {result.benchmark_report=applyRunnerInteractionChecks(episode.task,await cdp.eval('window.__FOLDAGENT_BENCH__.flush()'));}catch{}
    // An interrupted transport/setup run is not scored as an agent failure or success.
    result.passed=null;exitCode=1;
  } finally {
    if(started&&cdp)try {await shot('final.jpg');}catch{}
    if(browser)try {await browser.close();}catch(error){result.cleanup_error=redact(error.message);}
    if(browserUserDataDir)try {fs.rmSync(browserUserDataDir,{recursive:true,force:true});}catch(error){result.cleanup_error??=redact(error.message);}
    result.finished_at=new Date().toISOString();result.exit_code=exitCode;
    result.runtime_error_count=runtimeErrors.length;save('runtime_errors.json',runtimeErrors);
    save('trajectory.json',trajectory);save('result.json',result);viewer(out,episode.task,trajectory,result,redact);
  }
  console.log(JSON.stringify({output_dir:out,run_status:result.run_status,passed:result.passed,termination:result.termination,error:result.error},null,2));
  return {exitCode,out,result};
}

if(path.resolve(process.argv[1]||'')===path.resolve(import.meta.filename)) {
  try {const o=parseArgs(process.argv.slice(2));if(o.help)console.log(HELP);else process.exitCode=(await run(o)).exitCode;}
  catch(error){const key=process.env.OPENAI_API_KEY;console.error(key?String(error.message).split(key).join('[REDACTED]'):error.message);process.exitCode=1;}
}

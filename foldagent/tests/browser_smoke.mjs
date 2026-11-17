/** Local scripted API + real simulator/browser. No paid API or model ability claim.
 * DOM geometry is used ONLY here to calibrate deterministic test clicks.
 * foldagent/run.mjs never supplies DOM, evaluator, fixture, or calibration to GPT.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {parseArgs,materializeInput,run} from '../run.mjs';
import {resolveBrowserExecutable,startEpisode,waitForActiveAppReady,executeAction,captureAgentScreen} from '../../foldagent_runtime/browser_executor.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'foldmobilegym/package.json'));
const envUrl=process.argv[2]==='--env-url'?process.argv[3]:'http://127.0.0.1:3100/';
const out=path.join(root,'foldagent/runs',`smoke_${Date.now()}`);
const examples=path.join(root,'foldagent/examples');
const input=['--task-file',path.join(examples,'calculator.task.json'),'--seed-file',path.join(examples,'calculator.seed.json')];
const fullAction=partial=>({coordinate:null,coordinate2:null,text:null,button:null,time:null,status:null,...partial});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
let active,server,calibrationBrowser;
const previousKey=process.env.OPENAI_API_KEY;
const summary=[];
fs.mkdirSync(out,{recursive:true});

try {
  process.env.OPENAI_API_KEY='local-smoke-key';
  // Measure the visible buttons in both layouts; no mutation of calculator answers.
  calibrationBrowser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable(),
    args:['--disable-gpu','--no-first-run','--no-default-browser-check','--mute-audio','--no-sandbox'],
    defaultViewport:{width:1140,height:1250,deviceScaleFactor:1}});
  const page=await calibrationBrowser.newPage();
  const url=new URL(envUrl);url.searchParams.set('foldagent_benchmark','1');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__SIM__&&window.__FOLDAGENT_BENCH__,{timeout:60000});
  const session=await page.createCDPSession();const cdp={send:(...args)=>session.send(...args),eval:expression=>page.evaluate(expression)};
  const coords={};
  for(const seed of [0,1]){
    const episode=materializeInput(parseArgs([...input,'--check','--run-seed',String(seed)]));
    await startEpisode(cdp,episode);assert.equal((await waitForActiveAppReady(cdp,'calculator',60000)).ready,true);
    coords[seed]=await page.evaluate(()=>{
      const root=document.getElementById('root').getBoundingClientRect();
      return Object.fromEntries([...document.querySelectorAll('.calculator-reference button')].map(button=>{
        const rect=button.getBoundingClientRect();return [button.textContent.trim(),[(rect.x+rect.width/2-root.x)/root.width*1000,(rect.y+rect.height/2-root.y)/root.height*1000]];
      }));
    });
  }
  // A transport flag alone cannot authorize a run whose controller disallows it.
  assert.equal((await executeAction(cdp,fullAction({action:'unfold'}),{allowFold:true})).valid,false);
  assert.equal(await page.evaluate(()=>window.__FOLDAGENT__.getState().posture),'folded');
  summary.push({case:'controller_denies_without_run_authorization',passed:true});
  for(const orientation of ['side_by_side','stacked']) {
    const episode=materializeInput(parseArgs([...input,'--check']));
    const task=structuredClone(episode.task);
    task.apps=['calculator','notes'];
    task.initial_window={...task.initial_window,mode:'split',split_apps:task.apps,split_orientation:orientation,divider_ratio:0.6};
    await page.evaluate(({task,seed})=>window.__FOLDAGENT_BENCH__.start(task,{seedState:seed,automatic:false,allowAgentPosture:true}),{task,seed:episode.seed_state});
    const before=await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window);
    for(const [index,name] of ['fold','fold','unfold'].entries()) {
      const record=await executeAction(cdp,fullAction({action:name}),{allowFold:true});
      assert.equal(record.valid,true);
      const report=await page.evaluate(async record=>{
        window.__FOLDAGENT_BENCH__.recordAgentAction(record);
        return await window.__FOLDAGENT_BENCH__.flush();
      },record);
      const current=await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window);
      assert.equal(current.primary_task_id,before.primary_task_id);
      assert.equal(current.secondary_task_id,before.secondary_task_id);
      assert.equal(current.divider_ratio,before.divider_ratio);
      assert.equal(current.split_orientation,index===2?orientation:'stacked');
      assert.equal(report.step,index+1,'Each device action must be recorded exactly once');
      assert.equal(report.violation_counts.forbidden_actions,0);
      assert.equal(report.action_trace.at(-1).effectful,index!==1);
      if(index!==1)assert.notEqual(report.action_trace.at(-1).pre_state_hash,report.action_trace.at(-1).post_state_hash);
      assert.deepEqual(report.agent_posture_control,{enabled:true,actions:index+1,changes:index===2?2:1});
      await page.waitForFunction(()=>!document.getElementById('root').getAnimations().length);
      const screenshot=await captureAgentScreen(cdp);
      fs.writeFileSync(path.join(out,`split_${orientation}_${index}_${name}.jpg`),Buffer.from(screenshot.data,'base64'));
    }
    // Failed policy validation must not reset the running applications.
    for(const change of [{metadata:{benchmark_profile:'unfolded_static_v1'}},{event_plan:[{controller:'benchmark'}]}]) {
      const rejected=await page.evaluate(async task=>{
        try {await window.__FOLDAGENT_BENCH__.start(task,{allowAgentPosture:true});return false;}
        catch {return true;}
      },{...task,...change});
      assert.equal(rejected,true);
      assert.equal(await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window.primary_task_id),before.primary_task_id);
    }
    await page.evaluate(()=>window.__FOLDAGENT_BENCH__.stop());
    assert.equal((await executeAction(cdp,fullAction({action:'fold'}),{allowFold:true})).valid,false);
    summary.push({case:'active_split_'+orientation,passed:true});
  }
  await calibrationBrowser.close();calibrationBrowser=null;
  server=http.createServer(async(req,res)=>{
    try {
      let body='';for await(const chunk of req)body+=chunk;
      const request=JSON.parse(body);const index=active.requests.length;active.requests.push(request);
      assert.equal(req.headers.authorization,'Bearer local-smoke-key');
      assert.equal(req.url,active.api==='responses'?'/v1/responses':'/v1/chat/completions');
      assert.equal(body.includes('seed_contract'),false);assert.equal(body.includes('success_all'),false);
      const config=read(path.join(active.dir,'config.json'));
      const instructions=active.api==='responses'?request.instructions:request.messages[0].content;
      assert.equal(instructions,config.system_prompt);
      assert.ok(config.installed_apps.some(app=>app.id==='notes'&&app.name==='笔记'));
      assert.ok(instructions.includes('"笔记" → open(text="notes")'));
      const content=(request.input||request.messages).at(-1).content;
      const schema=active.api==='responses'?request.text.format.schema:request.response_format.json_schema.schema;
      assert.equal(schema.properties.action.enum.includes('fold'),!!active.activeFold);
      assert.equal(schema.properties.action.enum.includes('unfold'),!!active.activeFold);
      if(active.activeFold) {
        assert.ok(content[0].text.includes('本轮允许 fold'));
        assert.ok(content[0].text.includes('完整任务：'));
        let posture='folded';
        for(const action of active.actions.slice(0,index)) {
          if(action.action==='fold')posture='folded';
          if(action.action==='unfold')posture='unfolded';
        }
        assert.ok(content[0].text.includes(posture==='folded'?'当前为折叠态外屏':'当前为展开态内屏'));
        assert.equal(instructions.includes('姿态由环境控制'),false);
      }
      if(index>0) {
        const previous=read(path.join(active.dir,'trajectory.json'))[index-1];
        assert.ok(content[0].text.includes(previous.public_result.message),'Next request must contain the public execution result');
        if(active.appFeedback&&index===1)assert.equal(previous.public_result.code,'app_not_installed');
        if(active.appFeedback&&index===2)assert.equal(previous.public_result.status,'executed');
      }
      const image=content.find(p=>p.type==='input_image'||p.type==='image_url');
      const encoded=typeof image.image_url==='string'?image.image_url:image.image_url.url;
      const recorded=fs.readFileSync(path.join(active.dir,`screenshots/step_${String(index+1).padStart(3,'0')}_before.jpg`)).toString('base64');
      assert.ok(encoded==='data:image/jpeg;base64,'+recorded,'API image must equal the saved before-action screenshot');
      if(active.httpError){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":{"code":"invalid_api_key"}}');return;}
      const action=active.actions[index];assert.ok(action,'Unexpected API request beyond scripted actions');
      const text=JSON.stringify(action);
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(active.api==='responses'
        ?{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:{input_tokens:1,output_tokens:1}}
        :{choices:[{finish_reason:'stop',message:{role:'assistant',content:text}}],usage:{prompt_tokens:1,completion_tokens:1}}));
    }catch(error){active.error=error;res.writeHead(500);res.end('{}');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const baseUrl=`http://127.0.0.1:${server.address().port}/v1`;
  const finish=fullAction({action:'terminate',status:'success'});
  const clicks=fold=>['1','2','+','7','='].map((label,i)=>fullAction({action:'click',coordinate:coords[fold&&i>=3?1:0][label]}));
  // Calculator allows one invalid action; exercise one missing name per run.
  const appActions=missing=>[missing,'notes','calculator'].map(text=>fullAction({action:'open',text}));
  const cases=[
    {name:'preflight',check:true,expected:null,exit:0,actions:[]},
    {name:'false_success',expected:false,exit:2,actions:[finish]},
    {name:'static_calculation',expected:true,exit:0,actions:[...clicks(false),finish]},
    {name:'fold_calculation',fold:true,expected:true,exit:0,actions:[...clicks(true),finish]},
    {name:'chat_calculation',api:'chat-completions',expected:true,exit:0,actions:[...clicks(false),finish]},
    {name:'api_401',httpError:true,expected:null,exit:1,actions:[]},
    {name:'app_feedback_responses',appFeedback:true,visionHistory:0,expected:false,exit:2,actions:[...appActions('Keep'),finish]},
    {name:'app_feedback_chat',appFeedback:true,expected:false,exit:2,api:'chat-completions',actions:[...appActions('Google Keep'),finish]},
    ...['responses','chat-completions'].map(api=>({name:'active_fold_'+api,api,activeFold:true,expected:true,exit:0,
      actions:[fullAction({action:'unfold'}),...['1','2','+'].map(label=>fullAction({action:'click',coordinate:coords[0][label]})),
        fullAction({action:'fold'}),...['7','='].map(label=>fullAction({action:'click',coordinate:coords[1][label]})),
        fullAction({action:'unfold'}),finish]})),
  ];
  for(const sample of cases){
    active={...sample,api:sample.api||'responses',requests:[],dir:path.join(out,sample.name)};
    const args=[...input,'--env-url',envUrl,'--model','local-mock','--base-url',baseUrl,'--api',active.api,'--retries','0','--max-steps',sample.activeFold?'10':'6','--output-dir',active.dir];
    if(sample.fold)args[1]=path.join(examples,'calculator_fold.task.json');
    if(sample.check)args.push('--check');
    if(sample.activeFold)args.push('--allow-fold','--run-seed','1');
    if(sample.visionHistory!==undefined)args.push('--vision-history',String(sample.visionHistory));
    const result=await run(parseArgs(args));
    if(active.error)throw active.error;
    assert.equal(result.exitCode,sample.exit,sample.name+': '+JSON.stringify({status:result.result.run_status,error:result.result.error}));
    assert.equal(result.result.passed,sample.expected);
    assert.equal(active.requests.length,sample.httpError?1:sample.actions.length);
    assert.equal(result.result.api_requests,active.requests.length);
    assert.equal(fs.readFileSync(path.join(active.dir,'config.json'),'utf8').includes('local-smoke-key'),false);
    assert.ok(fs.existsSync(path.join(active.dir,'trajectory.html')));
    if(sample.appFeedback) {
      const trace=read(path.join(active.dir,'trajectory.json'));
      assert.deepEqual(trace.slice(0,3).map(step=>step.public_result.code),['app_not_installed','executed','executed']);
      assert.equal(trace[1].benchmark_action.params.app,'notes');
      assert.equal(trace[1].benchmark_action.valid,true);
    }
    if(sample.fold){
      const trace=read(path.join(active.dir,'trajectory.json'));
      assert.notEqual(trace[0].screen_bounds_css.width,trace[3].screen_bounds_css.width);
      assert.ok(JSON.stringify(result.result.benchmark_report.fired_events).includes('J99.mid.fold'));
    }
    if(sample.activeFold) {
      const report=result.result.benchmark_report;
      const trace=read(path.join(active.dir,'trajectory.json'));
      assert.deepEqual(report.agent_posture_control,{enabled:true,actions:3,changes:3});
      assert.deepEqual(report.fired_events,[]);
      assert.notEqual(trace[0].screen_bounds_css.width,trace[1].screen_bounds_css.width);
      assert.equal(trace[0].screen_bounds_css.width,trace[5].screen_bounds_css.width);
      assert.equal(trace.filter(step=>step.benchmark_action.kind==='device').length,3);
      assert.deepEqual(trace.filter(step=>step.benchmark_action.kind==='device').map(step=>step.public_result.code),['unfolded','folded','unfolded']);
    }
    summary.push({case:sample.name,passed:true,judge:result.result.passed,api_requests:active.requests.length});
  }
  fs.writeFileSync(path.join(out,'smoke_summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({all_passed:true,output_dir:out,cases:summary},null,2));
} finally {
  if(calibrationBrowser)await calibrationBrowser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ACTION_SCHEMA,LEGACY_ACTION_SCHEMA,buildRequest,callModel,readResponse,validateAction,requestEvidence} from '../api.mjs';
import {parseArgs,materializeInput,modelMessages} from '../run.mjs';
import {coordinateReminder,screenshotSize} from '../prompts.mjs';

const action={action:'click',coordinate:[200,300],coordinate2:null,text:null,button:null,time:null,status:null};
const opts={api:'responses',model:'mock-vision',apiKey:'test-key',baseUrl:'http://localhost/v1',maxOutputTokens:4096,apiTimeoutMs:1000,retries:2};
const payload={status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(action)}]}],usage:{input_tokens:20,output_tokens:10}};
const messages=[{role:'system',content:'Read the screen.'},{role:'user',content:[{type:'text',text:'Task'}, {type:'image_url',image_url:{url:'data:image/jpeg;base64,AA=='}}]}];

test('Responses request preserves image and enforces structured action without unsupported temperature',()=>{
  const request=buildRequest(opts,messages);
  assert.equal(request.instructions,'Read the screen.');
  assert.equal(request.input.some(m=>m.role==='system'),false);
  assert.equal(request.input[0].content[1].type,'input_image');
  assert.equal(request.input[0].content[1].image_url,messages[1].content[1].image_url.url);
  assert.equal(request.input[0].content[1].detail,'high');
  assert.deepEqual(request.text.format.schema,ACTION_SCHEMA);
  assert.equal(request.text.format.strict,true);
  assert.equal(request.store,false);
  assert.equal(request.max_output_tokens,4096);
  assert.deepEqual(request.tools,[]);
  assert.equal(request.tool_choice,'none');
  assert.equal('temperature' in request,false);
});

test('Chat Completions uses its own schema and optional reasoning field',()=>{
  const request=buildRequest({...opts,api:'chat-completions',reasoningEffort:'low'},messages);
  assert.deepEqual(request.messages,messages);
  assert.equal(request.response_format.json_schema.strict,true);
  assert.equal(request.reasoning_effort,'low');
  assert.equal(request.max_completion_tokens,4096);
  assert.deepEqual(request.tools,[]);
  assert.equal(request.tool_choice,'none');
  assert.deepEqual(request.response_format.json_schema.schema,ACTION_SCHEMA);
  assert.deepEqual(buildRequest({...opts,api:'chat-completions',promptVersion:'v1'},messages).response_format.json_schema.schema,LEGACY_ACTION_SCHEMA);
  assert.equal(readResponse('chat-completions',{choices:[{finish_reason:'stop',message:{content:JSON.stringify(action)}}]}),JSON.stringify(action));
});

test('Incomplete output and refusal cannot execute as actions',()=>{
  assert.throws(()=>readResponse('responses',{...payload,status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}),/incomplete/);
  assert.throws(()=>readResponse('responses',{...payload,output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'No'}]}]}),/refused/);
  assert.throws(()=>readResponse('chat-completions',{choices:[{finish_reason:'length',message:{content:JSON.stringify(action)}}]}),/length/);
});

test('Responses final_answer stays separate from commentary, including commentary that resembles actions',()=>{
  const message=(phase,text)=>({type:'message',role:'assistant',phase,content:[{type:'output_text',text}]});
  const response={...payload,output:[message('commentary','I will inspect the source.'),message('final_answer',JSON.stringify(action))]};
  assert.deepEqual(validateAction(JSON.parse(readResponse('responses',response))),action);
  response.output[0]=message('commentary',JSON.stringify({...action,coordinate:[10,10]}));
  assert.equal(readResponse('responses',response),JSON.stringify(action));
  assert.throws(()=>readResponse('responses',{...response,output:[response.output[0]]}),/no action text/);
});

test('Only supported actions and screenshot coordinates are executable',()=>{
  assert.deepEqual(validateAction(action),action);
  assert.throws(()=>validateAction({...action,action:'fold'}),/forbidden/);
  assert.throws(()=>validateAction({...action,coordinate:[2000,300]}),/coordinate/);
  assert.throws(()=>validateAction({...action,action:'swipe'}),/coordinate2/);
  assert.throws(()=>validateAction({...action,action:'terminate'}),/success or failure/);
});

test('Extra Responses tool declarations are inert metadata; actual tool outputs are forbidden',async()=>{
  const declared={...payload,tools:[{type:'image_generation'},{type:'function',name:'extra'}]};
  assert.equal(readResponse('responses',declared),JSON.stringify(action));
  const accepted=await callModel(opts,messages,{fetchImpl:async()=>new Response(JSON.stringify(declared))});
  assert.deepEqual(accepted.action,action);
  for(const type of ['function_call','image_generation_call','web_search_call','computer_call','file_search_call','mcp_call','function_call_output','unknown_tool']) {
    for(const tools of [[],declared.tools]) {
      const response={...payload,tools,output:[...payload.output,{type,result:'not executable'}]};
      assert.throws(()=>readResponse('responses',response),{code:'unexpected_model_tools'});
      await assert.rejects(callModel(opts,messages,{fetchImpl:async()=>new Response(JSON.stringify(response))}),error=>
        error.code==='unexpected_model_tools'&&error.attempts===1&&error.apiPayload.output_item_types.includes(type));
    }
  }
});

test('Chat actual tool calls remain forbidden even alongside valid action text',()=>{
  const message={content:JSON.stringify(action)};
  const response={tools:[{type:'function',function:{name:'extra'}}],choices:[{finish_reason:'stop',message}]};
  assert.equal(readResponse('chat-completions',response),JSON.stringify(action));
  for(const call of [{tool_calls:[{type:'function',function:{name:'extra',arguments:'{}'}}]},{function_call:{name:'extra',arguments:'{}'}}]) {
    assert.throws(()=>readResponse('chat-completions',{...response,choices:[{finish_reason:'stop',message:{...message,...call}}]}),{code:'unexpected_model_tools'});
  }
});

test('Authorization and bounded transient retry; credential is not in the request body',async()=>{
  let calls=0;
  const result=await callModel(opts,messages,{delay:async()=>{},fetchImpl:async(url,request)=>{
    calls++;
    assert.equal(url,'http://localhost/v1/responses');
    assert.equal(request.headers.Authorization,'Bearer test-key');
    assert.equal(request.body.includes('test-key'),false);
    return new Response(JSON.stringify(calls===1?{error:{code:'rate_limit'}}:payload),{status:calls===1?429:200});
  }});
  assert.equal(calls,2);assert.equal(result.attempts,2);assert.deepEqual(result.action,action);
});

test('401 is not retried; repeated 5xx exhausts the configured retry budget',async()=>{
  for(const [status,expected] of [[401,1],[503,3]]){
    let calls=0;
    await assert.rejects(callModel(opts,messages,{delay:async()=>{},fetchImpl:async()=>{
      calls++;return new Response('{"error":{"code":"example_error"}}',{status});
    }}),error=>error.httpStatus===status&&error.attempts===expected);
    assert.equal(calls,expected);
  }
});

test('Malformed action counts as an invalid model output, without transport retries',async()=>{
  const result=await callModel(opts,messages,{fetchImpl:async()=>new Response(JSON.stringify({
    ...payload,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"action":"fold"}'}]}],
  }))});
  assert.equal(result.action,undefined);assert.match(result.parseError,/forbidden/);assert.equal(result.attempts,1);
});

test('CLI refuses conflicting sources and frozen-episode overrides; check needs no model',()=>{
  assert.equal(parseArgs(['--task','G04-001','--check'],{}).check,true);
  assert.throws(()=>parseArgs(['--task','G04-001'],{}),/OPENAI_MODEL/);
  assert.throws(()=>parseArgs(['--task','G04-001','--task-file','x','--check'],{}),/exactly one/);
  assert.throws(()=>parseArgs(['--task-file','x','--check'],{}),/seed-file/);
  assert.throws(()=>parseArgs(['--episode-file','x','--run-seed','1','--check'],{}),/overrides/);
  assert.throws(()=>parseArgs(['--task','G04-001','--check','--max-steps','NaN'],{}),/maxSteps/);
});

test('Prompt has one JSON output format; state and judge data are not part of model input',()=>{
  const m=modelMessages({visionHistory:0,promptVersion:'v1'},'Calculate',[],'abc');
  assert.equal(m[0].content.includes('<tool_call>'),false);
  assert.equal(m[0].content.includes('window resizing,'),true);
  const split=modelMessages({visionHistory:0,allowSplit:true,promptVersion:'v1'},'Calculate',[],'abc');
  assert.equal(split[0].content.includes('window resizing,'),false);
  assert.equal(split[0].content.includes('visible user-level split gestures'),true);
});

test('Default prompt repeats task and coordinate rule on every observation, including after folding',()=>{
  const png=(width,height)=>{const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b.toString('base64');};
  const old=png(1247,1350),now=png(602,1350);
  const history=[{step:1,summary:JSON.stringify(action),response:JSON.stringify(action),screenshot:old}];
  const m=modelMessages({visionHistory:1,installedApps:[{id:'notes',name:'笔记'}]},'Preserve this original goal',history,now);
  const current=m.at(-1).content[0].text;
  assert.match(current,/Preserve this original goal/);assert.match(current,/左上角是 \[0,0\]/);assert.match(current,/右下角是 \[1000,1000\]/);
  assert.match(current,/W=602/);assert.match(current,/H=1350/);assert.match(current,/不是原图像素/);assert.match(current,/x=px\/W\*1000/);
  assert.equal(m.at(-1).content[1].image_url.url,`data:image/jpeg;base64,${now}`);
  assert.equal(parseArgs(['--task','G04-001','--check'],{}).promptVersion,'v4');
  assert.deepEqual(screenshotSize(now),{width:602,height:1350});assert.equal(screenshotSize('abc'),null);
  assert.match(coordinateReminder('abc'),/W、H/);
});

test('v3 explains insertion, selection replacement and draft termination; v2 stays reproducible',()=>{
  const latest=modelMessages({visionHistory:0,promptVersion:'v3'},'Draft only',[],'abc');
  const request=buildRequest({...opts,promptVersion:'v3'},latest);
  assert.match(request.instructions,/type 从当前光标处插入，有选区则替换选区/);
  assert.match(request.instructions,/勿重复点击取消选区/);
  assert.match(request.instructions,/无需发送、关闭键盘或寻找完成按钮/);
  assert.match(request.instructions,/action="terminate", status="success"/);
  assert.match(request.instructions,/自报 success 不代替独立判题/);
  const old=modelMessages({visionHistory:0,promptVersion:'v2'},'Draft only',[],'abc');
  assert.match(old[0].content,/输入前先点击正确输入框，输入后检查内容；追加时保留原文。/);
  assert.equal(old[0].content.includes('有选区则替换选区'),false);
});

test('Screenshot dimensions handle baseline/progressive JPEG and malformed headers',()=>{
  for(const marker of [0xc0,0xc2]) {
    const b=Buffer.from([0xff,0xd8,0xff,0xe0,0,4,0,0,0xff,marker,0,11,8,0x05,0x46,0x04,0xdf,1,1,0x11,0,0xff,0xd9]);
    assert.deepEqual(screenshotSize(b.toString('base64')),{width:1247,height:1350});
    assert.equal(screenshotSize(b.subarray(0,16).toString('base64')),null);
  }
});

test('Legacy request remains reproducible; audit retains instructions and hashes images without credentials',()=>{
  const old=buildRequest({...opts,promptVersion:'v1'},messages);
  assert.equal(old.instructions,undefined);assert.equal(old.input[0].role,'system');assert.deepEqual(old.text.format.schema,LEGACY_ACTION_SCHEMA);
  const modern=buildRequest(opts,messages),audit=requestEvidence(modern);
  assert.equal(audit.payload.instructions,'Read the screen.');assert.equal(audit.images.length,1);assert.equal(audit.request_sha256.length,64);
  assert.equal(JSON.stringify(audit).includes('base64,AA=='),false);assert.equal(JSON.stringify(audit).includes(opts.apiKey),false);
  assert.equal(modern.input[0].content[1].image_url,messages[1].content[1].image_url.url);
  assert.equal(ACTION_SCHEMA.properties.coordinate.anyOf[1].items.maximum,1000);
});

test('Example tasks materialize; absent catalogs, tampered frozen episodes and legacy tasks fail clearly',()=>{
  const examples=path.resolve(import.meta.dirname,'../examples');
  const seedFile=path.join(examples,'calculator.seed.json');
  const staticEpisode=materializeInput({taskFile:path.join(examples,'calculator.task.json'),seedFile});
  const foldEpisode=materializeInput({taskFile:path.join(examples,'calculator_fold.task.json'),seedFile,runSeed:1});
  assert.equal(staticEpisode.task.id,'J99-001');
  assert.equal(foldEpisode.task.initial_window.posture,'folded');
  assert.equal(foldEpisode.task.event_plan[0].transition.to_posture,'unfolded');
  assert.throws(()=>materializeInput({task:'G04-001'}),error=>/unknown task_id.*--task-file/.test(String(error.stderr)));
  const folder=path.resolve(import.meta.dirname,'../runs');fs.mkdirSync(folder,{recursive:true});
  const temp=fs.mkdtempSync(path.join(folder,'unit_'));
  const frozen=path.join(temp,'episode.json');fs.writeFileSync(frozen,JSON.stringify(staticEpisode));
  assert.deepEqual(materializeInput({episodeFile:frozen}),staticEpisode);
  staticEpisode.task.instruction+=' tampered';fs.writeFileSync(frozen,JSON.stringify(staticEpisode));
  assert.throws(()=>materializeInput({episodeFile:frozen}),error=>/task_hash mismatch/.test(String(error.stderr)));
  const legacy=path.join(temp,'legacy.json');fs.writeFileSync(legacy,'{"schema_version":"foldagentgym.task.v1"}');
  assert.throws(()=>materializeInput({taskFile:legacy,seedFile}),error=>/v2 task/.test(String(error.stderr)));
});

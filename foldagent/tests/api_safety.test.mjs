import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRequest,callModel,readResponse} from '../api.mjs';
const action={action:'terminate',coordinate:null,coordinate2:null,text:null,button:null,time:null,status:'success'};
const payload={status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(action)}]}]};
const options={api:'responses',model:'mock',apiKey:'offline-only',baseUrl:'http://mock.invalid/v1',maxOutputTokens:4096,apiTimeoutMs:1000,retries:0};
const messages=[{role:'user',content:'Return one screenshot GUI action.'}];
for(const api of ['responses','chat-completions'])test(`explicitly disables all model tools for ${api}`,()=>{
 const body=buildRequest({...options,api},messages);
 assert.deepEqual(body.tools,[]);assert.equal(body.tool_choice,'none');
});
for(const type of ['image_generation_call','web_search_call','function_call','computer_call'])test(`rejects unrequested ${type} even with a valid final action`,()=>{
 assert.throws(()=>readResponse('responses',{...payload,output:[{type,result:'offline-private-sentinel'},...payload.output]}),/Unexpected API tool/);
});
test('allows extra relay declarations but still rejects actual calls with those declarations',()=>{
 const declared={...payload,tools:[{type:'image_generation'}]};
 assert.equal(readResponse('responses',declared),JSON.stringify(action));
 assert.throws(()=>readResponse('responses',{...declared,output:[...payload.output,{type:'image_generation_call'}]}),/Unexpected API tool/);
});
test('rejects unexpected Chat Completions tool calls even if finish_reason says stop',()=>{
 assert.throws(()=>readResponse('chat-completions',{choices:[{finish_reason:'stop',message:{content:JSON.stringify(action),tool_calls:[{type:'function'}]}}]}),/Unexpected API tool/);
});
test('a protocol violation is not retried and its error evidence contains no generated image',async()=>{
 let calls=0;
 await assert.rejects(callModel(options,messages,{fetchImpl:async()=>{
  calls++;return new Response(JSON.stringify({...payload,output:[{type:'image_generation_call',result:'offline-private-sentinel'},...payload.output]}));
 }}),error=>{assert.equal(calls,1);assert.ok(!JSON.stringify(error.apiPayload).includes('offline-private-sentinel'));return /Unexpected API tool/.test(error.message);});
});
test('request timeout also bounds reading a body whose transport ignores abort',async()=>{
 await assert.rejects(callModel({...options,apiTimeoutMs:10},messages,{fetchImpl:async()=>({ok:true,status:200,text:async()=>{
  await new Promise(resolve=>setTimeout(resolve,70));return JSON.stringify(payload);
 }})}),/API transport failed.*TimeoutError/);
});

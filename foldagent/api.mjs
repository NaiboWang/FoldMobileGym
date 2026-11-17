/** Native fetch client: no credentials enter model prompts or saved request headers. */
import {createHash} from 'node:crypto';
export const API_PROTOCOL_VERSION='screenshot_json_no_tool_calls_v3';
const point = {anyOf:[{type:'null'},{type:'array',items:{type:'number'},minItems:2,maxItems:2}]};
export const LEGACY_ACTION_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    action:{type:'string',enum:['click','double_tap','long_press','swipe','type','system_button','open','wait','terminate']},
    coordinate:point, coordinate2:point, text:{type:['string','null']},
    button:{type:['string','null'],enum:['Back','Home','Menu','Enter',null]},
    time:{type:['number','null']}, status:{type:['string','null'],enum:['success','failure',null]},
  },
  required:['action','coordinate','coordinate2','text','button','time','status'],
};
const normalizedPoint={description:'当前截图的归一化 [x,y]，左上角 [0,0]，右下角 [1000,1000]。不是原图像素。像素点须先换算为 [px/W*1000,py/H*1000]。不用时填 null。',
  anyOf:[{type:'null'},{type:'array',items:{type:'number',minimum:0,maximum:1000},minItems:2,maxItems:2}]};
export const ACTION_SCHEMA={...LEGACY_ACTION_SCHEMA,properties:{...LEGACY_ACTION_SCHEMA.properties,coordinate:normalizedPoint,coordinate2:normalizedPoint}};
export const FOLD_ACTION_SCHEMA={...ACTION_SCHEMA,properties:{...ACTION_SCHEMA.properties,
  action:{...ACTION_SCHEMA.properties.action,enum:[...ACTION_SCHEMA.properties.action.enum,'fold','unfold']}}};

export function validateAction(action,options={}) {
  const schema=options.allowFold===true?FOLD_ACTION_SCHEMA:ACTION_SCHEMA;
  if(!action || !schema.properties.action.enum.includes(action.action)) throw Error('Unknown or forbidden action');
  if(['fold','unfold'].includes(action.action)&&['coordinate','coordinate2','text','button','time','status'].some(key=>action[key]!=null))
    throw Error('Fold/unfold takes no parameters; unused fields must be null');
  const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1000);
  if(['click','double_tap','long_press','swipe'].includes(action.action)&&!validPoint(action.coordinate)) throw Error('Action requires coordinate [x,y] in 0..1000');
  if(action.action==='swipe'&&!validPoint(action.coordinate2)) throw Error('Swipe requires coordinate2 [x,y] in 0..1000');
  if(action.action==='type'&&action.coordinate!=null&&!validPoint(action.coordinate)) throw Error('Invalid type coordinate');
  if(['type','open'].includes(action.action)&&typeof action.text!=='string') throw Error('Action requires text');
  if(action.action==='open'&&!action.text.trim()) throw Error('Open requires an app name');
  if(action.action==='system_button'&&!['Back','Home','Menu','Enter'].includes(action.button)) throw Error('Invalid system button');
  if(action.time!=null&&(!Number.isFinite(action.time)||action.time<0||action.time>10)) throw Error('time must be between 0 and 10 seconds');
  if(action.action==='terminate'&&!['success','failure'].includes(action.status)) throw Error('Terminate requires success or failure');
  return action;
}

export function buildRequest(options,messages) {
  const legacy=options.promptVersion==='v1';
  if(options.allowFold&&options.promptVersion&&options.promptVersion!=='v4')throw Error('Agent fold/unfold requires v4 prompts');
  const format={type:'json_schema',name:'mobile_action',strict:true,schema:options.allowFold===true?FOLD_ACTION_SCHEMA:legacy?LEGACY_ACTION_SCHEMA:ACTION_SCHEMA};
  if(options.api==='responses') {
    const system=messages.filter(message=>message.role==='system');
    if(!legacy&&system.some(message=>typeof message.content!=='string'))throw Error('System messages must be plain text');
    const input=legacy?messages:messages.filter(message=>message.role!=='system');
    return {model:options.model,store:false,max_output_tokens:options.maxOutputTokens,tools:[],tool_choice:'none',
      ...(options.reasoningEffort?{reasoning:{effort:options.reasoningEffort}}:{}),
      ...(!legacy&&system.length?{instructions:system.map(message=>message.content).join('\n\n')}:{}),
      text:{format}, input:input.map(message=>({role:message.role,
        content:typeof message.content==='string'?message.content:message.content.map(part=>part.type==='text'
          ?{type:'input_text',text:part.text}:{type:'input_image',image_url:part.image_url.url,detail:'high'})}))};
  }
  return {model:options.model,store:false,messages,max_completion_tokens:options.maxOutputTokens,tools:[],tool_choice:'none',
    ...(options.reasoningEffort?{reasoning_effort:options.reasoningEffort}:{}),
    response_format:{type:'json_schema',json_schema:{name:format.name,strict:true,schema:format.schema}}};
}

/** Audit exact body structure without duplicating image Base64 or storing headers/keys. */
export function requestEvidence(body) {
  const serialized=JSON.stringify(body);
  const images=[];
  const payload=JSON.parse(JSON.stringify(body,(key,value)=>{
    if(typeof value!=='string'||!/^data:image\/[^;]+;base64,/.test(value))return value;
    const bytes=Buffer.from(value.slice(value.indexOf(',')+1),'base64');
    const sha256=createHash('sha256').update(bytes).digest('hex');images.push({sha256,bytes:bytes.length});
    return `[image omitted; sha256=${sha256}; bytes=${bytes.length}]`;
  }));
  return {schema_version:'foldagent.request_evidence.v1',request_sha256:createHash('sha256').update(serialized).digest('hex'),images,payload};
}

export function readResponse(api,payload) {
  const unexpected=()=>{const error=Error('Unexpected API tool/output: screenshot-only protocol requires no model tools');error.code='unexpected_model_tools';return error;};
  if(api==='responses') {
    // Some compatible endpoints echo extra tool declarations despite tool_choice:none.
    // Declarations are metadata, not permission: actual tool/output items remain forbidden.
    if ((payload.output||[]).some(item=>!['message','reasoning'].includes(item.type))) throw unexpected();
    if(payload.status!=='completed') throw Error(`API response is ${payload.status || 'unknown'}: ${payload.incomplete_details?.reason || payload.error?.code || 'no completed output'}`);
    const assistant=(payload.output||[]).filter(x=>x.type==='message'&&x.role==='assistant');
    if(assistant.flatMap(x=>x.content||[]).some(x=>x.type==='refusal')) throw Error('Model refused this request');
    // Some Responses-compatible endpoints emit commentary before final_answer.
    // Execute only the final phase; concatenating both corrupts valid action JSON.
    const phased=assistant.some(x=>x.phase!=null);
    const finalMessages=phased?assistant.filter(x=>x.phase==='final_answer'):assistant;
    const parts=finalMessages.flatMap(x=>x.content||[]);
    const text=parts.filter(x=>x.type==='output_text').map(x=>x.text).join('');
    if(!text.trim()) throw Error('API returned no action text');
    return text;
  }
  if(payload.choices?.some(item=>item.message?.tool_calls?.length||item.message?.function_call))throw unexpected();
  const choice=payload.choices?.[0];
  if(choice?.finish_reason!=='stop') throw Error(`Chat completion stopped with ${choice?.finish_reason || 'no choice'}`);
  if(choice.message?.refusal) throw Error('Model refused this request');
  if(typeof choice.message?.content!=='string'||!choice.message.content.trim()) throw Error('API returned no action text');
  return choice.message.content;
}

export async function callModel(options,messages,{fetchImpl=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  const body=buildRequest(options,messages);
  let attempts=0;
  while(true) {
    attempts++;
    let response,payload;
    try {
      const controller=new AbortController();let timeout;
      try {
        await Promise.race([
          (async()=>{
            const received=await fetchImpl(`${options.baseUrl}/${options.api==='responses'?'responses':'chat/completions'}`,{
              method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${options.apiKey}`},
              body:JSON.stringify(body),signal:controller.signal,redirect:'error',
            });
            const text=await received.text();
            let parsed;try {parsed=JSON.parse(text);}catch {parsed={};}
            response=received;payload=parsed;
          })(),
          new Promise((_,reject)=>{timeout=setTimeout(()=>{
            const failure=new DOMException('API request deadline exceeded','TimeoutError');
            controller.abort(failure);reject(failure);
          },options.apiTimeoutMs);}),
        ]);
      }finally{clearTimeout(timeout);}
    } catch(error) {
      if(attempts<=options.retries){await delay(1000*attempts);continue;}
      const failure=Error(`API transport failed after ${attempts} attempt(s): ${error.name}`);
      failure.attempts=attempts;throw failure;
    }
    if(!response.ok) {
      if((response.status===429||response.status>=500)&&attempts<=options.retries){await delay(1000*attempts);continue;}
      const code=String(payload.error?.code||payload.error?.type||'request_failed');
      const error=Error(`API HTTP ${response.status} (${code}); check key, model, quota and API mode`);
      error.httpStatus=response.status;error.attempts=attempts;throw error;
    }
    let raw;
    try {raw=readResponse(options.api,payload);} catch(error) {
      // Keep protocol evidence without retaining unrequested generated images.
      error.apiPayload=error.code==='unexpected_model_tools'?{
        protocol_violation:error.code,model:payload.model,status:payload.status,
        declared_tool_types:payload.tools?.map(item=>item.type),
        output_item_types:payload.output?.map(item=>item.type),
        unrequested_result_characters:(payload.output||[]).reduce((n,item)=>n+(typeof item.result==='string'?item.result.length:0),0),
        usage:payload.usage?{input_tokens:payload.usage.input_tokens,output_tokens:payload.usage.output_tokens,total_tokens:payload.usage.total_tokens}:null,
      }:payload;
      error.attempts=attempts;throw error;
    }
    let action,parseError;
    try {action=validateAction(JSON.parse(raw),options);} catch(error) {parseError=error.message;}
    return {raw,action,parseError,payload,attempts,usage:payload.usage||null};
  }
}

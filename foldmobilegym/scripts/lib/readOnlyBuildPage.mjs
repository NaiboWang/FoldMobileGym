import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.wasm':'application/wasm','.mp4':'video/mp4'};
/** Disposable browser read-only rendering: no listener, deployment or API replacement. */
export async function attachReadOnlyBuildPage(page,{directory,workspace,baseURL}){
 if(!directory)return {mode:'http',delivered:[],blocked:[]};
 const area=path.resolve(workspace,'artifacts'),build=path.resolve(workspace,directory),base=new URL(baseURL);
 assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)&&!base.username&&!base.password);
 assert.ok(build.startsWith(area+path.sep),'Only this workspace generated builds are allowed');
 assert.equal(fs.realpathSync(build),build,'Build path must not traverse links');
 const inventory=JSON.parse(fs.readFileSync(path.join(build,'mobilegym-release-assets.json'),'utf8'));
 assert.equal(inventory.version,1);const known=new Map();
 for(const release of inventory.releases)for(const item of release.assets){
  assert.match(item.name,/^assets\/[a-zA-Z0-9_.\/-]+$/);assert.ok(!item.name.split('/').includes('..'));
  const previous=known.get(item.name);if(previous)assert.equal(previous.sha256,item.sha256);known.set(item.name,item);
 }
 const receipt={mode:'read-only-build-page',build,delivered:[],blocked:[],sharedDatasetReads:[],sharedBootstrapReads:[],newServerStarted:false};
 await page.setCacheEnabled(false);await page.setRequestInterception(true);
 page.on('request',request=>{void(async()=>{
  if(request.isInterceptResolutionHandled())return;
  const url=new URL(request.url());
  if(['data:','blob:'].includes(url.protocol)){await request.continue();return;}
  if(url.origin!==base.origin||!['GET','HEAD'].includes(request.method())){
   receipt.blocked.push({url:url.href,method:request.method()});await request.abort('blockedbyclient');return;
  }
  let relative;
  try{relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';}catch{await request.respond({status:400,body:'Malformed local resource'});return;}
  const file=path.resolve(build,relative);
  if(!file.startsWith(build+path.sep)||relative.includes('\0')){await request.respond({status:403,body:'Outside build'});return;}
  if(fs.existsSync(file)){
   let current=build;
   for(const segment of path.relative(build,file).split(path.sep)){current=path.join(current,segment);assert.ok(!fs.lstatSync(current).isSymbolicLink(),'No build reparse points');}
   const stat=fs.lstatSync(file);if(stat.isFile()){
    const bytes=fs.readFileSync(file),hash=sha(bytes),record=known.get(relative.replaceAll('\\','/'));
    if(record){assert.equal(bytes.length,record.bytes);assert.equal(hash,record.sha256);}
    receipt.delivered.push({file:relative,bytes:bytes.length,sha256:hash});
    await request.respond({status:200,headers:{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'},body:request.method()==='HEAD'?'':bytes});return;
   }
  }
  // Dataset requests remain real read-only requests to the existing trusted service.
  if(relative==='api/sdcard'){
   receipt.sharedBootstrapReads.push(url.href);await request.continue();return;
  }
  if(relative.startsWith('cdn/')||relative.startsWith('map-vector-cache/')){
   receipt.sharedDatasetReads.push(url.href);await request.continue();return;
  }
  receipt.blocked.push({url:url.href,reason:'not-in-candidate'});await request.respond({status:404,body:'Candidate resource missing'});
 })().catch(async error=>{receipt.blocked.push({url:request.url(),error:String(error)});if(!request.isInterceptResolutionHandled())await request.abort('failed').catch(()=>{});});});
 return receipt;
}

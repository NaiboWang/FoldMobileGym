import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
export const NAV_ERROR_KEYS=['missingInDeclaration','fromMismatches','invalidBaseStateIds'];
export const NAV_WARNING_KEYS=['unusedInCode','extraFromWarnings','gestureMismatches','fromSearchTooBroad','fromBarePathWithoutBaseState','multipleBaseStates'];
export const ACTION_ERROR_KEYS=['missingInDeclaration','schemaErrors'];
export const ACTION_WARNING_KEYS=['unusedInCode','schemaWarnings'];
export function classifyNavigationAudit(report, exitCode) {
  if(!report || !report.navigation?.summary || !report.actions?.summary) return {status:'tool-error',errors:1,warnings:0};
  const n=report.navigation.summary,a=report.actions.summary;
  const counts=[...NAV_ERROR_KEYS.map(k=>n[k]),...NAV_WARNING_KEYS.map(k=>n[k]),...ACTION_ERROR_KEYS.map(k=>a[k]),...ACTION_WARNING_KEYS.map(k=>a[k])];
  if(counts.some(v=>!Number.isInteger(v)||v<0))return{status:'tool-error',errors:1,warnings:0};
  const errors=NAV_ERROR_KEYS.reduce((v,k)=>v+n[k],0)+ACTION_ERROR_KEYS.reduce((v,k)=>v+a[k],0);
  const warnings=NAV_WARNING_KEYS.reduce((v,k)=>v+n[k],0)+ACTION_WARNING_KEYS.reduce((v,k)=>v+a[k],0);
  if(exitCode!==0 && errors===0)return{status:'tool-error',errors:1,warnings};
  return{status:errors?'static-errors':warnings?'static-consistent-with-warnings':'static-consistent',errors,warnings};
}
export function summarizeNavigationAudits(apps) {
  const result={apps:apps.length,checked:0,missingDeclarations:0,toolErrors:0,appsWithErrors:0,appsWithWarnings:0,errors:0,warnings:0,routes:0,transitionsDeclared:0,transitionsUsed:0,actionsDeclared:0,actionsUsed:0};
  for(const app of apps){
    if(app.status==='missing-declaration')result.missingDeclarations++;
    else if(app.status==='tool-error')result.toolErrors++;
    else result.checked++;
    if(app.errors){result.appsWithErrors++;result.errors+=app.errors;}
    if(app.warnings){result.appsWithWarnings++;result.warnings+=app.warnings;}
    const n=app.report?.navigation?.summary,a=app.report?.actions?.summary;
    result.routes+=n?.routes??0;result.transitionsDeclared+=n?.transitionsDeclared??0;result.transitionsUsed+=n?.transitionsUsedInCode??0;
    result.actionsDeclared+=a?.actionsDeclared??0;result.actionsUsed+=a?.actionsUsedInCode??0;
  }
  return result;
}
export function manifestIdFromSource(text,file='manifest.ts'){
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);let id=null;
  const walk=node=>{
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='manifest'&&node.initializer){
      let value=node.initializer;while(ts.isAsExpression(value)||ts.isSatisfiesExpression(value)||ts.isParenthesizedExpression(value))value=value.expression;
      if(ts.isObjectLiteralExpression(value)){const prop=value.properties.find(p=>ts.isPropertyAssignment(p)&&(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name))&&p.name.text==='id');if(prop&&ts.isStringLiteral(prop.initializer))id=prop.initializer.text;}
    }ts.forEachChild(node,walk);
  };walk(source);return id;
}
export function discoverNavigationModules(mobileRoot){
  const modules=new Map();
  for(const parent of ['apps','system'])for(const entry of fs.readdirSync(path.join(mobileRoot,parent),{withFileTypes:true}).filter(e=>e.isDirectory())){
    const file=path.join(mobileRoot,parent,entry.name,'manifest.ts');if(!fs.existsSync(file))continue;
    const id=manifestIdFromSource(fs.readFileSync(file,'utf8'),file);if(!id)continue;
    if(modules.has(id))throw new Error(`Duplicate app id in source manifests: ${id}`);
    modules.set(id,{directory:entry.name,parent,path:path.join(mobileRoot,parent,entry.name)});
  }
  return modules;
}
export function navigationInputFingerprint(moduleRoot){
  const files=[];
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','dist','build'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()&&/\.(?:tsx?|css)$/.test(entry.name))files.push(file);}};walk(moduleRoot);files.sort();
  const hash=createHash('sha256');for(const file of files)hash.update(path.relative(moduleRoot,file).split(path.sep).join('/')+'\0').update(fs.readFileSync(file)).update('\0');
  return{files:files.length,sha256:hash.digest('hex')};
}

export function declarationIdLocations(text,file) {
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),locations={};
  const walk=node=>{if(ts.isPropertyAssignment(node)&&(ts.isIdentifier(node.name)||ts.isStringLiteral(node.name))&&node.name.text==='id'&&ts.isStringLiteral(node.initializer)){
    const position=source.getLineAndCharacterOfPosition(node.initializer.getStart(source));
    (locations[node.initializer.text]??=[]).push({file,line:position.line+1,column:position.character+1});
  }ts.forEachChild(node,walk);};walk(source);return locations;
}
export function navigationFindings(report,locations={}) {
  const findings=[];
  const add=(severity,category,item)=>{const id=typeof item==='string'?item:item.id??null;findings.push({severity,category,id,declarations:id?locations[id]??[]:[],details:item});};
  const n=report.navigation,a=report.actions;
  for(const [category,key]of [['missing-transition','missingInDeclaration'],['source-mismatch','fromMismatches'],['invalid-base-id','invalidBaseStateIds']])for(const item of n[key]??[])add('error',category,item);
  for(const [category,key]of [['unused-transition','unusedInCode'],['unmapped-parent-source','extraFromWarnings'],['gesture-mismatch','gestureMismatches'],['broad-source-search','fromSearchTooBroad'],['source-without-base-state','fromBarePathWithoutBaseState'],['multiple-base-states','multipleBaseStates']])for(const item of n[key]??[])add('warning',category,item);
  for(const item of a.missingInDeclaration??[])add('error','missing-action',item);
  for(const item of a.unusedInCode??[])add('warning','unused-action',item);
  for(const item of a.schemaIssues??[])add(item.level==='error'?'error':'warning','action-schema',item);
  return findings;
}
/** Persistable metadata-only evidence: no app records, answers, source contents or host absolute paths. */
export function navigationAuditSnapshot(report) {
  return {schema_version:report.schema_version,scope:report.scope,sourceCommit:report.sourceCommit,sourceWorktreeChanges:report.sourceWorktreeChanges,
    runtimeCatalogOnly:true,checkerHash:report.checkerHash,summary:report.summary,strictWarnings:report.strictWarnings,passed:report.passed,
    apps:report.apps.map(app=>({id:app.id,directory:app.directory,parent:app.parent,inputFingerprint:app.inputFingerprint,status:app.status,errors:app.errors,warnings:app.warnings,
      navigation:app.report?.navigation?.summary,actions:app.report?.actions?.summary,findings:app.findings??[],...(app.error?{error:app.error}:{}),})),};
}

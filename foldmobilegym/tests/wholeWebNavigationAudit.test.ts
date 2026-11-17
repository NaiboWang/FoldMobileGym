import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classifyNavigationAudit, summarizeNavigationAudits, manifestIdFromSource, declarationIdLocations, navigationFindings, navigationAuditSnapshot, navigationInputFingerprint } from '../scripts/navigation_audit_report.mjs';
import { NAVIGATION_DECLARATION } from '../system/AnswerSheet/navigation.declaration';
const report = () => ({ navigation:{ summary:{ routes:1,transitionsDeclared:1,transitionsUsedInCode:1,missingInDeclaration:0,unusedInCode:0,fromMismatches:0,extraFromWarnings:0,gestureMismatches:0,fromSearchTooBroad:0,fromBarePathWithoutBaseState:0,invalidBaseStateIds:0,multipleBaseStates:0 } }, actions:{ summary:{ actionsDeclared:7,actionsUsedInCode:7,missingInDeclaration:0,unusedInCode:0,schemaErrors:0,schemaWarnings:0 } } });
describe('Whole-visible-app navigation diagnostic truth',()=>{
 it('labels clean source consistency without asserting runtime/native/agent acceptance',()=>expect(classifyNavigationAudit(report(),0)).toEqual({status:'static-consistent',errors:0,warnings:0}));
 it.each(['unusedInCode','extraFromWarnings','gestureMismatches','fromSearchTooBroad','fromBarePathWithoutBaseState','multipleBaseStates'])('retains navigation warning %s',key=>{const r=report();r.navigation.summary[key as keyof typeof r.navigation.summary]=2;expect(classifyNavigationAudit(r,0)).toEqual({status:'static-consistent-with-warnings',errors:0,warnings:2});});
 it.each(['missingInDeclaration','fromMismatches','invalidBaseStateIds'])('fails navigation error %s',key=>{const r=report();r.navigation.summary[key as keyof typeof r.navigation.summary]=1;expect(classifyNavigationAudit(r,1)).toEqual({status:'static-errors',errors:1,warnings:0});});
 it('does not convert bad/missing JSON, malformed counters or unexplained child failures into green apps',()=>{
  expect(classifyNavigationAudit(null,1).status).toBe('tool-error');expect(classifyNavigationAudit({navigation:{}},0).errors).toBe(1);
  const r=report();r.actions.summary.schemaErrors=-1;expect(classifyNavigationAudit(r,0).status).toBe('tool-error');expect(classifyNavigationAudit(report(),1).errors).toBe(1);
 });
 it('retains action missing/schema errors and unused/schema warnings separately',()=>{
  const r=report();r.actions.summary.schemaErrors=2;r.actions.summary.missingInDeclaration=1;r.actions.summary.schemaWarnings=3;r.actions.summary.unusedInCode=4;
  expect(classifyNavigationAudit(r,1)).toEqual({status:'static-errors',errors:3,warnings:7});
 });
 it('counts missing declarations, tool failures and warned apps instead of dropping them from totals',()=>{
  const result=summarizeNavigationAudits([{id:'ok',...classifyNavigationAudit(report(),0),report:report()},{id:'missing',status:'missing-declaration',errors:1,warnings:0},{id:'bad',status:'tool-error',errors:1,warnings:0},{id:'warning',status:'static-consistent-with-warnings',errors:0,warnings:5,report:report()}]);
  expect(result).toMatchObject({apps:4,checked:2,missingDeclarations:1,toolErrors:1,appsWithErrors:2,appsWithWarnings:1,errors:2,warnings:5,routes:2,actionsDeclared:14});
 });
 it.each(["export const manifest={id:'real'};","export const manifest: AppManifest = ({id:'real'} as const);","export const manifest={id:'real'} as const satisfies AppManifest;"] )('reads literal manifest identity without executing it: %s',text=>expect(manifestIdFromSource(text)).toBe('real'));
 it.each(["export const other={id:'not-a-manifest'};","export const manifest=dynamic();","export const manifest={id:secretToken};"])('does not invent a literal id from %s',text=>expect(manifestIdFromSource(text)).toBeNull());
 it('retains concrete declaration file/line and the actual complete warning details',()=>{
  const text="export const NAV = { transitions: [\n  { id: 'valid.parent.open', from: ['/','/child'] },\n] };";
  const sites=declarationIdLocations(text,'foldmobilegym/apps/Test/navigation.declaration.ts');
  expect(sites['valid.parent.open'][0]).toMatchObject({file:'foldmobilegym/apps/Test/navigation.declaration.ts',line:2});
  const raw={navigation:{unusedInCode:['unused.entry'],extraFromWarnings:[{id:'valid.parent.open',extraFromPaths:['/child']}]},actions:{unusedInCode:['unused.action'],schemaIssues:[]}};
  const findings=navigationFindings(raw,sites);expect(findings).toHaveLength(3);expect(findings[1]).toMatchObject({id:'valid.parent.open',severity:'warning',declarations:[expect.objectContaining({line:2})],details:{extraFromPaths:['/child']}});
 });
 it('metadata evidence cannot accidentally retain authored app state, raw source or browser credentials',()=>{
  const snapshot=navigationAuditSnapshot({schema_version:'audit.v1',scope:'Static only',sourceCommit:'commit',summary:{apps:1},apps:[{id:'safe',directory:'Safe',parent:'apps',status:'static-consistent',errors:0,warnings:0,inputFingerprint:{sha256:'hash'},report:report(),sourceContents:'private',answers:{secret:'authored answer'}}],runtimeState:{private:'data'},envUrl:'http://secret:password@127.0.0.1/'});
  const text=JSON.stringify(snapshot);expect(text).not.toContain('authored answer');expect(text).not.toContain('sourceContents');expect(text).not.toContain('password');expect(text).toContain('Static only');
 });
 it('fingerprints data/context TypeScript scanned by the action checker, not only page files',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'navigation-audit-inputs-'));
  const data=path.join(root,'data'),context=path.join(root,'context');mkdirSync(data);mkdirSync(context);
  const dataFile=path.join(data,'bindings.ts'),contextFile=path.join(context,'Controls.tsx');
  try{
   writeFileSync(dataFile,"export const binding='first';");writeFileSync(contextFile,'export const Controls=()=>null;');
   const first=navigationInputFingerprint(root);expect(first.files).toBe(2);
   writeFileSync(dataFile,"export const binding='second';");const second=navigationInputFingerprint(root);expect(second.sha256).not.toBe(first.sha256);
   writeFileSync(contextFile,'export const Controls=()=>false;');expect(navigationInputFingerprint(root).sha256).not.toBe(second.sha256);
  }finally{unlinkSync(dataFile);unlinkSync(contextFile);rmdirSync(data);rmdirSync(context);rmdirSync(root);}
 });
 it('keeps the existing strict checker unmodified and launches no task/model generation',()=>{
  const script=readFileSync(new URL('../scripts/audit_enabled_app_navigation.mjs',import.meta.url),'utf8');
  expect(script).toContain("'--actions','--json'");expect(script).toContain('visibleAppIds(page)');expect(script).toContain('navigationInputFingerprint(module.path)');expect(script).toContain('--fail-on-warn');expect(script).not.toContain('build_nav_artifacts');
 });
});
describe('Research AnswerSheet actual declaration',()=>{
 it('declares the existing singleton route, dynamic input operands and both form actions',()=>{
  const route=NAVIGATION_DECLARATION.routes[0];expect(route).toMatchObject({path:'/',component:'SheetPage',entryPoint:'home'});
  expect(route.scrollContainers.map(item=>item.name)).toEqual(['question','sheet-form']);
  const actions=route.uiStates[0].actions;expect(new Set(actions.map(a=>a.id)).size).toBe(7);
  expect(actions.find(a=>a.id==='answerSheet.repeatable.item.input')).toMatchObject({scope:'item',behavior:'input',paramsSchema:{fieldIndex:'number',itemIndex:'number',value:'string'}});
  expect(actions.find(a=>a.id==='answerSheet.form.submit')).toMatchObject({behavior:'submit'});expect(actions.find(a=>a.id==='answerSheet.form.modify')).toMatchObject({behavior:'other'});
 });
 it('localizes only chrome, preserves task-supplied values, and cleans queued reveal work',()=>{
  const source=readFileSync(new URL('../system/AnswerSheet/pages/SheetPage.tsx',import.meta.url),'utf8');
  expect(source).toContain('useAppStrings(strings,stringsEn)');expect(source).not.toContain('strings as S');expect(source).not.toContain('setTimeout(');
  expect(source).toContain('cancelAnimationFrame(frame)');expect(source).toContain('data-keep-keyboard');expect(source).toContain('[overflow-wrap:anywhere]');expect(source).toContain("params: { fieldIndex: index, value: option }");
 });
});

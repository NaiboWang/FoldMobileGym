#!/usr/bin/env node
/** Runtime-catalog-driven static diagnostic, never page acceptance/model scoring. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';
import { visibleAppIds } from './audit_app_catalog.mjs';
import { classifyNavigationAudit, discoverNavigationModules, navigationInputFingerprint, summarizeNavigationAudits, declarationIdLocations, navigationFindings, navigationAuditSnapshot } from './navigation_audit_report.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: node scripts/audit_enabled_app_navigation.mjs [--env-url LOOPBACK_URL] [--fail-on-warn]\nRead actual launcher catalog; run unchanged consistency checks; retain all findings/source fingerprints in ignored artifacts.\nStatic checks only: no page/feature/agent qualification or task/evaluator changes.');process.exit(0);}
let envUrl=process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3188/',failOnWarn=false;
for(let i=0;i<args.length;i++){if(args[i]==='--env-url'){assert.ok(args[++i],'Missing --env-url');envUrl=args[i];}else if(args[i]==='--fail-on-warn')failOnWarn=true;else throw new Error('Unknown argument: '+args[i]);}
const url=new URL(envUrl);assert.ok(['http:','https:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.username&&!url.password,'Expected credential-free loopback preview URL');
const mobile=path.resolve(import.meta.dirname,'..'),root=path.resolve(mobile,'..'),require=createRequire(path.join(mobile,'package.json'));
const output=fs.mkdtempSync(path.join(root,'artifacts/enabled-navigation-audit-'));
const modules=discoverNavigationModules(mobile),checker=path.join(mobile,'scripts/check_navigation_declaration_consistency.mjs');
const checkerHash=createHash('sha256').update(fs.readFileSync(checker)).digest('hex');
const sourceCommit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
const trackedChanges=spawnSync('git',['diff','HEAD','--name-only','--','foldmobilegym/apps','foldmobilegym/system','foldmobilegym/os','foldmobilegym/scripts'],{cwd:root,encoding:'utf8'}).stdout.trim().split('\n').filter(Boolean);
const untrackedSource=spawnSync('git',['ls-files','--others','--exclude-standard','--','foldmobilegym/apps','foldmobilegym/system','foldmobilegym/os','foldmobilegym/scripts'],{cwd:root,encoding:'utf8'}).stdout.trim().split('\n').filter(Boolean);
let runtimeApps;const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
try{const page=await browser.newPage();await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SIM__&&window.__OS__);const visible=await visibleAppIds(page);runtimeApps=await page.evaluate(ids=>window.__SIM__.getState().os.installedApps.filter(app=>ids.includes(app.id)).map(({id,type})=>({id,type})),visible);}finally{await browser.close();}
assert.ok(runtimeApps.length>0,'Empty runtime catalog is not an audit pass');assert.equal(new Set(runtimeApps.map(a=>a.id)).size,runtimeApps.length,'Duplicate runtime app IDs');
const apps=[];
for(const app of runtimeApps){
  const module=modules.get(app.id);let row;
  if(!module)row={...app,status:'tool-error',errors:1,warnings:0,error:'Runtime app has no literal source manifest'};
  else{
    const inputFingerprint=navigationInputFingerprint(module.path),declaration=path.join(module.path,'navigation.declaration.ts');
    if(!fs.existsSync(declaration))row={...app,directory:module.directory,parent:module.parent,inputFingerprint,status:'missing-declaration',errors:1,warnings:0,error:'No navigation.declaration.ts'};
    else{
      const child=spawnSync(process.execPath,[checker,module.directory,'--actions','--json'],{cwd:mobile,encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});let report;
      try{report=JSON.parse(child.stdout);}catch{report={error:child.error?.message||child.stderr||child.stdout||'No JSON output'};}
      row={...app,directory:module.directory,parent:module.parent,inputFingerprint,exitCode:child.status,...classifyNavigationAudit(report,child.status),report};
      if(row.status!=='tool-error'){
        row.findings=navigationFindings(report,declarationIdLocations(fs.readFileSync(declaration,'utf8'),path.relative(root,declaration).split(path.sep).join('/')));
        assert.equal(row.findings.filter(f=>f.severity==='warning').length,row.warnings,`Warning details missing for ${app.id}`);
        assert.equal(row.findings.filter(f=>f.severity==='error').length,row.errors,`Error details missing for ${app.id}`);
      }
    }
    const after=navigationInputFingerprint(module.path);assert.deepEqual(after,inputFingerprint,`Audit changed or raced source: ${app.id}`);
  }
  apps.push(row);fs.writeFileSync(path.join(output,app.id+'.json'),JSON.stringify(row,null,2));console.log(JSON.stringify({app:app.id,status:row.status,errors:row.errors,warnings:row.warnings}));
}
assert.equal(createHash('sha256').update(fs.readFileSync(checker)).digest('hex'),checkerHash,'Checker changed while auditing');
const summary=summarizeNavigationAudits(apps),passed=summary.errors===0&&(!failOnWarn||summary.warnings===0);
const report={schema_version:'mobilegym.enabled-navigation-audit.v1',scope:'Actual visible launcher apps; unchanged source-consistency checker. Not graph reachability, untagged-control completeness, route runtime, function, media, native visual or model/task qualification.',sourceCommit,sourceWorktreeChanges:[...trackedChanges,...untrackedSource],runtimeCatalogOnly:true,envUrl:url.href,checkerHash,summary,strictWarnings:failOnWarn,passed,apps};
fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(output,'metadata-snapshot.json'),JSON.stringify(navigationAuditSnapshot(report),null,2));console.log(JSON.stringify({passed,summary,output,scope:report.scope}));if(!passed)process.exitCode=1;

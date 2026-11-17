import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const outputPath=path.join(project,'os/data/installedPackageIds.generated.ts');
function source(text,name){const tree=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);if(tree.parseDiagnostics.length)throw new Error('Invalid manifest syntax: '+name);return tree;}
function initializer(tree,name){let result;const visit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===name){if(result)throw new Error('Ambiguous declaration: '+name);result=node.initializer;}ts.forEachChild(node,visit);};visit(tree);if(!result)throw new Error('Missing declaration: '+name);return result;}
function unwrap(node){while(ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node))node=node.expression;return node;}
export function manifestId(text,name='manifest.ts'){
 const tree=source(text,name),object=unwrap(initializer(tree,'manifest'));if(!ts.isObjectLiteralExpression(object))throw new Error('Manifest must declare an object: '+name);
 const ids=object.properties.filter(p=>ts.isPropertyAssignment(p)&&((ts.isIdentifier(p.name)||ts.isStringLiteral(p.name))&&p.name.text==='id'));
 if(ids.length!==1)throw new Error('Manifest must have one literal id: '+name);const value=unwrap(ids[0].initializer);
 if(!(ts.isStringLiteral(value)||ts.isNoSubstitutionTemplateLiteral(value))||!value.text)throw new Error('Manifest id must be static: '+name);return value.text;
}
export function manifestPatterns(text){
 const tree=source(text,'PackageManagerService.ts'),call=unwrap(initializer(tree,'manifestModules'));
 if(!ts.isCallExpression(call)||call.expression.getText(tree).replace(/\s/g,'')!=='import.meta.glob'||!ts.isArrayLiteralExpression(call.arguments[0]))throw new Error('Expected authoritative manifestModules glob');
 const options=call.arguments[1];
 if(!options||!ts.isObjectLiteralExpression(options)||options.properties.length!==1||!ts.isPropertyAssignment(options.properties[0])||options.properties[0].name.getText(tree)!=='eager'||options.properties[0].initializer.kind!==ts.SyntaxKind.TrueKeyword)throw new Error('Expected eager complete manifest discovery; review identity generation for changed glob options');
 const patterns=call.arguments[0].elements.map(e=>{if(!ts.isStringLiteral(e))throw new Error('Manifest patterns must be literal');return e.text;});
 for(const p of patterns)matches(p.startsWith('!')?p.slice(1):p,'apps','__validation__');
 return patterns;
}
function matches(pattern,group,directory){
 const parts=pattern.split('/');
 if(parts.length!==4||parts[0]!=='..'||!['apps','system'].includes(parts[1])||parts[3]!=='manifest.ts'||!parts[2]||['.','..'].includes(parts[2])||(parts[2]!=='*'&&/[*?{}\[\]]/.test(parts[2])))throw new Error('Unsupported manifest glob: '+pattern);
 return parts[1]===group&&(parts[2]==='*'||parts[2]===directory);
}
export function selectedManifest(patterns,group,directory){return patterns.filter(p=>!p.startsWith('!')).some(p=>matches(p,group,directory))&&!patterns.filter(p=>p.startsWith('!')).some(p=>matches(p.slice(1),group,directory));}
export function identitySource(entries){
 const ordered=[...entries].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),ids=ordered.map(e=>e.id);
 if(!ids.length||new Set(ids).size!==ids.length)throw new Error('Empty or duplicate packaged identities');
 return '// Generated from PackageManagerService manifest selection and literal manifest IDs.\n// Run node scripts/package_identity_index.mjs --write; do not hand-edit.\nexport const INITIAL_INSTALLED_PACKAGE_IDS: readonly string[] = Object.freeze('+JSON.stringify(ids,null,2)+');\n';
}
export function expectedIdentitySource(root=project){
 const patterns=manifestPatterns(fs.readFileSync(path.join(root,'os/PackageManagerService.ts'),'utf8')),entries=[];
 for(const group of ['apps','system'])for(const dir of fs.readdirSync(path.join(root,group),{withFileTypes:true})){
  if(dir.name.startsWith('.')||!selectedManifest(patterns,group,dir.name))continue;
  if(dir.isSymbolicLink())throw new Error('Review linked manifest directory: '+dir.name);
  if(!dir.isDirectory())continue;
  const file=path.join(root,group,dir.name,'manifest.ts');if(!fs.existsSync(file))continue;
  entries.push({path:'../'+group+'/'+dir.name+'/manifest.ts',id:manifestId(fs.readFileSync(file,'utf8'),file)});
 }
 return identitySource(entries);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2]||'--check';if(!['--check','--write'].includes(mode))throw new Error('Use --check or --write');
 const expected=expectedIdentitySource();
 if(mode==='--write')fs.writeFileSync(outputPath,expected,'utf8');
 else if(!fs.existsSync(outputPath)||fs.readFileSync(outputPath,'utf8').replace(/\r\n/g,'\n')!==expected)throw new Error('Packaged identity index is stale: run node scripts/package_identity_index.mjs --write');
 console.log(JSON.stringify({passed:true,mode,output:'os/data/installedPackageIds.generated.ts'}));
}

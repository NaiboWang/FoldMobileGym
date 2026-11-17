import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
describe('Mail stylesheet ownership',()=>{
 it('scopes every ordinary selector to Mail root or a unique Mail-owned class',()=>{
  const css=postcss.parse(readFileSync(new URL('../apps/Mail/mail-adaptive.css',import.meta.url),'utf8'));
  const leaks:string[]=[];css.walkRules(rule=>{for(const selector of rule.selectors)if(!selector.trim().startsWith('.mroot')&&!selector.trim().startsWith('.mail-'))leaks.push(selector);});expect(leaks).toEqual([]);
 });
});

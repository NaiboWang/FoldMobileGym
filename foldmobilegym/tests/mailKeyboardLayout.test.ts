import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
describe('Mail delegates keyboard viewport reduction to system adjustResize',()=>{
 it('does not subtract the keyboard a second time from its full-height root',()=>{
  const source=readFileSync(new URL('../apps/Mail/MailApp.tsx',import.meta.url),'utf8');
  expect(source).toContain('<div className="mroot">');
  expect(source).not.toMatch(/useKeyboard|keyboardHeight/);
  const css=readFileSync(new URL('../apps/Mail/mail-adaptive.css',import.meta.url),'utf8');
  expect(css).toContain('.mroot{height:100%');
  expect(css).not.toMatch(/keyboardHeight|var\(--.*keyboard/);
 });
});

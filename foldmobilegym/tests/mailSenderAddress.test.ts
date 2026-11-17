import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {strings} from '../apps/Mail/res/strings';
import {stringsEn} from '../apps/Mail/res/strings.en';
describe('Mail sender source address contract',()=>{
 it('supports optional address without changing existing message defaults',()=>{
  const state=readFileSync(new URL('../apps/Mail/state.ts',import.meta.url),'utf8');
  const types=readFileSync(new URL('../apps/Mail/types.ts',import.meta.url),'utf8');
  expect(types).toContain('senderAddress?: string');
  expect(types.match(/senderAddress/g)).toHaveLength(1);
  expect(state).toContain('Message');
  expect(state).not.toMatch(/senderAddress\s*:/);
 });
 it('renders the source value or explicit unavailable text, never a guessed address',()=>{
  const app=readFileSync(new URL('../apps/Mail/MailApp.tsx',import.meta.url),'utf8');
  expect(app).toContain('message.senderAddress?.trim() || s.sender_address_unavailable');
  expect(app).toContain('data-mail-sender-address');
  expect(strings.sender_address_unavailable).toBe('未提供邮件地址');
  expect(stringsEn.sender_address_unavailable).toBe('Email address not provided');
 });
});

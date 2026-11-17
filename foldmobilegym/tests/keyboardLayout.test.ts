import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {getVisibleKeyboardHeight} from '../os/keyboard/keyboardLayout';

describe('keyboard occupied layout height',()=>{
 it.each([0,180,280,320])('hidden raw height %i occupies no space',height=>{
  expect(getVisibleKeyboardHeight({visible:false,height})).toBe(0);
 });
 it.each([0,240,320])('visible height %i is preserved',height=>{
  expect(getVisibleKeyboardHeight({visible:true,height})).toBe(height);
 });
 it('shell and convenience hook share the visibility-aware selector',()=>{
  const shell=readFileSync(new URL('../os/SystemShell.tsx',import.meta.url),'utf8');
  const hook=readFileSync(new URL('../os/keyboard/useKeyboard.ts',import.meta.url),'utf8');
  expect(shell).toContain('getKeyboardHeightSnapshot = () => getVisibleKeyboardHeight(KeyboardService.getState())');
  expect(hook).toContain('return getVisibleKeyboardHeight(useKeyboard())');
 });
});

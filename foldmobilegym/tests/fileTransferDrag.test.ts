import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {getTransferDragOffset} from '../system/FileManager/utils/transferDrag';

describe('FileManager transfer drag offsets',()=>{
 it('follows downward movement',()=>expect(getTransferDragOffset(50,200,900)).toBe(150));
 it('resets exactly at origin',()=>expect(getTransferDragOffset(50,50,900)).toBe(0));
 it('resets a move that skips above origin',()=>expect(getTransferDragOffset(50,30,900)).toBe(0));
 it('clamps downward overshoot',()=>expect(getTransferDragOffset(50,1200,900)).toBe(900));
 it('retains fractional CSS movement',()=>expect(getTransferDragOffset(50.5,80.75,900)).toBe(30.25));
 it('separates cancellation and reads live offset with pointer ownership',()=>{
  const source=readFileSync(new URL('../system/FileManager/components/TransferSheet.tsx',import.meta.url),'utf8');
  expect(source).toContain('onPointerCancel={handlePointerCancel}');
  expect(source).toContain('onLostPointerCapture={handlePointerCancel}');
  expect(source).toContain('dragRef.current.pointerId !== e.pointerId');
  expect(source).toContain('const offset = dragRef.current.offset');
  expect(source).not.toContain('if (dragOffset >= DISMISS_THRESHOLD)');
 });
});

import { describe, expect, it } from 'vitest';
import { orderXQuotes, orderXReplies } from '../apps/X/utils/postOrdering';
import type { XPost } from '../apps/X/types';
const post=(id:string,createdAt:string,likes=0):XPost=>({id,authorId:'author',content:id,createdAt,time:'刚刚',stats:{comments:0,retweets:0,likes,views:0}});
const older=post('older','2026-10-18T19:00:00.000Z',5),newer=post('newer','2026-10-18T19:00:30.000Z',2),newest=post('newest','2026-10-18T19:00:50.000Z',0);
const ids=(rows:XPost[])=>rows.map(row=>row.id);
describe('X actual post/reply ordering',()=>{
 it('orders two same-minute replies by their authoritative exact timestamps',()=>expect(ids(orderXReplies([older,newer],'recent'))).toEqual(['newer','older']));
 it('orders quotes independently of incoming insertion/feed order',()=>{
  expect(ids(orderXQuotes([newer,older,newest],'recent'))).toEqual(['newest','newer','older']);
  expect(ids(orderXQuotes([newest,newer,older],'recent'))).toEqual(['newest','newer','older']);
 });
 it('retains relevant input order and original popularity rules',()=>{
  expect(ids(orderXReplies([newer,older],'relevant'))).toEqual(['newer','older']);
  expect(ids(orderXReplies([newer,older],'likes'))).toEqual(['older','newer']);
  expect(ids(orderXQuotes([newer,older],'popular'))).toEqual(['older','newer']);
 });
 it('does not mutate sources or fabricate identities, stats or timestamps',()=>{
  const input=Object.freeze([newer,older]),before=JSON.stringify(input);
  expect(orderXReplies(input,'recent')[0]).toBe(newer);expect(orderXQuotes(input,'popular')[0]).toBe(older);expect(JSON.stringify(input)).toBe(before);
 });
 it('preserves stable input order for genuinely equal timestamps/popularity',()=>{
  const equal=post('equal',newer.createdAt!,newer.stats.likes);
  expect(ids(orderXReplies([newer,equal],'recent'))).toEqual(['newer','equal']);expect(ids(orderXQuotes([equal,newer],'popular'))).toEqual(['equal','newer']);
 });
});

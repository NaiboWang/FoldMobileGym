import { describe, expect, it } from 'vitest';
import { evaluateExpression, type AngleUnit } from '../system/Calculator/expressionEngine';
const value = (text: string, angle: AngleUnit = 'rad') => { const result=evaluateExpression(text,angle); expect(result.kind).toBe('success'); if(result.kind!=='success')throw Error(text); return result.value; };
describe('Owned scientific expression grammar',()=>{
 it('matches the reference calculator decimal results and keeps shortest round-trip displays',()=>{
  const first=evaluateExpression('80×2÷3×0.79'),second=evaluateExpression('5350÷3');
  expect(first).toMatchObject({kind:'success',value:42.13333333333333,display:'42.13333333333333'});
  expect(second).toMatchObject({kind:'success',value:1783.3333333333333,display:'1783.3333333333333'});
  expect(evaluateExpression('0.1+0.2')).toMatchObject({kind:'success',value:0.3,display:'0.3'});
  expect(evaluateExpression('1e-200/1e-200')).toMatchObject({kind:'success',value:1,display:'1'});
  expect(evaluateExpression('1/1e-400')).toMatchObject({kind:'error',error:'overflow'});
 });
 it.each([['2+3*4',14],['(2+3)*4',20],['2^3^2',512],['-2^2',-4],['(-2)^2',4],['2^-3',.125],['2π',2*Math.PI],['πe',Math.PI*Math.E],['ππ',Math.PI*Math.PI],['(2+3)4',20],['e2',Math.E*2],['2(3+4)',14],['(2)(3)',6],['2e3+1',2001],['.5+.25',.75],['80×2÷3×0.79',42.13333333333333],['3!',6],['0!',1],['5!+2',122],['sqrt(9)',3],['cbrt(-8)',-2],['root(-32,5)',-2],['root(16,4)',2],['ln(e)',1],['log(100)',2],['exp(1)',Math.E],['abs(-3)',3],['sin(pi/2)',1],['cos(pi)',-1],['200+10%',220],['200-10%',180],['200*10%',20],['200/10%',2000]] as const)('evaluates %s', (text,expected)=>expect(value(text)).toBeCloseTo(expected,11));
 it.each([['sin(30)',.5],['cos(60)',.5],['tan(45)',1],['asin(.5)',30],['acos(.5)',60],['atan(1)',45]] as const)('supports degree mode %s',(text,expected)=>expect(value(text,'deg')).toBeCloseTo(expected,11));
 it.each(['2+','(2+3','2+3)','sqrt9','sin()','root(8)','unknown(1)','1..2','2e+','alert(1)','Math.sin(1)','1;2','[1]','1e9999foo','2,3','('.repeat(40)+'1'+')'.repeat(40)])('rejects invalid/incomplete syntax %s',text=>{const result=evaluateExpression(text);expect(result.kind).toBe('error');if(result.kind==='error')expect(result.validExpression).toBe(false);expect(result.operations).toEqual([]);});
 it.each([['1/0','divideZero'],['sqrt(-1)','domain'],['ln(0)','domain'],['log(-1)','domain'],['(-1)!','domain'],['1.5!','domain'],['171!','overflow'],['1e309','overflow'],['2^2000','overflow'],['root(2,0)','domain'],['asin(2)','domain']])('reports bounded mathematical failure %s',(text,error)=>{const result=evaluateExpression(text);expect(result.kind).toBe('error');if(result.kind==='error'){expect(result.error).toBe(error);expect(result.validExpression).toBe(true);}});
 it('rejects trig poles in degrees',()=>{const r=evaluateExpression('tan(90)','deg');expect(r.kind).toBe('error');});
 it('does not evaluate partial operations before syntax is fully validated',()=>expect(evaluateExpression('1+2+').operations).toEqual([]));
 it('returns actual post-order binary operands for research evidence',()=>{const r=evaluateExpression('2+3*4');expect(r.operations).toEqual([{kind:'binary',operator:'*',left:3,right:4,result:12},{kind:'binary',operator:'+',left:2,right:12,result:14}]);});
 it('records a failed division without inventing a successful outer operation',()=>{const r=evaluateExpression('(1+2)+3/0');expect(r.operations).toEqual([{kind:'binary',operator:'+',left:1,right:2,result:3},{kind:'binary',operator:'/',left:3,right:0,result:null}]);});
 it('never emits non-JSON operands when a relative percent overflows',()=>{const r=evaluateExpression('1e308+1e308%');expect(r.kind).toBe('error');if(r.kind==='error')expect(r.error).toBe('overflow');for(const op of r.operations){if(op.kind==='binary'){expect(Number.isFinite(op.left)).toBe(true);expect(Number.isFinite(op.right)).toBe(true);}else expect(op.args.every(Number.isFinite)).toBe(true);expect(op.result===null||Number.isFinite(op.result)).toBe(true);}});
 it('bounds input size without executing code',()=>{expect(evaluateExpression('1+'.repeat(300)).kind).toBe('error');expect(evaluateExpression('')).toEqual({kind:'empty',operations:[]});});
});

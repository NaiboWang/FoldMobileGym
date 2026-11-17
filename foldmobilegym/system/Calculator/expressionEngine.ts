import type { CalculatorOperator } from './types';

export type AngleUnit = 'rad' | 'deg';
export type MathErrorCode = 'syntax' | 'domain' | 'divideZero' | 'overflow';
export type MathOperation =
  | { kind: 'binary'; operator: CalculatorOperator | '^'; left: number; right: number; result: number | null }
  | { kind: 'function'; name: string; args: number[]; result: number | null };
export type ExpressionResult = { kind: 'empty'; operations: MathOperation[] }
  | { kind: 'success'; value: number; display: string; operations: MathOperation[] }
  | { kind: 'error'; error: MathErrorCode; validExpression: boolean; operations: MathOperation[] };
export const MAX_EXPRESSION_LENGTH = 256;
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'sqrt', 'cbrt', 'root', 'exp', 'abs']);
type Node = { kind: 'number'; value: number; exact: Rational | null } | { kind: 'unary'; operator: '+' | '-'; arg: Node }
  | { kind: 'postfix'; operator: '!' | '%'; arg: Node } | { kind: 'binary'; operator: CalculatorOperator | '^'; left: Node; right: Node }
  | { kind: 'function'; name: string; args: Node[] };
class MathFault extends Error { constructor(readonly code: MathErrorCode) { super(code); } }
export const normalizeExpression = (text: string) => text.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replaceAll('π', ' pi ');
export function formatExpressionNumber(value: number) {
  if (!Number.isFinite(value)) return 'Error';
  return value === 0 ? '0' : String(Number(value.toPrecision(15)));
}

type Rational = { n: bigint; d: bigint };
const MAX_RATIONAL_DIGITS = 512;
const absBig = (value: bigint) => value < 0n ? -value : value;
function gcd(a: bigint, b: bigint): bigint {
  a = absBig(a); b = absBig(b);
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
function rational(n: bigint, d: bigint): Rational | null {
  if (!d) return null;
  const sign = d < 0n ? -1n : 1n, divisor = gcd(n, d);
  n = sign * n / divisor; d = absBig(d) / divisor;
  if (n.toString().length > MAX_RATIONAL_DIGITS || d.toString().length > MAX_RATIONAL_DIGITS) return null;
  return { n, d };
}
function decimalRational(source: string): Rational | null {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) return null;
  const fraction = match[3] ?? '', exponent = Number(match[4] ?? 0);
  const scale = fraction.length - exponent;
  if (Math.abs(scale) > MAX_RATIONAL_DIGITS) return null;
  const digits = `${match[2] || '0'}${fraction}`;
  const numerator = BigInt(digits || '0') * (match[1] === '-' ? -1n : 1n);
  return scale >= 0 ? rational(numerator, 10n ** BigInt(scale)) : rational(numerator * 10n ** BigInt(-scale), 1n);
}
function rationalNumber(value: Rational | null): number | null {
  if (!value) return null;
  if (value.n === 0n) return 0;
  const negative = value.n < 0n;
  const numerator = absBig(value.n), denominator = value.d;
  let exponent = numerator.toString().length - denominator.toString().length;
  if (exponent >= 0 ? numerator < denominator * 10n ** BigInt(exponent) : numerator * 10n ** BigInt(-exponent) < denominator) exponent--;
  const precision = 40, scale = precision - 1 - exponent;
  const scaledNumerator = scale >= 0 ? numerator * 10n ** BigInt(scale) : numerator;
  const scaledDenominator = scale < 0 ? denominator * 10n ** BigInt(-scale) : denominator;
  const significand = scaledNumerator / scaledDenominator;
  const result = Number(`${negative ? '-' : ''}${significand}e${exponent - precision + 1}`);
  return Object.is(result, -0) ? 0 : result;
}

/** Strict owned grammar; no eval/Function, property lookup or downloaded math runtime. */
class Parser {
  private index = 0;
  constructor(private tokens: string[]) {}
  private peek() { return this.tokens[this.index] ?? ''; }
  private take() { return this.tokens[this.index++] ?? ''; }
  parse(min = 0, depth = 0): Node {
    if (depth > 32) throw new MathFault('syntax');
    const token = this.take(); let left: Node;
    if (token === '+' || token === '-') left = { kind: 'unary', operator: token, arg: this.parse(25, depth + 1) };
    else if (token === '(') { left = this.parse(0, depth + 1); if (this.take() !== ')') throw new MathFault('syntax'); }
    else if (token === 'pi' || token === 'e') left = { kind: 'number', value: token === 'pi' ? Math.PI : Math.E, exact: null };
    else if (FUNCTIONS.has(token)) {
      if (this.take() !== '(') throw new MathFault('syntax');
      const args = [this.parse(0, depth + 1)];
      if (this.peek() === ',') { this.take(); args.push(this.parse(0, depth + 1)); }
      if (this.take() !== ')' || args.length !== (token === 'root' ? 2 : 1)) throw new MathFault('syntax');
      left = { kind: 'function', name: token, args };
    } else if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) left = { kind: 'number', value: Number(token), exact: decimalRational(token) };
    else throw new MathFault('syntax');
    while (this.peek()) {
      const next = this.peek();
      if (next === '!' || next === '%') {
        if (40 < min) break;
        this.take(); left = { kind: 'postfix', operator: next, arg: left }; continue;
      }
      const adjacentNumber = /^(?:\d|\.)/.test(next) && [')','pi','e','!','%'].includes(this.tokens[this.index-1]);
      const implicit = adjacentNumber || next === '(' || next === 'pi' || next === 'e' || FUNCTIONS.has(next);
      const operator = implicit ? '*' : next;
      const precedence = operator === '+' || operator === '-' ? 10 : operator === '*' || operator === '/' ? 20 : operator === '^' ? 30 : -1;
      if (precedence < min || precedence < 0) break;
      if (!implicit) this.take();
      const right = this.parse(precedence + (operator === '^' ? 0 : 1), depth + 1);
      left = { kind: 'binary', operator: operator as CalculatorOperator | '^', left, right };
    }
    return left;
  }
  finish() { const node = this.parse(); if (this.index !== this.tokens.length) throw new MathFault('syntax'); return node; }
}

function tokenize(text: string) {
  const tokens: string[] = []; let index = 0;
  while (index < text.length) {
    if (/\s/.test(text[index])) { index++; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(index));
    const name = /^[a-z]+/.exec(text.slice(index));
    if (number) { tokens.push(number[0]); index += number[0].length; }
    else if (name) { tokens.push(name[0]); index += name[0].length; }
    else if ('+-*/^!%(),'.includes(text[index])) tokens.push(text[index++]);
    else throw new MathFault('syntax');
    if (tokens.length > 256) throw new MathFault('syntax');
  }
  return tokens;
}
function finite(value: number) {
  if (Number.isNaN(value)) throw new MathFault('domain');
  if (!Number.isFinite(value)) throw new MathFault('overflow');
  return Object.is(value, -0) ? 0 : value;
}
function factorial(value: number) {
  if (value < 0 || !Number.isInteger(value)) throw new MathFault('domain');
  if (value > 170) throw new MathFault('overflow');
  let answer = 1; for (let n = 2; n <= value; n++) answer *= n; return answer;
}
function callFunction(name: string, args: number[], angle: AngleUnit) {
  const x = args[0], rad = angle === 'deg' ? x * (Math.PI / 180) : x;
  const angular = (value: number) => angle === 'deg' ? value * 180 / Math.PI : value;
  switch (name) {
    case 'sin': return Math.abs(rad) >= Math.PI / 2 && Math.abs(Math.sin(rad)) < 1e-15 ? 0 : Math.sin(rad);
    case 'cos': return Math.abs(Math.cos(rad)) < 1e-15 ? 0 : Math.cos(rad);
    case 'tan': if (Math.abs(rad) < 1e9 && Math.abs(Math.cos(rad)) < 1e-15) throw new MathFault('domain'); return Math.tan(rad);
    case 'asin': return angular(Math.asin(x)); case 'acos': return angular(Math.acos(x)); case 'atan': return angular(Math.atan(x));
    case 'ln': if (x <= 0) throw new MathFault('domain'); return Math.log(x);
    case 'log': if (x <= 0) throw new MathFault('domain'); return Math.log10(x);
    case 'sqrt': return Math.sqrt(x); case 'cbrt': return Math.cbrt(x); case 'exp': return Math.exp(x); case 'abs': return Math.abs(x);
    case 'root': { const n = args[1]; if (n === 0) throw new MathFault('domain'); return x < 0 && Number.isInteger(n) && Math.abs(n % 2) === 1 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n); }
    default: throw new MathFault('syntax');
  }
}
type Evaluation = { value: number; exact: Rational | null };
function exactBinary(operator: CalculatorOperator | '^', left: Rational | null, right: Rational | null): Rational | null {
  if (!left || !right) return null;
  switch (operator) {
    case '+': return rational(left.n * right.d + right.n * left.d, left.d * right.d);
    case '-': return rational(left.n * right.d - right.n * left.d, left.d * right.d);
    case '*': return rational(left.n * right.n, left.d * right.d);
    case '/': return right.n === 0n ? null : rational(left.n * right.d, left.d * right.n);
    case '^': {
      if (right.d !== 1n || absBig(right.n) > 256n || (left.n === 0n && right.n < 0n)) return null;
      const exponent = Number(absBig(right.n));
      if (exponent && (left.n.toString().length * exponent > MAX_RATIONAL_DIGITS || left.d.toString().length * exponent > MAX_RATIONAL_DIGITS)) return null;
      return right.n < 0n ? rational(left.d ** BigInt(exponent), left.n ** BigInt(exponent))
        : rational(left.n ** BigInt(exponent), left.d ** BigInt(exponent));
    }
  }
}
function run(node: Node, angle: AngleUnit, operations: MathOperation[]): Evaluation {
  if (node.kind === 'number') return { value: finite(node.value), exact: node.exact };
  if (node.kind === 'unary') {
    const arg = run(node.arg, angle, operations), sign = node.operator === '-' ? -1 : 1;
    return { value: finite(sign * arg.value), exact: arg.exact ? rational(BigInt(sign) * arg.exact.n, arg.exact.d) : null };
  }
  if (node.kind === 'postfix') {
    const evaluated = run(node.arg, angle, operations), arg = evaluated.value; let result: number | null = null;
    try {
      const exact = node.operator === '%' && evaluated.exact ? rational(evaluated.exact.n, evaluated.exact.d * 100n)
        : node.operator === '!' && evaluated.exact?.d === 1n && evaluated.exact.n >= 0n && evaluated.exact.n <= 170n
          ? rational(BigInt(factorial(Number(evaluated.exact.n))), 1n) : null;
      result = finite(node.operator === '%' ? arg / 100 : factorial(arg));
      return { value: rationalNumber(exact) ?? result, exact };
    } finally { operations.push({ kind: 'function', name: node.operator, args: [arg], result }); }
  }
  if (node.kind === 'function') {
    const evaluated = node.args.map(arg => run(arg, angle, operations)), args = evaluated.map(arg => arg.value); let result: number | null = null;
    try {
      result = finite(callFunction(node.name, args, angle));
      const exact = node.name === 'abs' && evaluated[0]?.exact ? rational(absBig(evaluated[0].exact.n), evaluated[0].exact.d) : null;
      return { value: rationalNumber(exact) ?? result, exact };
    }
    finally { operations.push({ kind: 'function', name: node.name, args, result }); }
  }
  const evaluatedLeft = run(node.left, angle, operations), evaluatedRight = run(node.right, angle, operations);
  const left = evaluatedLeft.value; let right = evaluatedRight.value, exactRight = evaluatedRight.exact;
  if ((node.operator === '+' || node.operator === '-') && node.right.kind === 'postfix' && node.right.operator === '%') {
    right = finite(right * left);
    exactRight = exactBinary('*', evaluatedRight.exact, evaluatedLeft.exact);
  }
  let result: number | null = null;
  try {
    const exact = exactBinary(node.operator, evaluatedLeft.exact, exactRight);
    if (node.operator === '/' && (exactRight ? exactRight.n === 0n : right === 0)) throw new MathFault('divideZero');
    if (exact) {
      result = finite(rationalNumber(exact)!);
      return { value: result, exact };
    }
    result = finite(node.operator === '+' ? left + right : node.operator === '-' ? left - right : node.operator === '*' ? left * right : node.operator === '/' ? left / right : Math.pow(left, right));
    return { value: result, exact: null };
  } finally { operations.push({ kind: 'binary', operator: node.operator, left, right, result }); }
}
export function evaluateExpression(formula: string, angle: AngleUnit = 'rad'): ExpressionResult {
  const operations: MathOperation[] = []; if (!formula.trim()) return { kind: 'empty', operations };
  let validExpression = false;
  try {
    if (formula.length > MAX_EXPRESSION_LENGTH) throw new MathFault('syntax');
    const node = new Parser(tokenize(normalizeExpression(formula))).finish(); validExpression = true;
    const evaluated = run(node, angle, operations), value = evaluated.value;
    return { kind: 'success', value, display: evaluated.exact ? String(value) : formatExpressionNumber(value), operations };
  } catch (error) { return { kind: 'error', error: error instanceof MathFault ? error.code : 'syntax', validExpression, operations }; }
}

import defaults from './data/expressionDefaults.json';
import type { CalculatorState, ExpressionEditorState } from './types';
import { evaluateExpression, MAX_EXPRESSION_LENGTH } from './expressionEngine';

export function initialExpressionEditor(state: CalculatorState): ExpressionEditorState {
  const expression = state.firstOperand !== null && state.operator
    ? `${state.firstOperand}${state.operator}${state.waitingForSecondOperand ? '' : state.display}`
    : state.display === '0' || state.display === 'Error' ? '' : state.display;
  return { ...defaults, expression, angleUnit: 'rad', memory: null, error: null, records: [] };
}
export function editExpressionText(editor: ExpressionEditorState, text: string) {
  return { ...editor, expression: text.slice(0, MAX_EXPRESSION_LENGTH), justEvaluated: false, error: null, lastResult: null };
}
export function replaceExpressionRange(expression: string, start: number, end: number, text: string) {
  const a = Math.max(0, Math.min(expression.length, start)), b = Math.max(a, Math.min(expression.length, end));
  const value = expression.slice(0, a) + text + expression.slice(b);
  if (value.length > MAX_EXPRESSION_LENGTH) return { expression, caret: a };
  return { expression: value, caret: a + text.length };
}
/** All edits preserve the selection outside the replacement; no eval or hidden input. */
export function expressionKeyEdit(editor: ExpressionEditorState, start: number, end: number, key: string) {
  let expression = editor.expression;
  if (editor.justEvaluated && editor.lastResult !== null) {
    if (/^[+\-*/^%!]/.test(key)||['backspace','sign','square','cube','factorial','power','percent','reciprocal','sqrt','cbrt','root','exp','ln','log','pow10','sin','cos','tan','asin','acos','atan'].includes(key)) expression = editor.lastResult==='Error'?'':editor.lastResult;
    else expression = '';
    start = end = expression.length;
  }
  if (key === 'backspace') return start === end
    ? replaceExpressionRange(expression, Math.max(0, start - 1), end, '')
    : replaceExpressionRange(expression, start, end, '');
  if(start===end&&'+-*/^'.includes(key)&&key.length===1&&start>0&&'+-*/^'.includes(expression[start-1])&&!(key==='-'&&'*/^'.includes(expression[start-1])))return replaceExpressionRange(expression,start-1,end,key);
  const functionKeys=['sign','reciprocal','sqrt','cbrt','root','exp','ln','log','pow10','sin','cos','tan','asin','acos','atan','recall'];
  if(start===end&&functionKeys.includes(key)) {
    const prefix=expression.slice(0,start);let atomStart=start;
    if(prefix.endsWith(')')) {let depth=0;for(let i=prefix.length-1;i>=0;i--){if(prefix[i]===')')depth++;else if(prefix[i]==='('&&--depth===0){atomStart=i;while(atomStart>0&&/[a-z]/.test(prefix[atomStart-1]))atomStart--;break;}}}
    else {const atom=/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$|(?:pi|π|e)$/.exec(prefix);if(atom)atomStart=atom.index;}
    if(atomStart>0&&prefix[atomStart-1]==='-'&&(atomStart===1||'+-*/^(,'.includes(prefix[atomStart-2])))atomStart--;
    if(atomStart<start)start=atomStart;
  }
  if(key==='recall')return editor.memory===null?{expression,caret:start}:replaceExpressionRange(expression,start,end,editor.memory<0?`(${editor.memory})`:String(editor.memory));
  const selected = expression.slice(start, end);
  if (key === 'sign') return replaceExpressionRange(expression, start, end, selected ? `(-(${selected}))` : '-');
  const wrapper: Record<string, string> = { square: '^2', cube: '^3', factorial: '!', power: '^', percent: '%' };
  if (wrapper[key]) return replaceExpressionRange(expression, start, end, selected ? `(${selected})${wrapper[key]}` : wrapper[key]);
  if (key === 'reciprocal' || key === 'exp' || key === 'pow10' || ['sqrt','cbrt','ln','log','sin','cos','tan','asin','acos','atan'].includes(key)) {
    const before = key === 'reciprocal' ? '1/(' : key === 'pow10' ? '10^(' : `${key}(`;
    const r = replaceExpressionRange(expression,start,end,`${before}${selected})`);
    return { ...r, caret: selected ? r.caret : start + before.length };
  }
  if (key === 'root') {
    const r = replaceExpressionRange(expression,start,end,`root(${selected},2)`);
    const caret=selected ? start+selected.length+6 : start+5;
    return { ...r, caret, selectionEnd:selected?caret+1:caret };
  }
  let text = key === 'pi' ? 'π' : key;
  if((key==='pi'||key==='e')&&/[0-9.)!%πe]$/.test(expression.slice(0,start)))text='*'+text;
  else if(/^[0-9.]$/.test(key)&&/[)πe!%]$/.test(expression.slice(0,start)))text='*'+text;
  if((key==='pi'||key==='e')&&/^[0-9.(πe]/.test(expression.slice(end)))text+='*';
  return replaceExpressionRange(expression,start,end,text);
}
export function expressionPreview(editor: ExpressionEditorState) { return evaluateExpression(editor.expression,editor.angleUnit); }

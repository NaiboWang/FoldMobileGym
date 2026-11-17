import React, { useCallback, useEffect, useRef } from 'react';
import { useAnswerSheetStore } from '../state';
import type { Field } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';

// ── 选择型字段 ──
const ChoiceField: React.FC<{
  field: Field;
  index: number;
  value: string | undefined;
  disabled: boolean;
  onSelect: (fieldIndex: number, value: string) => void;
}> = ({ field, index, value, disabled, onSelect }) => {
  const { bindTap } = useTriggerGestures();
  return (
  <div role="radiogroup" aria-label={field.label} className="space-y-2 min-w-0">
    {field.options?.map((option) => (
      <button
        key={option}
        disabled={disabled}
        {...bindTap({ kind: 'action', id: 'answerSheet.choice.item.choose' }, { params: { fieldIndex: index, value: option }, onTrigger: () => onSelect(index, option) })}
        role="radio" aria-checked={value === option}
        className={`w-full min-w-0 py-3.5 px-4 rounded-xl text-base font-medium text-left transition-all break-words [overflow-wrap:anywhere]
          ${value === option
            ? 'bg-blue-500 text-white shadow-sm'
            : 'bg-white text-slate-700 border border-slate-200 active:bg-slate-50'
          }`}
      >
        {option}
      </button>
    ))}
  </div>
);
};

// ── 数字/文本输入字段 ──
const InputField: React.FC<{
  field: Field;
  index: number;
  value: string | undefined;
  disabled: boolean;
  onChange: (fieldIndex: number, value: string) => void;
}> = ({ field, index, value, disabled, onChange }) => {
  const S=useAppStrings(strings,stringsEn);
  return (
  <input
    type="text"
    inputMode={field.type === 'number' ? 'decimal' : 'text'}
    value={value ?? ''}
    disabled={disabled}
    onChange={(e) => onChange(index, e.target.value)}
    aria-label={field.label}
    data-action="answerSheet.field.item.input" data-action-type="input"
    data-action-params={JSON.stringify({ fieldIndex:index, value:value ?? '' })}
    placeholder={field.hint || (field.type === 'number' ? S.placeholder_number : S.placeholder_text)}
    className="w-full min-w-0 py-3 px-4 rounded-xl border border-slate-200 bg-white
      text-base text-slate-900 placeholder:text-slate-400
      focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
  />
);
};

// ── 可重复字段 ──
const RepeatableField: React.FC<{
  field: Field;
  index: number;
  values: string[];
  disabled: boolean;
  onAdd: (fieldIndex: number) => void;
  onRemove: (fieldIndex: number, itemIndex: number) => void;
  onUpdate: (fieldIndex: number, itemIndex: number, value: string) => void;
}> = ({ field, index, values, disabled, onAdd, onRemove, onUpdate }) => {
  const S=useAppStrings(strings,stringsEn), { bindTap }=useTriggerGestures();
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const prevLenRef = useRef(values.length);

  useEffect(() => {
    let frame: number | null=null;
    if(values.length>prevLenRef.current)frame=requestAnimationFrame(()=>{
      const button=addBtnRef.current;
      if(button?.isConnected && button.getClientRects().length)button.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    prevLenRef.current=values.length;
    return()=>{if(frame!==null)cancelAnimationFrame(frame);};
  },[values.length]);

  return (
  <div className="space-y-2">
    {values.map((val, itemIdx) => (
      <div key={itemIdx} className="flex items-center gap-2 min-w-0" data-answer-row={itemIdx}>
        {field.type === 'choice' && field.options ? (
          <select
            value={val}
            disabled={disabled}
            onChange={(e) => onUpdate(index, itemIdx, e.target.value)}
            aria-label={S.repeatable_item_label.replace('{field}',field.label).replace('{index}',String(itemIdx+1))}
            data-action="answerSheet.repeatable.item.input" data-action-type="input"
            data-action-params={JSON.stringify({ fieldIndex:index,itemIndex:itemIdx,value:val })}
            className="flex-1 min-w-0 w-0 py-3 px-4 rounded-xl border border-slate-200 bg-white
              text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">{S.placeholder_select}</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            inputMode={field.type === 'number' ? 'decimal' : 'text'}
            value={val}
            disabled={disabled}
            onChange={(e) => onUpdate(index, itemIdx, e.target.value)}
            aria-label={S.repeatable_item_label.replace('{field}',field.label).replace('{index}',String(itemIdx+1))}
            data-action="answerSheet.repeatable.item.input" data-action-type="input"
            data-action-params={JSON.stringify({ fieldIndex:index,itemIndex:itemIdx,value:val })}
            placeholder={field.hint || S.placeholder_text}
            className="flex-1 min-w-0 w-0 py-3 px-4 rounded-xl border border-slate-200 bg-white
              text-base text-slate-900 placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
        <button
          disabled={disabled}
          data-keep-keyboard
          aria-label={S.remove_item_label.replace('{index}',String(itemIdx+1))}
          {...bindTap({ kind: 'action', id: 'answerSheet.repeatable.item.remove' }, { params:{fieldIndex:index,itemIndex:itemIdx}, onTrigger: () => onRemove(index,itemIdx) })}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full
            text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors text-lg"
        >
          ✕
        </button>
      </div>
    ))}
    <button ref={addBtnRef}
      disabled={disabled}
      data-keep-keyboard
      {...bindTap({ kind: 'action', id: 'answerSheet.repeatable.item.add' }, { params:{fieldIndex:index}, onTrigger: () => onAdd(index) })}
      className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300
        text-slate-500 text-sm font-medium hover:border-blue-400 hover:text-blue-500
        transition-colors active:bg-slate-50"
    >
      {S.add_item}
    </button>
  </div>
  );
};

// ── 主页面 ──
const SheetPage: React.FC = () => {
  const S=useAppStrings(strings,stringsEn), { bindTap }=useTriggerGestures();
  const { question, hint, fields, answers, submitted } = useAnswerSheetStore();
  const { setAnswer, addRepeatableItem, removeRepeatableItem,
    updateRepeatableItem, submit, unsubmit } = useAnswerSheetStore();

  const handleChoiceSelect = useCallback((fieldIndex: number, value: string) => {
    setAnswer(fieldIndex, value);
  }, [setAnswer]);

  const handleInputChange = useCallback((fieldIndex: number, value: string) => {
    setAnswer(fieldIndex, value);
  }, [setAnswer]);

  const handleSubmit = useCallback(() => {
    if (submitted) {
      unsubmit();
    } else {
      submit();
    }
  }, [submitted, submit, unsubmit]);

  if (!fields || fields.length === 0) {
    return (
      <div data-answer-sheet data-status-bar-foreground="dark" className="h-full w-full min-w-0 flex items-center justify-center bg-app-bg pt-10 px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-lg text-slate-500">{S.empty_title}</p>
          <p className="text-sm text-slate-400 mt-1">{S.empty_hint}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-answer-sheet data-status-bar-foreground="dark" className="h-full w-full min-w-0 min-h-0 bg-app-bg pt-10 flex flex-col overflow-hidden">
      <div data-scroll-container="question" data-scroll-direction="vertical" className="px-5 pt-4 pb-3 flex-shrink-0 min-w-0 max-h-[30%] overflow-y-auto [overflow-wrap:anywhere]">
        <h1 className="text-lg font-semibold text-slate-900 leading-snug">
          {question || S.default_question}
        </h1>
        {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-5 pb-4"
        data-scroll-container="sheet-form" data-scroll-direction="vertical">
        <div className="space-y-5">
          {fields.map((field, idx) => {
            const answer = answers[String(idx)];
            return (
              <div key={idx} className="space-y-2 min-w-0 [overflow-wrap:anywhere]" data-answer-field={idx}>
                <div className="block text-sm font-medium text-slate-600">
                  {field.label}
                </div>
                {field.repeatable ? (
                  <RepeatableField field={field} index={idx}
                    values={Array.isArray(answer) ? answer : []}
                    disabled={submitted}
                    onAdd={addRepeatableItem} onRemove={removeRepeatableItem}
                    onUpdate={updateRepeatableItem} />
                ) : field.type === 'choice' ? (
                  <ChoiceField field={field} index={idx}
                    value={typeof answer === 'string' ? answer : undefined}
                    disabled={submitted}
                    onSelect={handleChoiceSelect} />
                ) : (
                  <InputField field={field} index={idx}
                    value={typeof answer === 'string' ? answer : undefined}
                    disabled={submitted}
                    onChange={handleInputChange} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 flex-shrink-0 border-t border-slate-100" data-hide-on-keyboard>
        {submitted && (
          <div className="text-center text-green-600 text-sm font-medium mb-3
            flex items-center justify-center gap-1.5">
            <span className="text-lg">✓</span> {S.submitted_label}
          </div>
        )}
        <button {...(submitted
          ? bindTap({kind:'action',id:'answerSheet.form.modify'},{onTrigger:handleSubmit})
          : bindTap({kind:'action',id:'answerSheet.form.submit'},{onTrigger:handleSubmit}))}
          className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all
            active:scale-[0.98] ${submitted
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'}`}>
          {submitted ? S.btn_modify : S.btn_submit}
        </button>
      </div>
    </div>
  );
};

export default SheetPage;

import React from 'react';
import { CalcButton } from './CalcButton';
import { useCalculator2Store } from '../state';
import { useCalculator2Gestures } from '../hooks/useCalculator2Gestures';
import { colors } from '../res/colors';
import { strings } from '../res/strings';

/**
 * 数字键盘 — 3列4行 grid
 * 翻译自 AOSP pad_numeric.xml
 *
 * 7 8 9
 * 4 5 6
 * 1 2 3
 * . 0 =
 */
interface NumericPadProps {
  style?: React.CSSProperties;
}

export const NumericPad: React.FC<NumericPadProps> = ({ style }) => {
  const inputDigit = useCalculator2Store(s => s.inputDigit);
  const inputDecimal = useCalculator2Store(s => s.inputDecimal);
  const onEvaluate = useCalculator2Store(s => s.onEvaluate);
  const { bindAction } = useCalculator2Gestures();

  const digits = [
    { value: '7', actionId: 'calc.digit.7' }, { value: '8', actionId: 'calc.digit.8' }, { value: '9', actionId: 'calc.digit.9' },
    { value: '4', actionId: 'calc.digit.4' }, { value: '5', actionId: 'calc.digit.5' }, { value: '6', actionId: 'calc.digit.6' },
    { value: '1', actionId: 'calc.digit.1' }, { value: '2', actionId: 'calc.digit.2' }, { value: '3', actionId: 'calc.digit.3' },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--app-surface)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        paddingTop: 'var(--app-pad-numeric-padding-top)',
        paddingBottom: 'var(--app-pad-numeric-padding-bottom)',
        paddingLeft: 'var(--app-pad-numeric-padding-sides)',
        paddingRight: 'var(--app-pad-numeric-padding-sides)',
        ...style,
      }}
    >
      {digits.map(({ value, actionId }) => (
        <CalcButton
          key={value}
          label={value}
          fontSize="var(--app-numeric-button-text)"
          textColor="var(--app-on-surface)"
          rippleColor={colors.ripple}
          onTrigger={() => inputDigit(value)}
          {...bindAction(actionId, { value })}
        />
      ))}
      {/* 底行: . 0 = */}
      <CalcButton
        label={strings.decimal}
        fontSize="var(--app-numeric-button-text)"
        textColor="var(--app-on-surface)"
        rippleColor={colors.ripple}
        onTrigger={inputDecimal}
        {...bindAction('calc.input.decimal', { value: '.' })}
      />
      <CalcButton
        label="0"
        fontSize="var(--app-numeric-button-text)"
        textColor="var(--app-on-surface)"
        rippleColor={colors.ripple}
        onTrigger={() => inputDigit('0')}
        {...bindAction('calc.digit.0', { value: '0' })}
      />
      <CalcButton
        label={strings.equals}
        fontSize="var(--app-equals-button-text)"
        textColor="var(--app-on-surface)"
        rippleColor={colors.ripple}
        onTrigger={onEvaluate}
        {...bindAction('calc.result.evaluate')}
      />
    </div>
  );
};

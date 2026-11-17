import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { MemoryRouter, useLocation, useSearchParams, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { useCalculatorGestures } from './hooks/useCalculatorGestures';
import { useCalculatorStore } from './state';
import { useActivityContext } from '../../os/ActivityContext';
import { TaskManager } from '../../os/TaskManager';
import { ownsHistoryDeletion } from './historyOwnership';
import { useAppStrings } from '../../os/useAppStrings';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { IcHistory, IcCalculator } from './res/icons';
import { CalculatorExpression } from './components/CalculatorExpression';
import { CalculatorHistorySheet } from './components/CalculatorHistorySheet';
import { calculatorHistoryParent, isCalculatorHistoryParent } from './historyEditing';
import { getTracker } from '../../os/utils/memoryHistoryTracker';
import './reference.css';

// 导航处理器 - 统一的返回逻辑
const CalculatorNavigationHandler: React.FC = () => {
  const location = useLocation();
  const { back, navigateTo } = useCalculatorGestures();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  // Keep the registered OS Back command stable while the committed route changes.
  const navigationRef = useRef({ location, back, navigateTo });
  useLayoutEffect(() => { navigationRef.current = { location, back, navigateTo }; }, [location, back, navigateTo]);
  // 跟踪历史索引
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const { location: currentLocation, back: backNow, navigateTo: navigateNow } = navigationRef.current;
    const memoryNavigator = navigator as any;
    const tracker = getTracker(navigator as object);
    const currentIndex = typeof memoryNavigator.index === 'number'
      ? memoryNavigator.index
      : tracker?.index ?? historyIndexRef.current;
    const parent = calculatorHistoryParent(currentLocation.search);
    if (parent !== null && !isCalculatorHistoryParent(parent, tracker?.stack[currentIndex - 1])) {
      navigateNow(parent, { replace: true });
      return true;
    }

    if (currentIndex > 0) {
      backNow();
      return true;
    }
    if (parent !== null) {
      navigateNow(parent, { replace: true });
      return true;
    }
    return false;
  }, [navigator]);

  useAppNavigationHandler('calculator', { onBack: handleBackPress });

  return null;
};

const CalculatorContent: React.FC = () => {
  const display = useCalculatorStore(s => s.display);
  const editor = useCalculatorStore(s => s.expressionEditor);
  const { taskId, activityId } = useActivityContext();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const historyOpen = ['open', 'edit'].includes(searchParams.get('history') ?? '');
  const s = useAppStrings(strings, stringsEn);
  const { inputKey: handleInput, selectOperator: handleOp, calculate, clear,
    toggleSign, percent: handlePercent } = useCalculatorStore.getState();
  const { bindTap } = useCalculatorGestures();

  const getDisplayClass = (text: string) => {
    const len = text.length;
    if (len < 8) return 'text-6xl';
    if (len < 11) return 'text-5xl';
    if (len < 14) return 'text-4xl';
    if (len < 17) return 'text-3xl';
    return 'text-2xl';
  };

  const Btn = ({ label, actionProps, className = '' }: {
    label: string; actionProps: React.HTMLAttributes<HTMLButtonElement>; className?: string;
  }) => (
    <button
      {...actionProps}
      className={`calculator-reference-key h-16 w-16 rounded-full text-xl font-medium flex items-center justify-center transition-opacity active:opacity-60 ${className}`}
    >
      {label}
    </button>
  );

  if (editor) return <><CalculatorExpression historyOpen={historyOpen} />{historyOpen && <CalculatorHistorySheet />}</>;

  return (
    <>
    <div className="calculator-reference h-full bg-app-bg text-app-text flex flex-col p-6 pt-16" data-scroll-container="main" data-scroll-direction="vertical" inert={historyOpen} aria-hidden={historyOpen ? true : undefined}>
      <button type="button" className="calculator-history-open" aria-label={s.history_title} aria-haspopup="dialog" aria-expanded={historyOpen}
        {...bindTap('calculator.home.history.open')}>
        <IcHistory size={21} aria-hidden="true" />
      </button>
      <button type="button" className="calculator-scientific-toggle" data-calculator-layout-toggle aria-label={s.scientific_show} {...bindTap({ kind: 'action', id: 'calculator.expression.scientific.toggle' }, { onTrigger: () => {const multi=window.__FOLDAGENT__?.getState().multi_window;const floating=multi?.mode==='floating'&&multi.floating&&!multi.floating.minimized?multi.floating.task_id:null;if(useCalculatorStore.getState().expressionEditor===undefined&&ownsHistoryDeletion({alive:!historyOpen,taskId,activityId,href:`${location.pathname}${location.search}`},TaskManager.getState(),window.__OS__?.getAppRoute('calculator')?.path,floating))useCalculatorStore.getState().toggleScientific();} })}><IcCalculator size={21} /></button>
      <div className="calculator-reference-display flex-1 flex flex-col justify-end pb-8 overflow-hidden w-full">
        <div className={`w-full flex overflow-x-auto no-scrollbar items-end ${getDisplayClass(display)}`}>
          <div data-calculator-display className="ml-auto font-light whitespace-nowrap">
            {display}
          </div>
        </div>
      </div>

      <div className="calculator-reference-keypad grid grid-cols-4 gap-4 mb-8">
        <Btn label="AC" actionProps={bindTap({ kind: 'action', id: 'calculator.home.clear' }, { onTrigger: clear })} className="bg-gray-400 text-black" />
        <Btn label="+/-" actionProps={bindTap({ kind: 'action', id: 'calculator.home.sign' }, { onTrigger: toggleSign })} className="bg-gray-400 text-black" />
        <Btn label="%" actionProps={bindTap({ kind: 'action', id: 'calculator.home.percent' }, { onTrigger: handlePercent })} className="bg-gray-400 text-black" />
        <Btn label="÷" actionProps={bindTap({ kind: 'action', id: 'calculator.home.operator.press' }, { params: { value: '/' }, onTrigger: () => handleOp('/') })} className="bg-app-primary" />

        <Btn label="7" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '7' }, onTrigger: () => handleInput('7') })} className="bg-gray-800" />
        <Btn label="8" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '8' }, onTrigger: () => handleInput('8') })} className="bg-gray-800" />
        <Btn label="9" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '9' }, onTrigger: () => handleInput('9') })} className="bg-gray-800" />
        <Btn label="×" actionProps={bindTap({ kind: 'action', id: 'calculator.home.operator.press' }, { params: { value: '*' }, onTrigger: () => handleOp('*') })} className="bg-app-primary" />

        <Btn label="4" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '4' }, onTrigger: () => handleInput('4') })} className="bg-gray-800" />
        <Btn label="5" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '5' }, onTrigger: () => handleInput('5') })} className="bg-gray-800" />
        <Btn label="6" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '6' }, onTrigger: () => handleInput('6') })} className="bg-gray-800" />
        <Btn label="-" actionProps={bindTap({ kind: 'action', id: 'calculator.home.operator.press' }, { params: { value: '-' }, onTrigger: () => handleOp('-') })} className="bg-app-primary" />

        <Btn label="1" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '1' }, onTrigger: () => handleInput('1') })} className="bg-gray-800" />
        <Btn label="2" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '2' }, onTrigger: () => handleInput('2') })} className="bg-gray-800" />
        <Btn label="3" actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '3' }, onTrigger: () => handleInput('3') })} className="bg-gray-800" />
        <Btn label="+" actionProps={bindTap({ kind: 'action', id: 'calculator.home.operator.press' }, { params: { value: '+' }, onTrigger: () => handleOp('+') })} className="bg-app-primary" />

        <div className="col-span-2">
          <button
            {...bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '0' }, onTrigger: () => handleInput('0') })}
            className="h-16 w-full rounded-full bg-gray-800 text-xl font-medium px-8 flex items-center justify-start transition-opacity active:opacity-60"
          >
            0
          </button>
        </div>
        <Btn label="." actionProps={bindTap({ kind: 'action', id: 'calculator.home.keypad.press' }, { params: { value: '.' }, onTrigger: () => handleInput('.') })} className="bg-gray-800" />
        <Btn label="=" actionProps={bindTap({ kind: 'action', id: 'calculator.home.calculate.submit' }, { onTrigger: calculate })} className="bg-app-primary" />
      </div>
    </div>
    {historyOpen && <CalculatorHistorySheet />}
    </>
  );
};

export const CalculatorApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };
  return (
    <div className="calculator-reference-host h-full w-full" style={cssVars as React.CSSProperties}>
    <MemoryRouter>
      <CalculatorNavigationHandler />
      <CalculatorContent />
    </MemoryRouter>
    </div>
  );
};

export default CalculatorApp;

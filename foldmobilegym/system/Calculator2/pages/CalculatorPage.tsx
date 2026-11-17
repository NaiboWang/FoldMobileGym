import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Display } from '../components/Display';
import { NumericPad } from '../components/NumericPad';
import { OperatorPad } from '../components/OperatorPad';
import { AdvancedPad } from '../components/AdvancedPad';
import { SwipeablePads } from '../components/SwipeablePads';

/**
 * 计算器主页面 — 翻译自 AOSP activity_calculator_port.xml
 *
 * 布局结构 (竖屏):
 *   状态栏 + 显示区 (白底, elevation shadow) — wrap_content
 *   SwipeablePads (ViewPager, flex=1)
 *     Page 0: 数字区(weight=264) + 运算符区(weight=96)
 *     Page 1: 科学面板(7/9 宽)
 */
export const CalculatorPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const panelPage = searchParams.get('panel') === 'advanced' ? 1 : 0;

  return (
    <div
      className="h-full flex flex-col"
    >
      {/* 显示区 — 白底延伸到状态栏，pt-10 = 40px 状态栏占位 */}
      <div className="bg-app-bg pt-10">
        <Display />
      </div>

      {/* 键盘区 — ViewPager 模拟 */}
      <SwipeablePads
        page={panelPage}
        onPageChange={(page) => setSearchParams(page === 1 ? { panel: 'advanced' } : {}, { replace: true })}
      >
        {/* Page 0: 数字 + 运算符 */}
        <div className="flex h-full w-full">
          <NumericPad style={{ flex: 'var(--app-pad-numeric-weight)' }} />
          <OperatorPad style={{ flex: 'var(--app-pad-operator-weight)' }} />
        </div>

        {/* Page 1: 科学面板 */}
        <AdvancedPad className="h-full" />
      </SwipeablePads>
    </div>
  );
};

import React from 'react';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { ALIPAY_CONFIG } from '../data';
import { IcNavBack, IcEye, IcEyeOff, IcMore, IcNavForward, IcInfo, IcClock, IcSecureCheck } from '../res/icons';
import { MyPage } from './MyPage';

const example = ALIPAY_CONFIG.referenceYuebao;
const formatMoney = (amount: number) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recording 80:55 cover layout; figures remain replaceable simulator examples. */
export const YuebaoPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindBack, bindTap } = useAlipayGestures();
  const [visible, setVisible] = React.useState(true);
  const amount = (value: number) => visible ? formatMoney(value) : '****';
  return (
    <div className="alipay-reference-yuebao-layout">
      <aside className="alipay-reference-yuebao-master" aria-label={s.tabbar_me}>
        <MyPage accountOnly selectedAccount="yuebao" accountBindings={{
          settings: bindTap<HTMLButtonElement>('settings.open'),
          bill: bindTap<HTMLDivElement>('bill.open'),
          balance: bindTap<HTMLDivElement>('balance.open'),
          assets: bindTap<HTMLDivElement>('assets.open'),
          yuebao: bindTap<HTMLDivElement>('yuebao.open', { onTrigger: () => {} }),
          bankCards: bindTap<HTMLButtonElement>('bankCards.open'),
        }} />
      </aside>
    <div className="alipay-reference-yuebao" data-status-bar-foreground="light" data-navigation-bar-foreground="dark">
      <header className="alipay-reference-yuebao-header">
        <button type="button" {...bindBack<HTMLButtonElement>()} aria-label={s.reference_yuebao_back}><IcNavBack size={24} /></button>
        <div><h1>{s.yue_bao}</h1><p>{s.reference_yuebao_simulated_rate} {example.annualizedRate}</p></div>
        <span aria-hidden="true"><IcMore size={24} /></span>
      </header>
      <div className="alipay-reference-yuebao-scroll no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        <section className="alipay-reference-yuebao-card">
          <div className="alipay-reference-yuebao-total-label">
            <span>{s.yuebao_page_total}</span>
            <button type="button" aria-label={visible ? s.reference_finance_hide_amounts : s.reference_finance_show_amounts} aria-pressed={!visible}
              {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'alipay.yuebao.amount.visibility.toggle' }, { onTrigger: () => setVisible(value => !value) })}>
              {visible ? <IcEye size={17} /> : <IcEyeOff size={17} />}
            </button>
            <span className="alipay-reference-yuebao-safety"><IcSecureCheck size={12} />{s.yuebao_page_safe}</span>
          </div>
          <div className="alipay-reference-yuebao-total">{amount(example.total)}<IcNavForward size={18} aria-hidden="true" /></div>
          <div className="alipay-reference-yuebao-buckets">
            <div><span>{s.reference_yuebao_available}</span><strong>{amount(example.available)}</strong></div>
            <div><span>{s.reference_yuebao_saved}</span><strong>{amount(example.saved)}</strong></div>
          </div>
          <div className="alipay-reference-yuebao-income">
            <div><span>{s.yuebao_page_yesterday_label}<IcInfo size={12} /></span><strong className="alipay-reference-yuebao-income-yesterday">{visible ? (example.yesterdayIncome === null ? s.yuebao_page_no_earnings : formatMoney(example.yesterdayIncome)) : '****'}</strong></div>
            <div><span>{s.yuebao_page_cumulative_label}</span><strong>{amount(example.cumulativeIncome)}</strong></div>
            <div><span>{s.reference_yuebao_income_plus}</span><span className="alipay-reference-yuebao-tree">{s.yuebao_page_money_tree}</span></div>
          </div>
          <div className="alipay-reference-yuebao-transfers">
            <button type="button" disabled title={s.reference_yuebao_unavailable}>{s.yuebao_page_out}</button>
            <button type="button" disabled title={s.reference_yuebao_unavailable}>{s.yuebao_page_in}</button>
          </div>
          <div className="alipay-reference-yuebao-schedule"><IcClock size={15} />{s.yuebao_page_schedule}<IcNavForward size={12} /></div>
          <div className="alipay-reference-yuebao-account-services"><span>{s.reference_yuebao_account_services}</span><span>{s.yuebao_page_icon_more}<IcNavForward size={12} /></span></div>
          <p className="alipay-reference-yuebao-scope">{s.reference_yuebao_unavailable}</p>
        </section>
        <section className="alipay-reference-yuebao-notice">
          <h2>{s.reference_yuebao_income_notice}</h2>
          <p>{s.reference_yuebao_no_new_income}</p>
        </section>
        <section className="alipay-reference-yuebao-products">
          <h2>{s.yuebao_page_steady}<span>{s.yuebao_page_steady_more}</span></h2>
          <div><span>{s.yuebao_page_current_row}</span><strong>{example.currentRate}</strong></div>
          <div><span>{s.reference_yuebao_term_product}</span><span>{s.reference_yuebao_not_provided}</span></div>
        </section>
        <p className="alipay-reference-yuebao-disclaimer">{s.reference_finance_simulation}</p>
      </div>
    </div>
    </div>
  );
};

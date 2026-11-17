import { cdn } from '../../../os/utils/cdn';
import { TaobaoProductImage } from '../components/TaobaoProductImage';
import { useTaobaoGestures } from '../hooks/useTaobaoGestures';
import { useTaobaoStrings } from '../hooks/useTaobaoStrings';
import { filterTaobaoOrders, normalizeTaobaoOrderStatus, type TaobaoOrderStatus } from '../orderModel';
import { IcBack, IcChevron, IcSearch } from '../res/icons';
import { useTaobaoStore } from '../state';
import { useSearchParams } from 'react-router-dom';

const PRODUCT_CDN = cdn('taobao/images');

export function TaobaoOrdersPage() {
  const s = useTaobaoStrings();
  const [searchParams] = useSearchParams();
  const { bindBack, bindTap } = useTaobaoGestures();
  const orders = useTaobaoStore(state => state.orders);
  const products = useTaobaoStore(state => state.products);
  const status = normalizeTaobaoOrderStatus(searchParams.get('status'));
  const visibleOrders = filterTaobaoOrders(orders, status);
  const tabs: Array<{ id: TaobaoOrderStatus; label: string }> = [
    { id: 'all', label: s.orders_all },
    { id: 'pendingPay', label: s.me_pending_pay },
    { id: 'pendingShip', label: s.me_pending_ship },
    { id: 'pendingReceive', label: s.me_pending_receive },
    { id: 'afterSale', label: s.me_refund },
    { id: 'pendingReview', label: s.orders_pending_review },
    { id: 'closed', label: s.orders_closed },
  ];
  const statusLabel = (value: TaobaoOrderStatus) => ({
    all: s.orders_all,
    pendingPay: s.order_status_pending_pay,
    pendingShip: s.order_status_pending_ship,
    pendingReceive: s.order_status_pending_receive,
    afterSale: s.order_status_after_sale,
    pendingReview: s.order_status_pending_review,
    closed: s.order_status_closed,
  })[value];

  return <div className="tb-page tb-orders-page" data-status-bar-foreground="dark" data-benchmark-order-status={status}>
    <header className="tb-orders-header">
      <button aria-label={s.orders_back} {...bindBack<HTMLButtonElement>()}><IcBack size={23}/></button>
      <h1>{s.orders_title}</h1>
      <div><IcSearch size={20}/><span className="tb-orders-grid-icon" aria-hidden="true">⌗</span><span className="tb-orders-more" aria-hidden="true">•••</span></div>
    </header>
    <nav className="tb-orders-channels" aria-label={s.orders_channel_label}>
      <span>{s.orders_channel_all}</span><b>{s.orders_channel_shopping}</b><span>{s.orders_channel_used}</span><span>{s.orders_channel_travel}</span>
    </nav>
    <nav className="tb-orders-status-tabs" aria-label={s.orders_status_label} data-scroll-container="status" data-scroll-direction="horizontal">
      {tabs.map(tab => tab.id === status
        ? <span key={tab.id} className="active" aria-current="page">{tab.label}</span>
        : <button key={tab.id} {...bindTap<HTMLButtonElement>('taobao.orders.status.switch', { params: { status: tab.id } })}>{tab.label}</button>)}
    </nav>
    <div className="tb-orders-promo"><span>▣</span><p>{s.orders_promo}</p><IcChevron size={15}/></div>
    <main className="tb-scroll tb-orders-list" data-scroll-container="main" data-scroll-direction="vertical">
      {visibleOrders.length ? visibleOrders.flatMap((order, index) => {
        const product = products.find(item => item.id === order.productId);
        if (!product) return [];
        return <article className="tb-order-card" key={order.id} data-benchmark-order-id={order.id}>
          <header><div><span className="tb-order-market">{s.orders_channel_shopping}</span><strong>{product.shop}</strong><IcChevron size={14}/></div><b>{statusLabel(order.status)}</b></header>
          <button className="tb-order-product" {...bindTap<HTMLButtonElement>('taobao.product.open', { params: { id: product.id } })}>
            <TaobaoProductImage className="tb-order-thumbnail" priority={index < 3 ? 'high' : 'auto'} src={`${PRODUCT_CDN}/${product.image}`} alt={product.title}/>
            <span className="tb-order-copy"><strong>{product.title}</strong><small>{product.tag} · {s.detail_service}</small></span>
            <span className="tb-order-price"><strong>¥{order.paidPrice}</strong><small>×{order.quantity}</small></span>
          </button>
          <footer><p>{s.order_paid} <strong>¥{order.paidPrice * order.quantity}</strong></p><div><span>{s.order_action_logistics}</span><span className="primary">{s.order_action_detail}</span></div></footer>
        </article>;
      }) : <section className="tb-orders-empty"><span>▢</span><h2>{s.orders_empty}</h2><p>{s.orders_empty_hint}</p></section>}
    </main>
  </div>;
}

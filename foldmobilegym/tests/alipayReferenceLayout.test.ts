import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NAVIGATION_DECLARATION } from '../apps/Alipay/navigation.declaration';
import { REFERENCE_LIFE_SERVICES } from '../apps/Alipay/constants';
import { ICON_REGISTRY } from '../apps/Alipay/res/icons';
import { localizeServiceName } from '../apps/Alipay/utils/localizeCatalog';

describe('Alipay reference account layout', () => {
  it('preserves the recording order and four rows of five public life services', () => {
    expect(REFERENCE_LIFE_SERVICES.map(service => service.id)).toEqual([
      'phone', 'lifePay', 'health', 'civicCenter', 'myExpress',
      'cainiao', 'helloRide', 'railway12306', 'amapTaxi', 'fliggy',
      'traffic12123', 'carLife', 'nationalGov', 'stateCouncil', 'medical',
      'job', 'didiRide', 'carpool', 'homeRent', 'studyChina',
    ]);
    expect(new Set(REFERENCE_LIFE_SERVICES.map(service => service.id)).size).toBe(20);
    for (const service of REFERENCE_LIFE_SERVICES) expect(ICON_REGISTRY).toHaveProperty(service.icon);
  });
  it('localizes every recording life-directory entry without changing its identity', () => {
    for (const service of REFERENCE_LIFE_SERVICES) {
      expect(localizeServiceName(service.id, service.name, false)).toBe(service.name);
      expect(localizeServiceName(service.id, service.name, true)).not.toMatch(/\p{Script=Han}/u);
    }
  });
  it('models service search as a pushed URL panel and query as an unbounded parameter', () => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/');
    expect(route?.queryParams).toHaveProperty('q', 'string');
    expect(route?.uiStates.some(state => 'servicePanel' in state.search && state.search.servicePanel === 'search')).toBe(true);
    expect(NAVIGATION_DECLARATION.transitions.find(transition => transition.id === 'home.services.search.open')?.mode).toBe('push');
    expect(NAVIGATION_DECLARATION.transitions.find(transition => transition.id === 'home.services.search.submit')?.mode).toBe('replace');
    const component = readFileSync(new URL('../apps/Alipay/components/ReferenceServiceSearch.tsx', import.meta.url), 'utf8');
    expect(component).toContain("search.get('q')");
    expect(component).not.toContain('fetch(');
  });
  it('keeps savings examples in config and marks unsupported transfers as disabled', () => {
    const page = readFileSync(new URL('../apps/Alipay/pages/YuebaoPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('ALIPAY_CONFIG.referenceYuebao');
    expect(page).toContain('data-scroll-container="main"');
    expect(page).toContain('type="button" disabled');
    expect(page).not.toContain('fixed top-0');
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/yuebao');
    expect(route?.scrollContainers.map(container => container.name)).toEqual(['main', 'account']);
    expect(route?.uiStates[0].actions?.some(action => action.id === 'alipay.yuebao.amount.visibility.toggle')).toBe(true);
  });
  it('gives finance a scoped header and URL-driven service pane without fixed screen overlays', () => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/finance');
    expect(route?.scrollContainers.map(container => container.name)).toEqual(['main', 'services']);
    expect(route?.uiStates.some(state => 'serviceCollection' in state.search && state.search.serviceCollection === 'favorites')).toBe(true);
    const page = readFileSync(new URL('../apps/Alipay/pages/FinancePage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('alipay-reference-finance-services');
    expect(page).toContain('ALIPAY_CONFIG.financeMarketIndices');
    expect(page).not.toContain('fixed left-0');
    expect(NAVIGATION_DECLARATION.transitions.find(transition => transition.id === 'transfer.open')?.from).toContain('/finance');
  });
  it('keeps an unfolded account master beside balance without duplicate main scrollers', () => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/balance');
    expect(route?.scrollContainers.map(container => container.name)).toEqual(['main', 'account']);
    const page = readFileSync(new URL('../apps/Alipay/pages/BalancePage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('<MyPage accountOnly accountBindings=');
    expect(page).toContain('data-scroll-container="main"');
    expect(page).not.toContain('fixed top-0');
    for (const id of ['settings.open', 'bill.open', 'balance.open', 'assets.open', 'yuebao.open', 'bankCards.open', 'tab.home', 'tab.my']) {
      expect(NAVIGATION_DECLARATION.transitions.find(transition => transition.id === id)?.from).toContain('/balance');
    }
  });
  it('marks the visible category without introducing another URL tab', () => {
    const component = readFileSync(new URL('../apps/Alipay/components/ReferenceServices.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../apps/Alipay/reference.css', import.meta.url), 'utf8');
    expect(component).toContain("scrollRoot.addEventListener('scroll', schedule, { passive: true, capture: true })");
    expect(component).toContain("aria-current={visibleCategory === category.id ? 'location' : undefined}");
    expect(component).toContain('resize.disconnect()');
    expect(css).toContain('button[aria-current="location"]');
  });
  it('reserves the status bar outside scrolling panes and offsets sticky category targets', () => {
    const css = readFileSync(new URL('../apps/Alipay/reference.css', import.meta.url), 'utf8');
    expect(css).toContain('overflow: hidden; padding-top: 40px;');
    expect(css).toContain('.alipay-reference-services { padding-top: 0; isolation: isolate; }');
    expect(css).toContain('[data-service-category] { scroll-margin-top: 72px; }');
  });
  it('gives the home tab its own independent services pane', () => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/');
    expect(route?.scrollContainers.map(container => container.name)).toEqual(['main', 'services']);
    const page = readFileSync(new URL('../apps/Alipay/pages/HomePage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('alipay-reference-home-services');
    expect(page).not.toContain('fixed top-10');
  });
  it('models recent/favorites in the URL on both reference tabs', () => {
    for (const path of ['/', '/my']) {
      const route = NAVIGATION_DECLARATION.routes.find(route => route.path === path);
      expect(route?.uiStates.some(state => 'serviceCollection' in state.search && state.search.serviceCollection === 'favorites')).toBe(true);
    }
  });
  it('declares distinct folded/main and expanded column scroll surfaces', () => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/my');
    expect(route?.scrollContainers.map(container => container.name)).toEqual(['main', 'account', 'services']);
  });
  it('reuses the existing transfer transition from the account tab', () => {
    const transition = NAVIGATION_DECLARATION.transitions.find(transition => transition.id === 'transfer.open');
    expect(transition?.from).toContain('/my');
    expect(transition?.to).toBe('/pay/transfer');
  });
  it('binds the service entry at its actual route component and uses CSS-only posture layout', () => {
    const page = readFileSync(new URL('../apps/Alipay/pages/MyPage.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../apps/Alipay/reference.css', import.meta.url), 'utf8');
    expect(page).toContain("transferProps={bindTap<HTMLButtonElement>('transfer.open')}");
    expect(page).not.toContain('fixed top-0');
    expect(css).toContain('@container (min-width: 600px)');
    expect(css).toContain('html[data-foldagent-posture="unfolded"]');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { settleShopNavigation } from '../foldagent_navigation_settle';

const action = { id: 'meituan.shop.open', params: { id: 'shop' } };
function probe(states: Array<{ appId: string; path: string }>) {
  let frame = 0;
  return { read: vi.fn(() => states[Math.min(frame, states.length - 1)]),
    now: () => frame * 100,
    nextFrame: vi.fn(async () => { frame++; }) };
}
const route = (path: string, appId = 'meituan_waimai') => ({ appId, path });
describe('Shop navigation completion, not a fixed frame delay', () => {
  it('does not wait when the actual route is already ready', async () => {
    const p = probe([route('/shop/shop')]); await settleShopNavigation(action, p);
    expect(p.nextFrame).not.toHaveBeenCalled();
  });
  it('waits past two frames when the real route is delayed', async () => {
    const p = probe([route('/'), route('/'), route('/'), route('/shop/shop')]);
    await settleShopNavigation(action, p); expect(p.nextFrame).toHaveBeenCalledTimes(3);
  });
  it('does not accept a different shop', async () => {
    const p = probe([route('/shop/other'), route('/shop/shop')]);
    await settleShopNavigation(action, p); expect(p.nextFrame).toHaveBeenCalledTimes(1);
  });
  it.each(['?origin=%2F', '?origin=%2F%3Fsearch%3Dopen&channel=waimai', '#menu', '?origin=%2F#menu'])
    ('accepts the same shop with route context: %s', async suffix => {
      const p = probe([route('/shop/shop' + suffix)]);
      await settleShopNavigation(action, p);
      expect(p.nextFrame).not.toHaveBeenCalled();
    });
  it('does not accept the expected shop named only in another route query', async () => {
    const p = probe([route('/shop/other?next=/shop/shop'), route('/shop/shop?origin=%2F')]);
    await settleShopNavigation(action, p);
    expect(p.nextFrame).toHaveBeenCalledTimes(1);
  });
  it('does not accept the right route in a background app', async () => {
    const p = probe([route('/shop/shop', 'notes'), route('/shop/shop')]);
    await settleShopNavigation(action, p); expect(p.nextFrame).toHaveBeenCalledTimes(1);
  });
  it.each(['中文/店', 'literal%2Fmenu', 'a?b#c'])('encodes one literal shop ID: %s', async id => {
    const p = probe([route(`/shop/${encodeURIComponent(id)}`)]);
    await settleShopNavigation({ ...action, params: { id } }, p);
    expect(p.nextFrame).not.toHaveBeenCalled();
  });
  it('keeps encoded question marks and hashes inside the shop ID', async () => {
    const p = probe([route('/shop/a%3Fb%23c?origin=%2F')]);
    await settleShopNavigation({ ...action, params: { id: 'a?b#c' } }, p);
    expect(p.nextFrame).not.toHaveBeenCalled();
  });
  it('reports an environment navigation error rather than inventing progress', async () => {
    const p = probe([route('/')]);
    await expect(settleShopNavigation(action, p, 200)).rejects.toThrow('Shop navigation did not settle');
    expect(p.nextFrame).toHaveBeenCalledTimes(2);
  });
  it.each([{ id: 'dom.click' }, { ...action, valid: false }, { id: action.id },
    { ...action, params: { id: '' } }, { ...action, params: { id: 1 } }])
    ('leaves unrelated/invalid/malformed action unchanged: %j', async value => {
      const p = probe([route('/')]); await settleShopNavigation(value, p);
      expect(p.read).not.toHaveBeenCalled(); expect(p.nextFrame).not.toHaveBeenCalled();
    });
});

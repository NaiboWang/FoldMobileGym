import { describe, expect, it } from 'vitest';
import { filterAndSortTaobaoProducts, normalizeTaobaoSearchSort } from '../apps/Taobao/searchModel';

const products = [
  { id: 'a', title: '旗舰手机', shop: '品牌旗舰店', tag: '官方立减', sold: 200, price: 4299 },
  { id: 'b', title: '便携显示器', shop: '数码实验室', tag: '受控比价', sold: 30, price: 899 },
  { id: 'c', title: '智能手表', shop: '智能生活馆', tag: '限时优惠', sold: 120, price: 599 },
];

describe('Taobao search result model', () => {
  it('normalizes unknown sort values to the declared comprehensive order', () => {
    expect(normalizeTaobaoSearchSort(null)).toBe('default');
    expect(normalizeTaobaoSearchSort('unexpected')).toBe('default');
    expect(normalizeTaobaoSearchSort('sales')).toBe('sales');
  });

  it('filters title, shop and tag without mutating catalog order', () => {
    const snapshot = structuredClone(products);
    expect(filterAndSortTaobaoProducts(products, '旗舰店', 'default').map(item => item.id)).toEqual(['a']);
    expect(filterAndSortTaobaoProducts(products, '受控', 'default').map(item => item.id)).toEqual(['b']);
    expect(filterAndSortTaobaoProducts(products, '智能', 'default').map(item => item.id)).toEqual(['c']);
    expect(products).toEqual(snapshot);
  });

  it('sorts sales descending and keeps source order for ties', () => {
    const tied = [...products, { ...products[1], id: 'd' }];
    expect(filterAndSortTaobaoProducts(tied, '', 'sales').map(item => item.id)).toEqual(['a', 'c', 'b', 'd']);
  });
});

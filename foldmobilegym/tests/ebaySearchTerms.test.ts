import { describe, expect, it } from 'vitest';
import products from '../apps/Ebay/data/products.json';
import { matchesEbaySearchQuery } from '../apps/Ebay/utils/localize';
import type { ProductItem } from '../apps/Ebay/types';

const catalog = products as ProductItem[];
const ids = (query: string) => catalog.filter(p => matchesEbaySearchQuery(p, query)).map(p => p.id);

describe('eBay visible-label catalog search', () => {
  it.each([
    ['Fans', ['fan', 'radiator-fan']],
    ['电风扇', ['fan']],
    ['Computers', ['laptop']],
    ['电脑', ['laptop']],
  ])('resolves %s to the original complete catalog identities', (query, types) => {
    expect(ids(query as string)).toEqual(catalog.filter(p => (types as string[]).includes(p.typeId)).map(p => p.id));
  });
  it('preserves case-insensitive and whitespace-insensitive matching', () => {
    expect(ids('  cOm PuTeRs \n')).toEqual(ids('Computers'));
  });
  it('keeps original Chinese and brand queries available', () => {
    const product = catalog[0];
    expect(matchesEbaySearchQuery(product, product.title)).toBe(true);
    expect(matchesEbaySearchQuery(product, product.brand)).toBe(true);
    expect(matchesEbaySearchQuery(product, 'Dyson Fans Electronics')).toBe(true);
  });
  it('preserves empty queries and rejects absent terms without changing products', () => {
    const before = JSON.stringify(catalog);
    expect(ids('')).toHaveLength(catalog.length);
    expect(ids('QA-No-Such-Catalog-7312')).toEqual([]);
    expect(JSON.stringify(catalog)).toBe(before);
  });
});

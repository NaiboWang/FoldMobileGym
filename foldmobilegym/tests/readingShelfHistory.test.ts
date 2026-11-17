import { describe, expect, it } from 'vitest';
import { shelfBackFallback, shelfReturnDelta } from '../apps/WechatReading/utils/shelfHistory';
const page = (pathname: string, search = '') => ({ pathname, search });
describe('shelf completion history target', () => {
  it('returns to the real base shelf through any number of nested entries', () => {
    expect(shelfReturnDelta([page('/'),page('/bookshelf'),page('/bookshelf','?select=true'),page('/bookshelf','?select=true&modal=private_reading')],3)).toBe(2);
    expect(shelfReturnDelta([page('/bookshelf'),page('/book/4'),page('/bookshelf','?select=true'),page('/bookshelf','?select=true&modal=confirm_remove')],3)).toBe(3);
  });
  it('does not mistake selection or an unrelated page for a base shelf', () => {
    expect(shelfReturnDelta([page('/'),page('/bookshelf','?select=true'),page('/bookshelf','?select=true&modal=private_reading')],2)).toBeNull();
    expect(shelfReturnDelta([page('/bookshelf','?select=true&modal=private_reading')],0)).toBeNull();
    expect(shelfReturnDelta([page('/book/4')],0)).toBeNull();
  });
  it('rejects unknown history indices instead of guessing a pop distance', () => {
    for (const index of [-1,1,NaN,0.5]) expect(shelfReturnDelta([page('/bookshelf')],index)).toBeNull();
  });
});

describe('shelf Back logical parent', () => {
  for (const modal of ['confirm_remove','private_reading']) {
    it('dismisses cold ' + modal + ' to selection, not an unrelated page', () => {
      const current = page('/bookshelf','?select=true&modal=' + modal);
      expect(shelfBackFallback(current)).toBe('/bookshelf?select=true');
      expect(shelfBackFallback(current,page('/'))).toBe('/bookshelf?select=true');
      expect(shelfBackFallback(current,page('/read/4'))).toBe('/bookshelf?select=true');
      expect(shelfBackFallback(current,page('/bookshelf','?select=true'))).toBeNull();
    });
  }
  it('dismisses cold selection to base, but retains a real warm parent', () => {
    const current = page('/bookshelf','?select=true');
    expect(shelfBackFallback(current)).toBe('/bookshelf');
    expect(shelfBackFallback(current,page('/'))).toBe('/bookshelf');
    expect(shelfBackFallback(current,page('/bookshelf'))).toBeNull();
  });
  it('does not rewrite base shelf, other routes or unknown modal states', () => {
    expect(shelfBackFallback(page('/bookshelf'))).toBeNull();
    expect(shelfBackFallback(page('/read/4','?modal=confirm_remove'))).toBeNull();
    expect(shelfBackFallback(page('/bookshelf','?select=true&modal=unknown'))).toBeNull();
  });
  it('handles an overlay without selection without inventing selected books', () => {
    expect(shelfBackFallback(page('/bookshelf','?modal=private_reading'))).toBe('/bookshelf');
  });
});

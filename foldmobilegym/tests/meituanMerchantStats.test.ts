import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MeituanMerchantStats } from '../apps/MeituanWaimai/components/MeituanMerchantStats';
const source = Object.freeze({rating:'4.6',sales:'1024 synthetic sales',time:'24 synthetic minutes'});
const labels = {ratingLabel:'Rating',salesLabel:'Sales',deliveryTimeLabel:'Delivery time'};
describe('Meituan supplied merchant statistics',()=>{
  it('places every localized term before its exact supplied definition',()=>{
    const html=renderToStaticMarkup(createElement(MeituanMerchantStats,{shop:source,labels}));
    expect(html).toContain('<dl class="mt-merchant-stats">');
    expect(html).toContain('<dt>Rating</dt><dd>4.6</dd>');
    expect(html).toContain('<dt>Sales</dt><dd>1024 synthetic sales</dd>');
    expect(html).toContain('<dt>Delivery time</dt><dd>24 synthetic minutes</dd>');
    expect(source).toEqual({rating:'4.6',sales:'1024 synthetic sales',time:'24 synthetic minutes'});
  });
  it('keeps source text unchanged when labels are localized',()=>{
    const html=renderToStaticMarkup(createElement(MeituanMerchantStats,{shop:source,labels:{ratingLabel:'Note',salesLabel:'Ventes',deliveryTimeLabel:'Temps'}}));
    expect(html).toContain('<dt>Note</dt><dd>4.6</dd>');expect(html).toContain('<dt>Temps</dt><dd>24 synthetic minutes</dd>');
  });
  it('does not invent unavailable totals or render source text as HTML',()=>{
    const empty=renderToStaticMarkup(createElement(MeituanMerchantStats,{shop:{rating:'',sales:'',time:''},labels}));
    expect(empty.match(/<dd><\/dd>/g)).toHaveLength(3);
    const html=renderToStaticMarkup(createElement(MeituanMerchantStats,{shop:{...source,sales:'<img src=x>'},labels}));
    expect(html).not.toContain('<img');expect(html).toContain('&lt;img src=x&gt;');
  });
});

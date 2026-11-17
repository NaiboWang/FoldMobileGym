import React, { useState } from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcStore } from '../res/icons';
import { meituanLocalImage } from '../menuModel';
import type { Shop } from '../types';
import { MeituanPhoto } from './MeituanPhoto';
import { MeituanMerchantStats } from './MeituanMerchantStats';

export function MeituanMerchantHeader({ shop }: { shop: Shop }) {
  const t = useAppStrings(strings, stringsEn);
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const cover = meituanLocalImage(shop.coverImage, window.location.origin);
  const logo = meituanLocalImage(shop.logoImage, window.location.origin);
  return <>
    <div className="mt-merchant-cover" data-meituan-cover>
      <MeituanPhoto key={cover ?? 'missing'} src={cover} label={cover ? shop.name : t.coverUnavailable}
        fallback={<><IcStore size={35}/><span>{t.coverUnavailable}</span></>}/>
    </div>
    <section className="mt-shop-banner mt-merchant-summary" data-meituan-merchant-summary>
      <div className="mt-shop-logo"><MeituanPhoto key={logo ?? 'missing'} src={logo} label={shop.name} fallback={<IcStore size={30}/>}/></div>
      <div className="mt-merchant-source"><h1>{shop.name}</h1><MeituanMerchantStats shop={shop} labels={t}/><p className="mt-merchant-scope">{t.merchantDisclaimer}</p></div>
    </section>
    <section className="mt-fulfillment" data-meituan-fulfillment aria-label={t.fulfillmentMethod}>
      <div className="mt-fulfillment-switch" role="tablist" aria-label={t.fulfillmentMethod}>
        <button type="button" role="tab" aria-selected={fulfillment === 'delivery'} data-fulfillment-mode="delivery"
          className={fulfillment === 'delivery' ? 'selected' : ''} onClick={() => setFulfillment('delivery')}>{t.deliveryMode}</button>
        <button type="button" role="tab" aria-selected={fulfillment === 'pickup'} data-fulfillment-mode="pickup"
          className={fulfillment === 'pickup' ? 'selected' : ''} onClick={() => setFulfillment('pickup')}>{t.pickupMode}</button>
      </div>
      {fulfillment === 'pickup' && <p role="status" data-pickup-unavailable>{t.pickupUnavailable}</p>}
    </section>
  </>;
}

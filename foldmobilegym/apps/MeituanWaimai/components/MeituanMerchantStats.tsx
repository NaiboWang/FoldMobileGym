import React from 'react';
import type { Shop } from '../types';

/** The labels describe the supplied source values; no vendor totals or timings are inferred. */
export function MeituanMerchantStats({ shop, labels }: {
  shop: Pick<Shop, 'rating' | 'sales' | 'time'>;
  labels: { ratingLabel: string; salesLabel: string; deliveryTimeLabel: string };
}) {
  return <dl className="mt-merchant-stats">
    <div><dt>{labels.ratingLabel}</dt><dd>{shop.rating}</dd></div>
    <div><dt>{labels.salesLabel}</dt><dd>{shop.sales}</dd></div>
    <div><dt>{labels.deliveryTimeLabel}</dt><dd>{shop.time}</dd></div>
  </dl>;
}

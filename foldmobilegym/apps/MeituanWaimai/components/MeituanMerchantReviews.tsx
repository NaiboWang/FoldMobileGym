import {readReviewMediaRequest,resolveReviewMedia,reviewMediaSourceKey,type ReviewMediaRequest} from '../reviewMedia';
import {useMeituanReviewModal} from '../hooks/useMeituanReviewModal';
import React, { useLayoutEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAppStrings } from '../../../os/useAppStrings';
import { useLocale } from '../../../os/locale';
import * as TimeService from '../../../os/TimeService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useMeituanGestures } from '../hooks/useMeituanGestures';
import { filterMeituanReviews, meituanReviewSource, readMeituanReviewFilter, type MeituanReviewFilter } from '../reviewModel';
import { meituanLocalImage } from '../menuModel';
import type { Shop, ShopReview } from '../types';
import { MeituanPhoto } from './MeituanPhoto';

export function MeituanMerchantReviews({ shop, search, onFilter, mediaRequest, onMediaOpen, onMediaClose, onMediaStep }: {
  shop: Shop; search: string; onFilter: (filter: MeituanReviewFilter) => void;
  mediaRequest?: ReviewMediaRequest;
  onMediaOpen?: (reviewId: string, index: number) => void;
  onMediaClose?: () => void;
  onMediaStep?: (direction: 'previous' | 'next') => void;
}) {
  const t = useAppStrings(strings, stringsEn), locale = useLocale(), { bindTap, bindBack } = useMeituanGestures();
  const source = meituanReviewSource(shop), filter = readMeituanReviewFilter(search);
  const demo = source === undefined;
  const rootRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const panel = rootRef.current;
    const scroller = panel?.closest<HTMLElement>('[data-scroll-container="menu"]');
    if (!panel || !scroller?.checkVisibility()) return;
    // Keep a collapsed merchant header collapsed, but discard an old menu/list
    // offset. Geometry is measured in logical CSS pixels, including shell zoom.
    const frame = scroller.getBoundingClientRect();
    const scale = frame.height > 0 ? scroller.clientHeight / frame.height : 1;
    const panelOffset = scroller.scrollTop + (panel.getBoundingClientRect().top - frame.top) * scale;
    const tabHeight = scroller.querySelector<HTMLElement>('.mt-menu-tabs')?.offsetHeight ?? 0;
    scroller.scrollTop = Math.min(scroller.scrollTop, Math.max(0, panelOffset - tabHeight));
  }, [shop.id, filter]);
  // Preserve the same two existing, explicitly labeled demo records, never use
  // them to replace an empty/invalid supplied source or to invent merchant totals.
  const reviews: ShopReview[] = source ?? (demo ? [
    { id: 'demo-1', author: t.demoReview + ' 1', text: t.reviewOne, rating: 5 },
    { id: 'demo-2', author: t.demoReview + ' 2', text: t.reviewTwo, rating: 5 },
  ] : []);
  const visible = filter === null || source === null ? null : filterMeituanReviews(reviews, filter);
  const count = (value: MeituanReviewFilter) => source === null ? '—' : filterMeituanReviews(reviews, value).length;
  const request = mediaRequest ?? readReviewMediaRequest(search);
  const view = resolveReviewMedia(request, source);
  const active = request.kind !== 'closed';
  const selectedReview = view.kind === 'open' ? view.review : undefined;
  const selectedImages = view.kind === 'open' ? view.images : [];
  const selectedIndex = view.kind === 'open' ? view.index : -1;
  const selectedSrc = selectedIndex >= 0 ? meituanLocalImage(selectedImages[selectedIndex], window.location.origin) : undefined;
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageHandlers = useMeituanReviewModal(active,dialogRef,search+'|'+reviewMediaSourceKey(shop),direction=>{
    if (view.kind === 'open' && (direction === 'previous' ? view.index > 0 : view.index < view.images.length - 1)) onMediaStep?.(direction);
  },()=>onMediaClose?.());
  return <section ref={rootRef} className="mt-merchant-reviews" data-meituan-reviews data-meituan-review-scope={demo ? 'demo' : 'source'}>
    <div data-meituan-reviews-background>
    <h2>{t.reviewsTitle}</h2>
    <p className="mt-reviews-notice">{demo ? t.reviewsDisclaimer : t.reviewSourceNotice}</p>
    <div className="mt-review-filters" role="group" aria-label={t.reviewFilters}>
      <button {...bindTap('meituan.reviews.filter.all', { onTrigger: () => onFilter('all') })} aria-pressed={filter === 'all'}>{t.reviewAll} {count('all')}</button>
      <button {...bindTap('meituan.reviews.filter.latest', { onTrigger: () => onFilter('latest') })} aria-pressed={filter === 'latest'}>{t.reviewLatest}</button>
      <button {...bindTap('meituan.reviews.filter.positive', { onTrigger: () => onFilter('positive') })} aria-pressed={filter === 'positive'}>{t.reviewPositive} {count('positive')}</button>
      <button {...bindTap('meituan.reviews.filter.negative', { onTrigger: () => onFilter('negative') })} aria-pressed={filter === 'negative'}>{t.reviewNegative} {count('negative')}</button>
      <button {...bindTap('meituan.reviews.filter.media', { onTrigger: () => onFilter('media') })} aria-pressed={filter === 'media'}>{t.reviewMedia} {count('media')}</button>
    </div>
    {visible === null ? <p role="status" data-meituan-reviews-invalid>{source === null ? t.reviewInvalid : t.reviewFilterInvalid}</p> : <>
      {filter === 'latest' && visible.some(r => r.createdAt === undefined) && <p className="mt-reviews-notice" data-meituan-review-undated>{t.reviewUndated}</p>}
      {visible.length === 0 && <p role="status" data-meituan-reviews-empty>{t.reviewEmpty}</p>}
      {visible.map(review => {
        const avatar = meituanLocalImage(review.avatarImage, window.location.origin);
        return <article className="mt-review mt-source-review" key={review.id} data-meituan-review-id={review.id}>
          <header className="mt-review-identity">
            <div className="mt-review-avatar"><MeituanPhoto key={avatar} src={avatar} label={review.author} fallback={Array.from(review.author)[0]}/></div>
            <div><b>{review.author}</b><small>{review.rating === undefined ? t.reviewUnrated : t.reviewRating.replace('{rating}', String(review.rating))}</small></div>
            {review.createdAt !== undefined && <time dateTime={TimeService.fromTimestamp(review.createdAt).toISOString()}>{TimeService.fromTimestamp(review.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-CN')}</time>}
          </header>
          <p>{review.text}</p>
          {Boolean(review.images?.length) && <div className="mt-review-media" data-meituan-review-media>{review.images!.map((image, index) => {
            const src = meituanLocalImage(image, window.location.origin), label = t.reviewPhoto.replace('{index}', String(index + 1));
            return <button key={index} className="mt-review-media-item" type="button" disabled={!src}
              {...(src && onMediaOpen ? bindTap('meituan.reviews.media.open', { params: { reviewId: review.id, index }, onTrigger: () => onMediaOpen(review.id, index) }) : {})}
              aria-label={label} title={src ? label : t.reviewMediaUnavailable}>
              <MeituanPhoto key={src} src={src} label={label} fallback={t.reviewMediaUnavailable}/>
            </button>;
          })}</div>}
          {review.merchantReply && <div className="mt-review-reply" data-meituan-review-reply><strong>{t.reviewReply}</strong><p>{review.merchantReply}</p></div>}
        </article>;
      })}
    </>}
    </div>
    {active && <div ref={dialogRef} tabIndex={-1} className="mt-review-lightbox" role="dialog" aria-modal="true" aria-label={t.reviewMediaViewer} data-meituan-review-lightbox>
      <div className="mt-review-lightbox-head"><b>{selectedReview?.author ?? t.reviewMediaViewer}</b><button type="button" aria-label={t.reviewMediaClose} title={t.reviewMediaClose}
        {...bindBack()}><X size={22}/></button></div>
      {view.kind === 'open' ? <>
      <div className="mt-review-lightbox-stage" {...stageHandlers}>
        <button type="button" className="mt-review-lightbox-nav" disabled={selectedIndex <= 0} aria-label={t.reviewMediaPrevious} title={t.reviewMediaPrevious}
          {...(selectedIndex > 0 && onMediaStep ? bindTap('meituan.reviews.media.previous', { onTrigger: () => onMediaStep('previous') }) : {})}><ChevronLeft size={26}/></button>
        <div className="mt-review-lightbox-image"><MeituanPhoto key={selectedSrc} src={selectedSrc} label={t.reviewPhoto.replace('{index}', String(selectedIndex + 1))} fallback={t.reviewMediaUnavailable}/></div>
        <button type="button" className="mt-review-lightbox-nav" disabled={selectedIndex >= selectedImages.length - 1} aria-label={t.reviewMediaNext} title={t.reviewMediaNext}
          {...(selectedIndex < selectedImages.length - 1 && onMediaStep ? bindTap('meituan.reviews.media.next', { onTrigger: () => onMediaStep('next') }) : {})}><ChevronRight size={26}/></button>
      </div>
      <div className="mt-review-lightbox-counter">{t.reviewMediaCounter.replace('{index}', String(selectedIndex + 1)).replace('{total}', String(selectedImages.length))}</div></> : <div className="mt-review-lightbox-stage"><p role="status">{t.reviewMediaSourceUnavailable}</p></div>}
    </div>}
  </section>;
}

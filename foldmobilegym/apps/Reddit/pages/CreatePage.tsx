import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { useContext } from 'react';
import { useActivityId } from '@/os/ActivityContext';
import { useCreateBackGuard } from '../hooks/useCreateBackGuard';
import { createSheet, hasUnsentPost, discardBackSteps } from '../createOverlayPolicy';
import { useAppStrings } from '@/os/useAppStrings';
import { IcClose, IcExpand, IcCollapse, IcLinkSimple, IcImage, IcPlayCircle, IcList, IcSend } from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import * as MediaService from '../../../os/MediaService';
import * as TimeService from '../../../os/TimeService';
import { getUserAvatar } from '../utils/userIdentity';
import { useRedditRouteOwner } from '../hooks/useRedditRouteOwner';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { pickedPostImage } from '../utils/postImage';
import { RemotePostImage } from '../components/RemotePostImage';

/* ── flair data per community ── */
const COMMUNITY_FLAIRS: Record<string, string[]> = {
  games: [
    'Announcement', 'Release', 'Update', 'Mod News', 'Trailer', 'Review',
    'Preview', 'Overview', 'Patchnotes', 'Opinion Piece', 'Retrospective',
    'Industry News', 'Sale Event', 'Discussion', 'Impression Thread', 'Indie Sunday',
  ],
  music: [
    'Discussion', 'New Release', 'Article', 'AMA', 'Playlist',
    'Music Video', 'Live Performance', 'Album Review', 'Throwback', 'Recommendation',
  ],
  china_irl: [
    '新闻', '讨论', '观点', '科技', '历史', '文化',
    '生活', '娱乐', '政治', '经济', '教育', '问答',
  ],
  otherside: [
    'Discussion', 'Question', 'Story',
    'Rant', 'Advice', 'Wholesome',
  ],
};


const TOOL_ITEMS = [
  { icon: IcLinkSimple, label: 'Link' },
  { icon: IcImage, label: 'Image' },
  { icon: IcPlayCircle, label: 'Video' },
  { icon: IcList, label: 'List' },
] as const;

/* ── CreatePage ── */
export const CreatePage: React.FC = () => {
  const { bindBack, bindTap, back, go, canGoBack } = useRedditGestures();
  const s = useAppStrings(strings, stringsEn), owner = useRedditRouteOwner('/create');
  const location = useLocation();
  const { createDraft, user } = useRedditStore(useShallow((s) => ({ createDraft: s.createDraft, user: s.user })));
  const storeAddFlair = useRedditStore((s) => s.addFlair);
  const storeCreatePost = useRedditStore((s) => s.createPost);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const sheet = createSheet(location.search), guard = useCreateBackGuard();
  const { navigator } = useContext(UNSAFE_NavigationContext), activityId = useActivityId();
  const dialog = useRef<HTMLDivElement | null>(null), opener = useRef<HTMLElement | null>(null), closeButton = useRef<HTMLButtonElement | null>(null);
  const ownerRef = useRef(owner); useLayoutEffect(() => { ownerRef.current = owner; });
  const overlaySource = useRef({ key: location.key, draft: createDraft });
  if (sheet && overlaySource.current.key !== location.key) overlaySource.current = { key: location.key, draft: createDraft };
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [pickingImage, setPickingImage] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const sourceActor = useRef(user.username), submitted = useRef(false), imageRequest = useRef(0), imageClaim = useRef(false);
  const rootEntry = useRef(location.pathname === '/create' ? location.key : null);
  useEffect(() => () => { imageRequest.current++; }, []);
  useLayoutEffect(() => {
    if (location.pathname !== '/create' || sheet || rootEntry.current === location.key) return;
    // A child-route Back resumes this flow; a distinct editor intent starts a
    // new flow and invalidates old async completions without persisting UI data.
    rootEntry.current = location.key;
    imageRequest.current++; imageClaim.current = false; submitted.current = false;
    sourceActor.current = useRedditStore.getState().user.username;
    setTitle(''); setBody(''); setImageUris([]); setPickingImage(false); setMediaError(false);
  }, [location.key, location.pathname, sheet]);
  const ownsFlow = () => owner() && !submitted.current && useRedditStore.getState().user.username === sourceActor.current;
  const ownsDraft = () => !sheet && ownsFlow();
  const ownsOverlay = () => ownsFlow() && useRedditStore.getState().createDraft === overlaySource.current.draft;
  const overlayValid = createDraft === overlaySource.current.draft && user.username === sourceActor.current;
  const closeSheet = () => {
    if (!owner() || !sheet) return;
    document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.__OS__?.keyboard.hide();
    if (canGoBack('/create')) back(); else go('create.overlay.return');
  };
  const openSheet = (kind: 'flair' | 'discard') => {
    if (!ownsDraft()) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : closeButton.current;
    document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.__OS__?.keyboard.hide();
    if (kind === 'flair') go('create.flair.open'); else go('create.discard.open');
  };
  useLayoutEffect(() => {
    const handle = () => {
      if (location.pathname !== '/create' || !owner()) return false;
      if (sheet) { closeSheet(); return true; }
      if (ownsDraft() && hasUnsentPost(title, body, imageUris)) { openSheet('discard'); return true; }
      return false;
    };
    guard.current = handle;
    return () => { if (guard.current === handle) guard.current = null; };
  });
  useLayoutEffect(() => {
    if (!sheet || !dialog.current || !ownerRef.current()) return;
    const node = dialog.current;
    const returnTarget = opener.current?.getAttribute('data-action')?.endsWith('.input') ? closeButton.current : opener.current ?? closeButton.current;
    node.querySelector<HTMLButtonElement>('button:not(:disabled):not([tabindex="-1"])')?.focus({preventScroll:true});
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); window.__OS__?.handleBack(); }
      if (event.key !== 'Tab') return;
      const list = [...node.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), [tabindex="0"]')].filter(el => el.getBoundingClientRect().width > 0);
      const current = list.indexOf(document.activeElement as HTMLElement);
      event.preventDefault(); list[(current + (event.shiftKey ? -1 : 1) + list.length) % list.length]?.focus({preventScroll:true});
    };
    node.addEventListener('keydown', trap);
    return () => {
      node.removeEventListener('keydown', trap);
      requestAnimationFrame(() => {
        const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
        const target = returnTarget;
        if (top?.activityId === activityId && !os?.isLauncherVisible && !os?.isRecentsVisible && target?.isConnected && !target.closest('[inert]') && !window.__OS__?.keyboard.getState().visible) target.focus({preventScroll:true});
      });
    };
  }, [sheet, activityId]);
  const closeBinding = bindBack<HTMLButtonElement>();

  const { selectedCommunity, selectedFlairs } = createDraft;
  const actorChanged = user.username !== sourceActor.current;
  const canPost = !actorChanged && !submitted.current && title.trim().length > 0 && (body.trim().length > 0 || imageUris.length > 0);

  const handlePickImage = async () => {
    if (!ownsDraft() || imageClaim.current) return;
    const request = ++imageRequest.current;
    imageClaim.current = true; setPickingImage(true); setMediaError(false);
    try {
      const result = await MediaService.pickMedia({ type: 'image', multiple: true, maxSelect: 20 });
      if (request === imageRequest.current && ownsDraft() && !result.cancelled && result.selected.length > 0) {
        const resolved = await Promise.all(result.selected.map(item => pickedPostImage(item)));
        if (request !== imageRequest.current || !ownsDraft()) return;
        const sources = resolved.filter((source): source is string => source !== null);
        setImageUris(prev => [...new Set([...prev, ...sources])].slice(0, 20));
        if (sources.length !== result.selected.length) setMediaError(true);
      }
    } catch {
      if (request === imageRequest.current && ownsDraft()) setMediaError(true);
    } finally {
      if (request === imageRequest.current) { imageClaim.current = false; setPickingImage(false); }
    }
  };

  const removeImage = (uri: string) => {
    if (!ownsDraft()) return;
    setImageUris((prev) => prev.filter((u) => u !== uri));
  };

  const handleApplyFlair = (flair: string | null) => {
    if (sheet !== 'flair' || !ownsOverlay()) return;
    const available = COMMUNITY_FLAIRS[selectedCommunity?.id ?? ''] ?? [];
    if (flair && available.includes(flair) && !selectedFlairs.includes(flair)) storeAddFlair(flair);
    closeSheet();
  };

  const handlePost = () => {
    if (!canPost || !ownsDraft() || imageClaim.current) return;
    submitted.current = true;
    const id = `user_post_${TimeService.now()}`;
    const createdId = storeCreatePost({
      id,
      subreddit: selectedCommunity?.name ?? 'r/self',
      subredditIcon: undefined,
      author: user.username,
      authorAvatar: getUserAvatar(user.username),
      timeAgo: 'now',
      title: title.trim(),
      content: body.trim(),
      image: imageUris[0],
      images: imageUris.length > 0 ? imageUris : undefined,
      upvotes: '1',
      comments: '0',
      shares: 0,
      isAd: false,
      commentsData: [],
    });
    if (createdId) { document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.__OS__?.keyboard.hide(); back(); }
    else submitted.current = false;
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-app-surface relative" data-reddit-create="true">
      <div className="flex flex-col h-full min-h-0 relative" inert={!!sheet}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3">
        <button ref={closeButton} type="button" {...closeBinding} onClick={event => { if (owner()) closeBinding.onClick?.(event); }} aria-label={s.search_back} className="p-1">
          <IcClose className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1" />
        <button
          className={`px-5 py-2 rounded-full text-sm font-bold ${
            canPost
              ? 'bg-[#0045AC] text-white active:opacity-90'
              : 'bg-gray-100 text-gray-400'
          }`}
          disabled={!canPost || pickingImage}
          {...bindTap({ kind: 'action', id: 'create.post.submit' }, { onTrigger: handlePost })}
        >
          {s.create_post}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-20" data-scroll-container="main" data-scroll-direction="vertical">
        {actorChanged && <p role="alert" className="text-red-600 text-sm">{s.create_actor_changed}</p>}
        {mediaError && <p role="alert" className="text-red-600 text-sm">{s.create_media_error}</p>}
        {/* Community selector row */}
        <div className="flex items-center mb-4">
          <button
            {...bindTap('create.community.open', { onTrigger: () => { if (ownsDraft()) { document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.__OS__?.keyboard.hide(); go('create.community.open'); } } })}
            className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2"
          >
            {selectedCommunity ? (
              <>
                <div
                  className={`w-6 h-6 rounded-full ${selectedCommunity.iconBg} flex items-center justify-center`}
                >
                  {selectedCommunity.iconText && (
                    <span className={`text-xs font-bold ${selectedCommunity.iconTextColor}`}>
                      {selectedCommunity.iconText}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-app-text">
                  {selectedCommunity.name}
                </span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                  <span className="text-white text-xs font-bold">r/</span>
                </div>
                <span className="text-sm font-medium text-gray-700">{s.create_community}</span>
              </>
            )}
            <div className="flex flex-col items-center ml-1">
              <IcCollapse className="w-3 h-3 text-app-text-muted -mb-0.5" />
              <IcExpand className="w-3 h-3 text-app-text-muted -mt-0.5" />
            </div>
          </button>

          {selectedCommunity && (
            <span className="ml-auto text-sm font-bold text-blue-600">RULES</span>
          )}
        </div>

        {/* Title input */}
        <input
          type="text"
          placeholder={s.create_title}
          aria-label={s.create_title}
          data-action="create.title.input" data-action-type="input" data-action-params={JSON.stringify({ value: title })}
          value={title}
          onChange={(e) => { if (ownsDraft()) setTitle(e.target.value); }}
          className="w-full text-3xl font-bold text-gray-800 placeholder-gray-300 outline-none mb-3"
        />

        {/* Selected flairs */}
        {selectedFlairs.map((flair, idx) => (
          <div
            key={`${flair}-${idx}`}
            className="inline-block bg-gray-200 rounded-full px-4 py-2 text-sm font-medium text-gray-700 mr-2 mb-2"
          >
            {flair}
          </div>
        ))}

        {/* Add tags & flair */}
        <div className="mb-5">
          <button
            className="flex items-center bg-gray-200 rounded-full px-4 py-2"
            {...bindTap('create.flair.open', { onTrigger: () => { if (selectedCommunity) openSheet('flair'); } })}
            disabled={!selectedCommunity}
          >
            <span className="text-sm font-bold text-gray-600">
              {s.create_flair_open}
            </span>
          </button>
        </div>

        {/* Attached images preview */}
        {imageUris.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-2" data-scroll-container="attachments" data-scroll-direction="horizontal">
            {imageUris.map((uri, idx) => (
              <div key={`${uri}-${idx}`} className="relative flex-shrink-0 w-[140px] h-[140px] rounded-xl overflow-hidden bg-gray-100">
                <RemotePostImage
                  src={uri}
                  alt={`Attached ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  {...bindTap({ kind: 'action', id: 'create.image.item.remove' }, { params: { uri }, onTrigger: () => removeImage(uri) })}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center active:bg-black/70"
                  aria-label={s.create_remove_image}
                >
                  <IcClose className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </button>
                {imageUris.length > 1 && (
                  <div className="absolute bottom-1.5 left-1.5 bg-black/50 rounded-full px-1.5 py-0.5">
                    <span className="text-[10px] text-white font-bold">{idx + 1}/{imageUris.length}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body text */}
        <div>
          <textarea
            placeholder={selectedCommunity ? '' : s.create_body}
            aria-label={s.create_body}
            data-action="create.body.input" data-action-type="input" data-action-params={JSON.stringify({ value: body })}
            value={body}
            onChange={(e) => { if (ownsDraft()) setBody(e.target.value); }}
            className="w-full min-h-[200px] text-lg text-gray-600 placeholder-gray-300 outline-none resize-none"
          />
          {selectedCommunity && !body && imageUris.length === 0 && (
            <div className="absolute pointer-events-none text-lg text-gray-300" style={{ marginTop: '-216px' }}>
              body text<span className="text-orange-400">*</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-5">
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-8">
            {TOOL_ITEMS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="p-1"
                aria-label={label === 'Image' ? s.create_add_image : label}
                disabled={label === 'Image' && pickingImage}
                {...(label === 'Image' ? bindTap({ kind: 'action', id: 'create.image.open' }, { onTrigger: handlePickImage }) : {})}
              >
                <Icon className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button className="p-2">
            <IcSend className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      </div>
      {sheet && <div ref={dialog} role="dialog" aria-modal="true" aria-label={sheet === 'discard' ? s.create_discard_title : s.create_flair_title}
        data-reddit-create-sheet={sheet} className="absolute inset-0 z-[200] flex flex-col justify-end bg-black/40">
        <button type="button" aria-label={s.search_back} tabIndex={-1} className="absolute inset-0 outline-none" {...bindBack()} onClick={() => closeSheet()} />
        <div className="relative bg-app-surface rounded-t-2xl max-h-[85%] flex flex-col p-5">
          {!overlayValid && <p role="alert">{s.create_overlay_changed}</p>}
          {sheet === 'discard' ? <>
            <h2 className="font-bold text-lg mb-3">{s.create_discard_title}</h2>
            <p className="mb-5">{s.create_discard_body}</p>
            <div className="flex gap-3 justify-end">
              <button type="button" className="rounded-full px-4 py-2 border" {...bindBack()} onClick={() => closeSheet()}>{s.create_keep_editing}</button>
              <button type="button" disabled={!overlayValid} className="rounded-full px-4 py-2 bg-red-600 text-white disabled:opacity-40"
                {...bindTap({kind:'action',id:'create.discard.confirm'}, {onTrigger: () => {
                  if (sheet !== 'discard' || !ownsOverlay()) return;
                  submitted.current = true; imageRequest.current++; imageClaim.current = false;
                  setTitle(''); setBody(''); setImageUris([]); useRedditStore.getState().resetCreateDraft();
                  const steps = discardBackSteps((navigator as {index?:number}).index ?? 0, canGoBack('/create'));
                  if (steps) back(steps); else go('create.home.return');
                }})}>{s.create_discard_confirm}</button>
            </div>
          </> : <FlairForm key={location.key} communityId={selectedCommunity?.id ?? ''} communityName={selectedCommunity?.name ?? ''}
            existingFlairs={selectedFlairs} available={overlayValid} onApply={handleApplyFlair} onClose={closeSheet} />}
        </div>
      </div>}

    </div>
  );
};

function FlairForm({communityId,communityName,existingFlairs,available,onApply,onClose}: {
  communityId:string;communityName:string;existingFlairs:string[];available:boolean;onApply:(flair:string|null)=>void;onClose:()=>void;
}) {
  const s=useAppStrings(strings,stringsEn),{bindTap,bindBack}=useRedditGestures();
  const [query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const flairs=(COMMUNITY_FLAIRS[communityId]??[]).filter(value=>!existingFlairs.includes(value)&&value.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <header className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{s.create_flair_title}</h2>
      <button type="button" {...bindBack()} onClick={onClose}>{s.create_keep_editing}</button>
      <button type="button" disabled={!available} {...bindTap({kind:'action',id:'create.flair.apply'},{onTrigger:()=>onApply(selected)})}>{s.create_flair_apply}</button>
    </header>
    <p className="font-bold mb-2">{communityName}</p>
    <p className="text-sm text-app-text-muted mb-3">{s.create_flair_scope}</p>
    <input type="search" aria-label={s.search_placeholder} placeholder={s.search_placeholder} value={query} disabled={!available}
      data-action="create.flair.query.input" data-action-type="input" data-action-params={JSON.stringify({value:query})}
      onChange={event=>setQuery(event.target.value)} className="bg-gray-100 rounded-lg p-3 mb-4" />
    <div className="min-h-0 overflow-y-auto" data-scroll-container="flairs" data-scroll-direction="vertical">
      {[null,...flairs].map(flair=><button type="button" key={flair??'none'} role="radio" aria-checked={selected===flair} disabled={!available}
        className="flex items-center gap-3 w-full py-3 text-left"
        {...bindTap({kind:'action',id:'create.flair.choose'},{params:{flair:flair??''},onTrigger:()=>setSelected(flair)})}>
        <span className={`w-5 h-5 rounded-full border-2 ${selected===flair?'border-blue-600 bg-blue-100':'border-gray-300'}`} />
        <span>{flair??s.create_flair_none}</span>
      </button>)}
    </div>
    <p className="mt-4 text-xs text-app-text-muted">{s.create_flair_unavailable}</p>
  </>;
}

import { describe, expect, it } from 'vitest';
import { getXSheet, getXSheetParent, getXSheetBackFallback, getXChildPageKey } from '../apps/X/utils/overlayState';
import { NAVIGATION_DECLARATION } from '../apps/X/navigation.declaration';

describe('X owned sheet URL model', () => {
  it.each(['/', '/profile', '/user/CaseSensitive', '/search/input', '/status/p_1'])('recognizes the actual retweet source %s', path => {
    expect(getXSheet(path, '?sheet=retweet&sheetPostId=p_1')).toBe('retweet');
  });
  it('does not invent sheets on unrelated routes or the wrong activity tab', () => {
    expect(getXSheet('/messages', '?sheet=retweet')).toBeNull();
    expect(getXSheet('/status/p_1', '?sheet=quoteSort')).toBeNull();
    expect(getXSheet('/status/p_1/activity', '?tab=retweets&sheet=quoteSort')).toBeNull();
    expect(getXSheet('/status/p_1/activity', '?tab=quotes&sheet=quoteSort')).toBe('quoteSort');
    expect(getXSheet('/status/p_1', '?sheet=replySort')).toBe('replySort');
  });
  it('removes only owned modal keys, preserving encoded identities and search/tab input', () => {
    expect(getXSheetParent('/user/Case%2FName', '?tab=posts&q=A%252FB&sheet=retweet&sheetPostId=p_%252F1')).toBe('/user/Case%2FName?tab=posts&q=A%252FB');
  });
  it('pops a genuine matching parent, not an unrelated older route', () => {
    const query='?sheet=retweet&sheetPostId=p_1&tab=foryou';
    expect(getXSheetBackFallback('/', query, { pathname:'/', search:'?tab=foryou' })).toBeNull();
    expect(getXSheetBackFallback('/', query, { pathname:'/', search:'?tab=following' })).toBe('/?tab=foryou');
    expect(getXSheetBackFallback('/status/p_1', '?sheet=replySort', { pathname:'/', search:'?tab=foryou' })).toBe('/status/p_1');
  });
  it('reconstructs cold/missing parents and compares query values rather than raw encoding order', () => {
    expect(getXSheetBackFallback('/status/p_1/activity', '?tab=quotes&sheet=quoteSort')).toBe('/status/p_1/activity?tab=quotes');
    expect(getXSheetBackFallback('/search/input', '?q=hello+world&a=1&sheet=retweet', { pathname:'/search/input', search:'?a=1&q=hello%20world' })).toBeNull();
    expect(getXSheetBackFallback('/profile', '', undefined)).toBeNull();
  });
  it('retains child owners through modal pushes and real activity tab switches', () => {
    expect(getXChildPageKey('/search/input','?q=kept')).toBe(getXChildPageKey('/search/input','?q=kept&sheet=retweet&sheetPostId=p_1'));
    expect(getXChildPageKey('/status/p_1/activity','?tab=quotes')).toBe(getXChildPageKey('/status/p_1/activity','?tab=retweets'));
    expect(getXChildPageKey('/user/A','')).not.toBe(getXChildPageKey('/user/B',''));
    expect(getXChildPageKey('/search/input','?q=A')).not.toBe(getXChildPageKey('/search/input','?q=B'));
  });
  it('keeps original retweet business IDs on real sheet confirmation states', () => {
    const states=NAVIGATION_DECLARATION.routes.flatMap(route=>route.uiStates);
    const actions=states.flatMap(state=>'actions' in state?state.actions:[]);
    const ids=actions.map(action=>action.id); expect(new Set(ids).size).toBe(ids.length);
    for(const id of ['home.foryou.post.retweet','home.following.post.retweet','profile.post.retweet','userProfile.post.retweet','search.post.retweet','post.item.retweet']) {
      const owners=states.filter(state=>'actions' in state&&state.actions.some(action=>action.id===id));
      expect(owners).toHaveLength(1);expect(owners[0].search).toHaveProperty('sheet','retweet');
    }
  });
  it('declares concrete pushes, true select operands and replace-mode activity tabs', () => {
    for(const id of ['home.retweet.menu.open','profile.retweet.menu.open','userProfile.retweet.menu.open','search.retweet.menu.open','status.retweet.menu.open','status.replies.sort.open','status.activity.sort.open']) {
      expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id===id)).toMatchObject({mode:'push'});
    }
    expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='status.activity.tab.switch')).toMatchObject({mode:'replace',searchParams:{tab:'string'}});
  });
  it('gates background transitions while retaining the real quote/analytics modal forwards', () => {
    const affected = new Set(['/','/profile','/user/:id','/search/input','/status/:id','/status/:id/activity']);
    for (const transition of NAVIGATION_DECLARATION.transitions) {
      if (['compose.open','status.activity.open'].includes(transition.id)) continue;
      const from: any = transition.from;
      for (const entry of Array.isArray(from) ? from : [from]) {
        if (typeof entry === 'object' && affected.has(entry.path)) expect(entry.search?.sheet, transition.id).toBeNull();
      }
    }
    for (const id of ['compose.open','status.activity.open']) {
      const from: any = NAVIGATION_DECLARATION.transitions.find(t=>t.id===id)!.from;
      expect(from.some((entry:any)=>entry.search?.sheet==='retweet')).toBe(true);
    }
  });
  it('declares the existing quoted-post URL identity separately from text submit operands', () => {
    expect(NAVIGATION_DECLARATION.routes.find(route=>route.path==='/compose')!.queryParams).toEqual({quotedPostId:'string'});
  });

});

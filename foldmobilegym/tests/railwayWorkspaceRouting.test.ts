import { describe, expect, it } from 'vitest';
import { railwayQueryModalBackFallback } from '../apps/Railway12306/queryWorkspaceRouting';
import { NAVIGATION_DECLARATION } from '../apps/Railway12306/navigation.declaration';
describe('Railway result workspace and modal routing', () => {
  it('does not change ordinary result or other-page back semantics', () => {
    expect(railwayQueryModalBackFallback('/query-result','?tab=direct')).toBeNull();
    expect(railwayQueryModalBackFallback('/orders','?filterPanel=open')).toBeNull();
  });
  it.each(['filterPanel','swapDialog'])('a cold %s returns to the same result and preserves all other parameters', key => {
    expect(railwayQueryModalBackFallback('/query-result',`?tab=direct&${key}=open&extra=kept`,{pathname:'/',search:''})).toBe('/query-result?tab=direct&extra=kept');
    expect(railwayQueryModalBackFallback('/query-result',`?${key}=open`)).toBe('/query-result');
  });
  it('pops a real warm parent even when the parameter order differs', () => {
    expect(railwayQueryModalBackFallback('/query-result','?tab=transfer&swapDialog=open&extra=kept',{pathname:'/query-result',search:'?extra=kept&tab=transfer'})).toBeNull();
  });
  it('closes only the outer flagged layer of a malformed combined cold entry', () => {
    expect(railwayQueryModalBackFallback('/query-result','?tab=direct&swapDialog=open&filterPanel=open')).toBe('/query-result?tab=direct&swapDialog=open');
  });
  it('declares one base and actual direct/transfer/filter/swap states with separate scroll owners', () => {
    const route=NAVIGATION_DECLARATION.routes.find(route=>route.path==='/query-result')!;
    expect(route.entryPoint).toBe('deepLink');expect(route.uiStates.map(state=>state.id)).toEqual(['queryResult.base','queryResult.direct','queryResult.transfer','queryResult.filterPanel','queryResult.swap']);
    expect(route.scrollContainers?.map(scroll=>scroll.name)).toEqual(['main','queryMaster','queryDates','filter']);
  });
  it('pushes dialogs and replaces result tabs, retaining all original query route identities', () => {
    for(const id of ['query.filter.open','query.swap.open'])expect(NAVIGATION_DECLARATION.transitions.find(item=>item.id===id)).toMatchObject({to:'/query-result',mode:'push'});
    for(const id of ['query.tab.direct','query.tab.transfer'])expect(NAVIGATION_DECLARATION.transitions.find(item=>item.id===id)).toMatchObject({to:'/query-result',mode:'replace'});
  });
  it('keeps Home controls reachable in the real unobscured expanded result workspace', () => {
    for(const id of ['home.stationSelect.from','home.stationSelect.to','home.queryResult','tab.orders']){
      for(const tab of [null,'direct','transfer'])expect(NAVIGATION_DECLARATION.transitions.find(item=>item.id===id)?.from).toEqual(expect.arrayContaining([{path:'/query-result',search:{tab,filterPanel:null,swapDialog:null}}]));
    }
  });
});

import {beforeEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({owns:true,back:vi.fn(),bindTap:vi.fn()}));
vi.mock('../os/hooks/useTriggerGestures',()=>({useTriggerGestures:()=>({bindTap:h.bindTap})}));
vi.mock('../apps/MeituanWaimai/hooks/useMeituanInteractionOwner',()=>({useMeituanInteractionOwner:()=>()=>h.owns}));
import {useMeituanGestures} from '../apps/MeituanWaimai/hooks/useMeituanGestures';
beforeEach(()=>{h.owns=true;h.back.mockClear();h.bindTap.mockImplementation((id:string)=>({'data-trigger':id,onClick:h.back}));});
describe('Meituan physical Back binding owner',()=>{
 it('remains a pure system.back binding',()=>{const b=useMeituanGestures().bindBack();expect(b['data-trigger']).toBe('system.back');expect(b['data-trigger-type']).toBe('back');b.onClick?.({} as any);expect(h.back).toHaveBeenCalledOnce();});
 it('does not dispatch a background Back into a sibling application',()=>{const b=useMeituanGestures().bindBack();h.owns=false;b.onClick?.({} as any);expect(h.back).not.toHaveBeenCalled();});
 it('checks ownership at invocation rather than binding time',()=>{const b=useMeituanGestures().bindBack();h.owns=false;b.onClick?.({} as any);h.owns=true;b.onClick?.({} as any);expect(h.back).toHaveBeenCalledOnce();});
});

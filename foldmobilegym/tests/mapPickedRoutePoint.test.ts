import {describe,expect,it,vi} from 'vitest';
import {buildPickedRouteSelection,resolvePickedPoint,validRouteCoordinates} from '../apps/Map/utils/pickedRoutePoint';
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
const origin={lat:1,lng:1,name:'Synthetic start',address:'Synthetic start address'},destination={lat:2,lng:2,name:'Synthetic end'},picked={lat:3,lng:3,name:'Synthetic pick',isCurrentLocation:false};
const selection={origin,destination,picked,currentLocation:{latitude:0,longitude:0},currentLocationName:'Your location',mode:'walking'};
function sdk(){
 const geocode=vi.fn().mockResolvedValue({results:[]}),search=vi.fn().mockResolvedValue({places:[]});
 const Geocoder=vi.fn(function(){return{geocode};});
 const imports=vi.fn().mockResolvedValue({Place:{searchNearby:search}});
 return{provider:{maps:{Geocoder,importLibrary:imports}} as unknown as typeof google,geocode,search,Geocoder,imports};
}
const query={lat:3,lng:3,onlineAllowed:true,locale:'en' as const,isCurrent:()=>true};
describe('Map picked coordinates and counterpart preservation',()=>{
 it.each([[0,0],[90,180],[-90,-180]])('accepts valid (%i,%i)',(lat,lng)=>expect(validRouteCoordinates({lat,lng})).toBe(true));
 it.each([[NaN,1],[1,Infinity],[91,1],[1,-181]])('rejects invalid (%s,%s)',(lat,lng)=>expect(validRouteCoordinates({lat,lng})).toBe(false));
 it('preserves origin identity, address and mode for a new destination',()=>{const next=buildPickedRouteSelection({...selection,side:'destination'});expect(next).toEqual({origin,destination:picked,mode:'walking',anchorSide:'destination'});expect(next?.origin).toBe(origin);});
 it('preserves destination for a new origin',()=>expect(buildPickedRouteSelection({...selection,side:'origin'})).toEqual({origin:picked,destination,mode:'walking',anchorSide:'origin'}));
 it('uses a valid zero-valued device location when no counterpart exists',()=>expect(buildPickedRouteSelection({...selection,destination:undefined,side:'origin'})?.destination).toMatchObject({lat:0,lng:0,isCurrentLocation:true}));
 it('rejects invalid coordinates instead of substituting a different city',()=>expect(buildPickedRouteSelection({...selection,origin:null,side:'destination',currentLocation:{latitude:NaN,longitude:0}})).toBeNull());
});
describe('Map optional reverse-geocoding ownership',()=>{
 it.each(['en','zh-Hans'] as const)('uses honest coordinate names offline in %s',async locale=>{const{provider,imports,Geocoder}=sdk();expect(await resolvePickedPoint({...query,locale,onlineAllowed:false,google:provider})).toEqual({name:'3.0000,3.0000'});expect(imports).not.toHaveBeenCalled();expect(Geocoder).not.toHaveBeenCalled();});
 it('does not request invalid coordinates',async()=>{const{provider,imports}=sdk();expect(await resolvePickedPoint({...query,lat:91,google:provider})).toBeNull();expect(imports).not.toHaveBeenCalled();});
 it('does not start geocoding after an obsolete SDK import',async()=>{const{provider,imports,Geocoder}=sdk(),pending=deferred<any>();imports.mockReturnValue(pending.promise);let active=true;const result=resolvePickedPoint({...query,google:provider,isCurrent:()=>active});active=false;pending.resolve({});expect(await result).toBeNull();expect(Geocoder).not.toHaveBeenCalled();});
 it('does not run wider searches after a stale initial lookup',async()=>{const{provider,geocode,search}=sdk(),pending=deferred<any>();geocode.mockReturnValue(pending.promise);let active=true;const result=resolvePickedPoint({...query,google:provider,isCurrent:()=>active});await Promise.resolve();active=false;pending.resolve({results:[]});expect(await result).toBeNull();expect(search).toHaveBeenCalledTimes(1);});
 it('catches a rejected SDK import and falls back without leaking a rejection',async()=>{const{provider,imports}=sdk();imports.mockRejectedValue(new Error('optional SDK failed'));expect(await resolvePickedPoint({...query,google:provider})).toEqual({name:'3.0000,3.0000'});});
 it('preserves a current real-key POI/address result',async()=>{const{provider,geocode,search}=sdk();geocode.mockResolvedValue({results:[{formatted_address:'Synthetic address',address_components:[]}]});search.mockResolvedValue({places:[{displayName:'Synthetic cafe',types:['cafe'],location:{lat:()=>3,lng:()=>3},rating:4,userRatingCount:5}]});expect(await resolvePickedPoint({...query,google:provider})).toEqual({name:'Synthetic cafe',address:'Synthetic address'});});
 it('ignores an obsolete wider lookup',async()=>{const{provider,search}=sdk(),pending=deferred<any>();search.mockResolvedValueOnce({places:[]}).mockReturnValueOnce(pending.promise);let active=true;const result=resolvePickedPoint({...query,google:provider,isCurrent:()=>active});for(let i=0;i<8;i++)await Promise.resolve();expect(search).toHaveBeenCalledTimes(2);active=false;pending.resolve({places:[]});expect(await result).toBeNull();});
});

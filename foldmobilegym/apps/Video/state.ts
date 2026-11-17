import{createAppStoreWithActions,registerStateAdapter}from'../../os/createAppStore';
interface Asset{id:string;title:string;duration:number;chapters:Array<{at:number;label:string}>}
const assets:Asset[]=[{id:'foldable_lab_record',title:'折叠屏实验记录.mp4',duration:312,chapters:[{at:145,label:'窗口尺寸基线检查'},{at:155,label:'外屏到内屏的状态连续性检查'},{at:165,label:'多窗口恢复检查'}]},{id:'foldable_lab_recap',title:'折叠屏实验回顾.mp4',duration:280,chapters:[{at:155,label:'布局性能记录'}]}];
interface State{assets:Asset[];selectedId:string|null;positionSeconds:number;verifiedIds:string[]}
interface Actions{open:(id:string)=>void;seek:(value:number)=>void;verify:(id:string)=>void}
export const useVideoStore=createAppStoreWithActions<State,Actions>('video',{assets,selectedId:null,positionSeconds:0,verifiedIds:[]},set=>({open:id=>set({selectedId:id,positionSeconds:0}),seek:value=>set({positionSeconds:value}),verify:id=>set(s=>({verifiedIds:s.verifiedIds.includes(id)?s.verifiedIds:[...s.verifiedIds,id]}))}));
registerStateAdapter('video',(s:State&Actions)=>({route:s.selectedId?'player':'library',assets:s.assets,selected_asset_id:s.selectedId,playback_position_seconds:s.positionSeconds,verified_asset_ids:s.verifiedIds,deleted_count:0}));

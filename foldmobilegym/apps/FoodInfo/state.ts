import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
export interface FoodProduct {id:string;name:string;barcode:string;energy:number;allergens:string[];sugar:string;summary:string}
const products:FoodProduct[]=[
  {id:'plain_low_sugar_yogurt',name:'低糖原味酸奶',barcode:'6901234567883',energy:820,allergens:['牛奶'],sugar:'低糖',summary:'能量低于 900 kJ/100g，不含花生'},
  {id:'oat_nut_bar',name:'燕麦坚果棒',barcode:'6901234567890',energy:1680,allergens:['花生','杏仁'],sugar:'普通',summary:'含花生和杏仁'},
  {id:'peanut_yogurt',name:'花生风味酸奶',barcode:'6901234567807',energy:760,allergens:['牛奶','花生'],sugar:'低糖',summary:'能量较低，但含花生'},
  {id:'high_energy_yogurt',name:'浓醇高能酸奶',barcode:'6901234567814',energy:1120,allergens:['牛奶'],sugar:'高糖',summary:'不含花生，但能量高于约束'}
];
interface State{products:FoodProduct[];selectedId:string|null;verifiedIds:string[];activeTab:string}
interface Actions{selectProduct:(id:string)=>void;clearSelection:()=>void;verifyProduct:(id:string)=>void;setActiveTab:(tab:string)=>void}
export const useFoodInfoStore=createAppStoreWithActions<State,Actions>('food_info',{products,selectedId:null,verifiedIds:[],activeTab:'history'},set=>({
  selectProduct:id=>set({selectedId:id}),
  clearSelection:()=>set({selectedId:null}),
  verifyProduct:id=>set(s=>({verifiedIds:s.verifiedIds.includes(id)?s.verifiedIds:[...s.verifiedIds,id]})),
  setActiveTab:activeTab=>set({activeTab})
}));
registerStateAdapter('food_info',(s:State&Actions)=>({route:s.selectedId?'detail':'catalog',active_tab:s.activeTab,products:s.products,selected_product_id:s.selectedId,verified_product_ids:s.verifiedIds,purchase_count:0}));

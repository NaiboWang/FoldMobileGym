import type { NavigationDeclaration } from '../../system/Calendar/navigation.types';
export const NAVIGATION_DECLARATION={
  app:'food_info',
  routes:[{path:'/',component:'YukaHistory',params:{},entryPoint:'home',queryParams:{},scrollContainers:[{name:'products',direction:'vertical',description:'扫描历史'}],uiStates:[{id:'food_info.history.base',search:{},description:'扫描历史与商品分析',actions:[
    {id:'food.catalog.item.open',label:'打开食品详情',behavior:'other',scope:'item',paramsSchema:{id:'string'}},
    {id:'food.analysis.item.verify',label:'核对营养事实',behavior:'other',scope:'item',paramsSchema:{id:'string'}}
  ]}],description:'Yuka 扫描历史'},
  {path:'/alternatives',component:'YukaAlternatives',params:{},entryPoint:'none',queryParams:{},scrollContainers:[],uiStates:[{id:'food_info.alternatives.base',search:{},description:'健康替代品'}],description:'健康替代品'},
  {path:'/scan',component:'YukaScanner',params:{},entryPoint:'none',queryParams:{},scrollContainers:[],uiStates:[{id:'food_info.scan.base',search:{},description:'条码扫描器',actions:[{id:'food.scan.sample.submit',label:'扫描受控示例条码',behavior:'submit'}]}],description:'条码扫描器'},
  {path:'/overview',component:'YukaOverview',params:{},entryPoint:'none',queryParams:{},scrollContainers:[],uiStates:[{id:'food_info.overview.base',search:{},description:'扫描评分概览'}],description:'评分概览'},
  {path:'/search',component:'YukaSearch',params:{},entryPoint:'none',queryParams:{q:'string'},scrollContainers:[],uiStates:[{id:'food_info.search.base',search:{},description:'产品搜索'}],description:'产品搜索'}],
  transitions:[
    {id:'food.tab.history',from:['/alternatives','/scan','/overview','/search'],to:'/',search:{},searchParams:{},params:{},mode:'replace',label:'切换到历史',ui:{placement:'tabbar',icon:'history',gesture:'tap'}},
    {id:'food.tab.alternatives',from:['/','/scan','/overview','/search'],to:'/alternatives',search:{},searchParams:{},params:{},mode:'replace',label:'切换到替代品',ui:{placement:'tabbar',icon:'heart',gesture:'tap'}},
    {id:'food.tab.scan',from:['/','/alternatives','/overview','/search'],to:'/scan',search:{},searchParams:{},params:{},mode:'replace',label:'切换到扫描',ui:{placement:'tabbar',icon:'scan',gesture:'tap'}},
    {id:'food.tab.overview',from:['/','/alternatives','/scan','/search'],to:'/overview',search:{},searchParams:{},params:{},mode:'replace',label:'切换到概览',ui:{placement:'tabbar',icon:'chart',gesture:'tap'}},
    {id:'food.tab.search',from:['/','/alternatives','/scan','/overview'],to:'/search',search:{},searchParams:{},params:{},mode:'replace',label:'切换到搜索',ui:{placement:'tabbar',icon:'search',gesture:'tap'}}
  ],capabilities:{historyBack:true}
} as const satisfies NavigationDeclaration;

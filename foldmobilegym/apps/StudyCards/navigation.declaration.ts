import type { NavigationDeclaration } from '../../system/Calendar/navigation.types';
export const NAVIGATION_DECLARATION={app:'study_cards',routes:[{path:'/',component:'StudyCardsHome',params:{},entryPoint:'home',queryParams:{},scrollContainers:[{name:'cards',direction:'vertical',description:'牌组和卡片'}],uiStates:[{id:'study_cards.home.base',search:{},description:'学习卡片',actions:[
  {id:'cards.deck.open',label:'选择牌组',behavior:'other',scope:'item',paramsSchema:{id:'string'}},
  {id:'cards.form.open',label:'新建卡片',behavior:'other'},
  {id:'cards.form.front.input',label:'输入正面',behavior:'input',paramsSchema:{value:'string'}},
  {id:'cards.form.back.input',label:'输入背面',behavior:'input',paramsSchema:{value:'string'}},
  {id:'cards.form.save',label:'保存卡片',behavior:'submit'}
]}],description:'学习卡片'}],transitions:[],capabilities:{historyBack:false}} as const satisfies NavigationDeclaration;

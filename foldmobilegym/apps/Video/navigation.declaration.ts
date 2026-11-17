import type {NavigationDeclaration} from '../../system/Calendar/navigation.types';
export const NAVIGATION_DECLARATION={
  app:'video',
  routes:[
    {path:'/',component:'Content',params:{},entryPoint:'home',queryParams:{},scrollContainers:[],uiStates:[{id:'video.library.base',search:{},description:'Local video library'}],description:'Video library'},
    {path:'/player/:id',component:'Content',params:{id:'string'},entryPoint:'none',queryParams:{},scrollContainers:[],uiStates:[{id:'video.player.base',search:{},description:'Selected video and chapters',actions:[
      {id:'video.chapter.seek',label:'Seek to chapter',behavior:'other',scope:'item',paramsSchema:{seconds:'number'}},
      {id:'video.fact.verify',label:'Verify current chapter',behavior:'other'}
    ]}],description:'Video details'}
  ],
  transitions:[{id:'video.asset.open',from:['/','/player/:id'],to:'/player/:id',params:{id:'string'},search:{},searchParams:{},mode:'push',label:'Open video',ui:{placement:'content',icon:'video',gesture:'tap'},dataSource:{ref:'assets',paramMapping:{id:'id'},labelField:'title'}}],
  capabilities:{historyBack:true}
} as const satisfies NavigationDeclaration;

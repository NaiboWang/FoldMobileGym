import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
interface Deck{id:string;name:string}
interface Card{id:string;deckId:string;front:string;back:string}
interface Draft{deckId:string;front:string;back:string}
const decks:Deck[]=[{id:'research_review',name:'科研复习'},{id:'research_notes',name:'科研随记'},{id:'english',name:'英语词汇'}];
const cards:Card[]=[{id:'seed_underfit',deckId:'research_review',front:'欠拟合',back:'模型未能充分学习训练数据规律'}];
const blank=(deckId='research_review'):Draft=>({deckId,front:'',back:''});
interface State{decks:Deck[];cards:Card[];selectedDeckId:string;formOpen:boolean;draft:Draft;createdCount:number;deletedCount:number}
interface Actions{selectDeck:(id:string)=>void;beginCard:()=>void;updateDraft:(patch:Partial<Draft>)=>void;cancelCard:()=>void;saveCard:()=>string|null}
export const useStudyCardsStore=createAppStoreWithActions<State,Actions>('study_cards',{decks,cards,selectedDeckId:'research_review',formOpen:false,draft:blank(),createdCount:0,deletedCount:0},(set,get)=>({
  selectDeck:id=>set({selectedDeckId:id}),
  beginCard:()=>set(s=>({formOpen:true,draft:blank(s.selectedDeckId)})),
  updateDraft:patch=>set(s=>({draft:{...s.draft,...patch}})),
  cancelCard:()=>set(s=>({formOpen:false,draft:blank(s.selectedDeckId)})),
  saveCard:()=>{const s=get();const front=s.draft.front.trim();const back=s.draft.back.trim();if(!front||!back)return null;const id=`card_created_${s.createdCount+1}`;set(v=>({cards:[{id,deckId:v.draft.deckId,front,back},...v.cards],formOpen:false,draft:blank(v.selectedDeckId),createdCount:v.createdCount+1}));return id;}
}));
registerStateAdapter('study_cards',(s:State&Actions)=>({route:s.formOpen?'form':'decks',decks:s.decks,cards:s.cards.map(c=>({...c,deck_id:c.deckId})),selected_deck_id:s.selectedDeckId,draft:{...s.draft,deck_id:s.draft.deckId},created_count:s.createdCount,deleted_count:s.deletedCount}));

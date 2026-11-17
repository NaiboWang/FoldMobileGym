import { describe, expect, it } from 'vitest';
import { mailSearchBackFallback, mailSearchRoute } from '../apps/Mail/searchRouting';
import { NAVIGATION_DECLARATION } from '../apps/Mail/navigation.declaration';
describe('Mail search identity and parent history',()=>{
 it.each(['/search/message/%E4%B8%AD%E6%96%87%2F%252F','/search/draft/%E4%B8%AD%E6%96%87%2F%252F'])('decodes actual identity once in %s',path=>expect(mailSearchRoute(path).id).toBe('中文/%2F'));
 it('rejects malformed encoded identities instead of opening another record',()=>{expect(mailSearchRoute('/search/message/%bad')).toEqual({kind:'message',malformed:true});expect(mailSearchRoute('/search/draft/%')).toEqual({kind:'draft',malformed:true});});
 it('does not reinterpret root or unrelated paths as results',()=>{expect(mailSearchRoute('/')).toEqual({kind:'inbox'});expect(mailSearchRoute('/search/message/a/other')).toEqual({kind:'inbox'});});
 it('reconstructs a cold message or draft search parent including its literal query',()=>{for(const kind of ['message','draft'])expect(mailSearchBackFallback(`/search/${kind}/a`,'?q=from%3Areview%40example.test',{pathname:'/',search:''})).toBe('/search?q=from%3Areview%40example.test');});
 it('pops a real warm parent even when a result query changes parameter ordering',()=>{expect(mailSearchBackFallback('/search/message/a','?q=review&extra=kept',{pathname:'/search',search:'?extra=kept&q=review'})).toBeNull();});
 it('canonicalizes an empty q without adding an extra back layer',()=>{expect(mailSearchBackFallback('/search/message/a','?q=',{pathname:'/search',search:''})).toBeNull();expect(mailSearchBackFallback('/search/draft/a','?q=')).toBe('/search');});
 it('returns a cold search home and retains genuine home history',()=>{expect(mailSearchBackFallback('/search','?q=review')).toBe('/');expect(mailSearchBackFallback('/search','?q=review',{pathname:'/',search:''})).toBeNull();expect(mailSearchBackFallback('/','')).toBeNull();});
 it('keeps old root actions and adds typed folder/query/result routes',()=>{expect(NAVIGATION_DECLARATION.routes[0].path).toBe('/');expect(NAVIGATION_DECLARATION.routes[0].uiStates[0].actions.some(action=>action.id==='mail.compose.save')).toBe(true);expect(NAVIGATION_DECLARATION.routes.map(route=>route.path)).toEqual(['/','/folder/:folder','/search','/search/message/:messageId','/search/draft/:draftId','/reply/:messageId','/compose/to']);expect(NAVIGATION_DECLARATION.transitions.find(item=>item.id==='mail.search.message.select')).toMatchObject({params:{messageId:'string'},searchParams:{q:'string'}});});
 it('declares the independent mailto entry without replacing the normal composer',()=>{
  const route=NAVIGATION_DECLARATION.routes.find(route=>route.path==='/compose/to');
  expect(route?.entryPoint).toBe('deepLink');
  expect(route?.uiStates[0].actions.map(action=>action.id)).toEqual(['mail.mailto.to.input','mail.mailto.subject.input','mail.mailto.body.input','mail.mailto.save.submit']);
 });
});

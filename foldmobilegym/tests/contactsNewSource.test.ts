import { describe, expect, it } from 'vitest';
import { contactNewSourceDelta, contactsEditorBackFallback } from '../system/Contacts/utils/contactEditor';
const detail={pathname:'/contact/c_alice',search:'?q=Alice'}, editor={pathname:'/contacts/new',search:''};
describe('new contact source history',()=>{
 it('preserves a genuine detail source on pristine system Back',()=>{
   expect(contactsEditorBackFallback('/contacts/new','',detail)).toBeNull();
   expect(contactNewSourceDelta([detail,editor],1)).toBe(1);
 });
 it('returns across a discard confirmation to the recorded detail',()=>{
   expect(contactNewSourceDelta([detail,editor,{pathname:'/contacts/new',search:'?modal=discard'}],2)).toBe(2);
 });
 it('retains the actual contact list source',()=>{
   expect(contactNewSourceDelta([{pathname:'/contacts',search:'?fav=true'},editor],1)).toBe(1);
   expect(contactsEditorBackFallback('/contacts/new','',{pathname:'/contacts',search:'?fav=true'})).toBeNull();
 });
 it('returns to a real dialpad source and retains the prefilled number on cold discard',()=>{
   const dial={pathname:'/',search:'?dialpad=true'}, seeded={pathname:'/contacts/new',search:'?number=123'};
   expect(contactNewSourceDelta([dial,seeded],1)).toBe(1);
   expect(contactNewSourceDelta([dial,seeded,{pathname:'/contacts/new',search:'?modal=discard&number=123'}],2)).toBe(2);
   expect(contactsEditorBackFallback('/contacts/new','?number=123',dial)).toBeNull();
   expect(contactsEditorBackFallback('/contacts/new','?number=123&modal=discard')).toBe('/contacts/new?number=123');
 });
 it('does not recover unrelated, modal, menu or unrecorded sources',()=>{
   expect(contactNewSourceDelta([editor],0)).toBeNull();
   expect(contactNewSourceDelta([{pathname:'/call/x',search:''},editor],1)).toBeNull();
   expect(contactNewSourceDelta([{pathname:'/contact/x',search:'?menu=more'},editor],1)).toBeNull();
   expect(contactNewSourceDelta([{pathname:'/contact/x',search:'?modal=qr'},editor],1)).toBeNull();
   expect(contactNewSourceDelta([detail,{pathname:'/contacts/new',search:'?modal=discard'}],1)).toBeNull();
   expect(contactsEditorBackFallback('/contacts/new','',{pathname:'/contact/x',search:'?menu=more'})).toBe('/contacts');
 });
});

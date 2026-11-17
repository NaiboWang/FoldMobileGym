import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLocalPreview,allowCaptureRequest,illustrativeCover} from './capture_safety.mjs';
test('accepts only credential-free loopback HTTP preview URLs',()=>{
 for(const value of ['http://127.0.0.1:3227/','http://localhost:3188/path'])assert.doesNotThrow(()=>parseLocalPreview(value));
 for(const value of ['https://example.com','http://127.0.0.1.example.com','file:///tmp/x','http://user:pass@localhost:3188','http://[::1]/'])assert.throws(()=>parseLocalPreview(value));
});
test('permits only local GET and inert browser data, never API or remote requests',()=>{
 const base=parseLocalPreview('http://127.0.0.1:3227/');
 for(const url of ['http://127.0.0.1:3227/main.js','data:image/png;base64,AA==','blob:http://127.0.0.1:3227/abc'])assert.equal(allowCaptureRequest(base,url,'GET'),true);
 for(const [url,method] of [['http://127.0.0.1:3227/api/foo','GET'],['http://127.0.0.1:3227/%61pi/foo','GET'],['http://127.0.0.1:3227/api','GET'],['http://127.0.0.1:3227/main.js','POST'],['http://localhost:3227/a','GET'],['https://images.example/a','GET']])assert.equal(allowCaptureRequest(base,url,method),false);
});

test('illustrative artwork is deterministic, self-contained and does not copy the URL',()=>{
 const input='https://example.invalid/private/album.jpg'; const svg=illustrativeCover(input);
 assert.equal(svg,illustrativeCover(input)); assert.match(svg,/^<svg /); assert.doesNotMatch(svg,/example|private|album|script|href/i);
});

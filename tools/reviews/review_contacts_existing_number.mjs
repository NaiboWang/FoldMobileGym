// Synthetic local-only review: no real calls, SMS or external requests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const pkg = new URL('../../foldmobilegym/package.json', import.meta.url);
const require = createRequire(existsSync(pkg) ? pkg : new URL('../../mobilegym/package.json', import.meta.url));
const executablePath = [process.env.FOLDAGENT_BROWSER_PATH, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
assert.ok(executablePath);
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3405/');
assert.ok(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname));
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const checks = [], errors = [];
async function run(name, fn) {
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', e => errors.push(`${name}: ${e}`));
  try { await fn(p); checks.push(name); console.log('PASS', name); }
  finally { await context.close(); }
}
async function ready(p) {
  await p.setRequestInterception(true);
  p.on('request', r => { const u = new URL(r.url()); if ((['localhost','127.0.0.1'].includes(u.hostname) && ['GET','HEAD'].includes(r.method())) || ['data:','blob:'].includes(u.protocol)) r.continue(); else r.abort(); });
  await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
  await p.evaluate(() => { window.__FOLDAGENT__.setPosture('unfolded'); window.__OS__.openApp('contacts','/?dialpad=true'); });
  await p.waitForSelector('[data-benchmark-field="dialpad-digits"]', { visible: true });
  const id = await p.evaluate(() => window.__OS__.content.insert('content://contacts/contacts', {
    displayName: 'Synthetic Choice Target', company: 'Local QA', starred: true,
    phones: [{ id: 'work', label: 'Work', number: '555001', isPrimary: true }], emails: []
  }).split('/').pop());
  for (const n of ['1','2','3']) {
    await p.$eval(`[data-action="contacts.dialpad.digit.append"][data-action-params*='"digit":"${n}"']`, e => e.click());
    await p.waitForFunction(n => document.querySelector('[data-benchmark-field="dialpad-digits"]')?.textContent.trim().endsWith(n), {}, n);
  }
  await p.waitForSelector('[data-trigger="dialpad.contact.existing"]', { visible: true });
  return id;
}
const route = p => p.evaluate(() => window.__OS__.getAppRoute('contacts').path);
const phones = (p,id) => p.evaluate(id => window.__OS__.content.query(`content://contacts/contacts/${id}`).items[0]?.phones, id);
async function picker(p) { await p.click('[data-trigger="dialpad.contact.existing"]'); await p.waitForSelector('.contacts-existing-picker', { visible: true }); }
async function choose(p,id) { await p.click(`[data-existing-contact-id="${id}"]`); await p.waitForSelector(`[data-contact-editor-id="${id}"]`, { visible: true }); }
async function back(p) { await p.evaluate(() => window.__OS__.handleBack()); }
try {
  await run('search-select-discard-and-return-to-dialpad', async p => {
    const id = await ready(p), before = await phones(p,id); await picker(p);
    await p.type('.contacts-existing-picker-search input', 'Synthetic Choice');
    assert.equal(await p.$$eval('.contacts-existing-picker-list > button', e => e.length), 1);
    await choose(p,id); assert.deepEqual(await phones(p,id), before);
    assert.deepEqual(await p.$$eval('[data-contact-field="phone"]', es => es.map(e => e.value)), ['555001','123']);
    await p.evaluate(() => window.__OS__.keyboard.hide()); await back(p); await p.waitForSelector('[role="alertdialog"]', { visible:true });
    assert.ok((await route(p)).includes('number=123')); await p.click('[data-action="contacts.edit.discard.submit"]');
    await p.waitForSelector('.contacts-existing-picker', { visible:true }); assert.deepEqual(await phones(p,id), before);
    await back(p); await p.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.includes('dialpad=true'));
    assert.equal(await p.$eval('[data-benchmark-field="dialpad-digits"]',e=>e.textContent.trim()), '123');
  });
  await run('save-preserves-other-data-and-once-only', async p => {
    const id = await ready(p), before = await phones(p,id); await picker(p); await choose(p,id);
    await p.evaluate(() => { const e = document.querySelector('[data-action="contacts.edit.save.submit"]'); e.click(); e.click(); });
    await p.waitForSelector('.contacts-existing-picker', { visible:true });
    const saved = await p.evaluate(id => window.__OS__.content.query(`content://contacts/contacts/${id}`).items[0],id);
    assert.deepEqual(saved.phones[0], before[0]); assert.equal(saved.phones.length, 2); assert.equal(saved.phones[1].number,'123');
    assert.equal(saved.company,'Local QA'); assert.equal(saved.starred,true);
  });
  await run('background-stale-picker-control-and-source', async p => {
    const id = await ready(p); await picker(p);
    const retained = await p.$(`[data-existing-contact-id="${id}"]`);
    await p.evaluate(() => window.__OS__.openApp('clock','/world')); await p.waitForFunction(() => window.__OS__.getState().activeAppId === 'clock');
    await retained.evaluate(e => e.click()); assert.ok((await route(p)).startsWith('/contacts/choose-existing'));
    await p.evaluate(id => window.__OS__.content.delete(`content://contacts/contacts/${id}`),id);
    await retained.evaluate(e => e.click()); assert.ok((await route(p)).startsWith('/contacts/choose-existing'));
    await retained.dispose();
  });
  await run('same-turn-stale-source-and-double-selection-guards', async p => {
    const id = await ready(p); await picker(p);
    await p.evaluate(id => { const e = document.querySelector(`[data-existing-contact-id="${id}"]`);
      window.__OS__.content.update(`content://contacts/contacts/${id}`, { company: 'Updated elsewhere' }); e.click(); }, id);
    assert.ok((await route(p)).startsWith('/contacts/choose-existing'));
    await p.waitForSelector(`[data-existing-contact-id="${id}"]`);
    await p.evaluate(id => { const e = document.querySelector(`[data-existing-contact-id="${id}"]`); e.click(); e.click(); }, id);
    await p.waitForSelector(`[data-contact-editor-id="${id}"]`, { visible:true });
    await back(p); await p.waitForSelector('[role="alertdialog"]', { visible:true });
    await p.click('[data-action="contacts.edit.discard.submit"]'); await p.waitForSelector('.contacts-existing-picker', { visible:true });
    assert.equal((await p.evaluate(id => window.__OS__.content.query(`content://contacts/contacts/${id}`).items[0],id)).company,'Updated elsewhere');
  });
  await run('cold-picker-back-and-missing-number-safety', async p => {
    await ready(p);
    await p.evaluate(() => window.__OS__.openApp('contacts','/contacts/choose-existing?number=456'));
    await p.waitForSelector('.contacts-existing-picker', { visible:true }); await back(p);
    await p.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.includes('dialpad=true'));
    assert.equal(await p.$eval('[data-benchmark-field="dialpad-digits"]',e=>e.textContent.trim()), '456');
    await p.evaluate(() => window.__OS__.openApp('contacts','/contacts/choose-existing'));
    await p.waitForSelector('.contacts-existing-picker', { visible:true });
    assert.ok(await p.$$eval('.contacts-existing-picker-list button', buttons => buttons.length > 0 && buttons.every(button => button.disabled)));
  });
  await run('cold-editor-discard-returns-to-own-picker', async p => {
    const id = await ready(p), before = await phones(p,id);
    await p.evaluate(id => window.__OS__.openApp('contacts', `/contact/${id}/edit?from=dialpad&number=456`),id);
    await p.waitForSelector(`[data-contact-editor-id="${id}"]`, { visible:true });
    await back(p); await p.waitForSelector('[role="alertdialog"]', { visible:true });
    await p.click('[data-action="contacts.edit.discard.submit"]');
    await p.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.startsWith('/contacts/choose-existing'));
    assert.ok((await route(p)).includes('number=456')); assert.deepEqual(await phones(p,id),before);
    await back(p); await p.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.includes('dialpad=true'));
    assert.equal(await p.$eval('[data-benchmark-field="dialpad-digits"]',e=>e.textContent.trim()),'456');
  });
  for (const orientation of ['side_by_side', 'stacked']) await run(`picker-contained-in-${orientation}-split`, async p => {
    const id = await ready(p); await picker(p);
    await p.evaluate(() => window.__OS__.openApp('clock','/world'));
    await p.waitForFunction(() => window.__OS__.getState().tasks.some(t => t.rootAppId === 'clock'));
    await p.evaluate(orientation => { const tasks = window.__OS__.getState().tasks;
      const contacts = tasks.find(t => t.rootAppId === 'contacts'), clock = tasks.find(t => t.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', contacts.taskId, clock.taskId, .5, null, .5, orientation);
      window.__OS__.launchTaskById(contacts.taskId);
    }, orientation);
    await p.waitForSelector('.contacts-existing-picker-search input', { visible:true });
    await p.type('.contacts-existing-picker-search input','Synthetic Choice');
    const contained = await p.evaluate(id => { const picker = document.querySelector('.contacts-existing-picker');
      const app = picker.closest('[data-app-id="contacts"]'), a = picker.getBoundingClientRect(), b = app.getBoundingClientRect();
      const button = document.querySelector(`[data-existing-contact-id="${id}"]`), r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width/2,r.y + r.height/2);
      return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom && (hit === button || button.contains(hit));
    }, id);
    assert.equal(contained,true); await choose(p,id); assert.equal((await phones(p,id)).length,1);
  });
  await run('posture-change-preserves-unsaved-number', async p => {
    const id = await ready(p); await picker(p); await choose(p,id);
    await p.evaluate(() => window.__FOLDAGENT__.setPosture('folded'));
    await p.waitForFunction(() => window.__FOLDAGENT__.getState().posture === 'folded');
    assert.deepEqual(await p.$$eval('[data-contact-field="phone"]', es => es.map(e => e.value)), ['555001','123']);
    assert.equal((await phones(p,id)).length, 1);
  });
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed:true, checks, scope:'Synthetic local data; picker layout and native return semantics not video-verified.' },null,2));
} finally { await browser.close(); }

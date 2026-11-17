import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'mobilegym/package.json')) ? 'mobilegym' : 'foldmobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const helperRoot = frontend === 'mobilegym' ? path.join(root, 'foldmobilegym/tools') : path.join(root, 'tools/browser-automation');
const { openPilotApp } = await import(pathToFileURL(path.join(helperRoot, 'pilot_app_navigation.mjs')));
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(fs.existsSync);
assert.ok(executablePath);
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3286/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const errors = [], writes = [], checks = [];
let blockedApiReads = 0;
const baseline = process.env.FOLDAGENT_REVIEW_BASELINE === '1';
const contacts = '[data-app-id="contacts"]', mail = '[data-app-id="mail"]';
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const state = (page, app) => page.evaluate(app => window.__SIM__.getState().apps[app], app);
const open = (page, app, route) => openPilotApp(page, app, route);

try {
  for (const locale of baseline ? ['en'] : ['zh-Hans', 'en']) for (const posture of baseline ? ['folded'] : ['folded', 'unfolded']) {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    page.on('pageerror', error => errors.push(`${locale}/${posture}: ${error.message}`));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const target = new URL(request.url());
      if (request.method() === 'GET' && target.origin === url.origin && /^\/api(?:\/|$)/.test(target.pathname)) { blockedApiReads++; request.abort(); return; }
      if (request.method() === 'GET' && (target.origin === url.origin || ['data:', 'blob:'].includes(target.protocol))) request.continue();
      else { writes.push(`${request.method()} ${target.origin}${target.pathname}`); request.abort(); }
    });
    try {
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
      await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });

      await open(page, 'mail', '/');
      await page.click(`${mail} [data-action="mail.compose.open"]`);
      await page.waitForSelector(`${mail} [data-benchmark-field="mail-to"]`, { visible: true });
      await page.type(`${mail} [data-benchmark-field="mail-to"]`, 'ordinary@example.invalid');
      await page.type(`${mail} [data-benchmark-field="mail-subject"]`, 'Ordinary draft');
      await page.type(`${mail} [data-benchmark-field="mail-body"]`, 'Must remain untouched');
      const ordinaryBefore = await page.$eval(`${mail} [data-benchmark-field="mail-body"]`, node => node.value);
      await page.evaluate(() => window.__OS__.goHome());

      const contactId = await page.evaluate(() => window.__OS__.content.insert('content://contacts/contacts', {
        displayName: 'Mailto local review', phones: [], emails: [{ id: 'work', label: 'Work', email: 'person@example.invalid' }],
      }).split('/').pop());
      await open(page, 'contacts', `/contact/${encodeURIComponent(contactId)}`);
      if (baseline) {
        const before = await state(page, 'mail');
        assert.equal((await page.$$(`${contacts} [data-action="contacts.contact.email.open"]`)).length, 0);
        await page.evaluate(contacts => {
          const button = [...document.querySelector(contacts).querySelectorAll('button')].find(node => node.textContent.includes('person@example.invalid'));
          if (!button) throw Error('Missing source email row');
          button.click();
        }, contacts);
        await tick(page);
        assert.equal(await page.evaluate(() => window.__OS__.getState().activeAppId), 'contacts');
        assert.deepEqual(await state(page, 'mail'), before);
        checks.push({ baseline: 'Email row does not open a mail draft' });
        console.log('BASELINE: email row is inert; ordinary draft unchanged');
        continue;
      }
      const contactBefore = await state(page, 'contacts');
      const mailBefore = await state(page, 'mail');
      await page.waitForSelector(`${contacts} [data-action="contacts.contact.email.open"]`, { visible: true });
      await page.click(`${contacts} [data-action="contacts.contact.email.open"]`);
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'mail');
      await page.waitForSelector(`${mail} [data-mailto-recipient="person@example.invalid"]`, { visible: true });
      assert.equal(await page.$eval(`${mail} [data-action="mail.mailto.to.input"]`, node => node.value), 'person@example.invalid');
      await page.type(`${mail} [data-action="mail.mailto.subject.input"]`, 'Contact follow-up');
      await page.type(`${mail} [data-action="mail.mailto.body.input"]`, 'Saved locally only');
      await page.evaluate(() => window.__OS__.handleBack());
      await tick(page);
      assert.equal(await page.$eval(`${mail} [data-action="mail.mailto.body.input"]`, node => node.value), 'Saved locally only');
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'contacts');
      assert.deepEqual((await state(page, 'mail')).drafts, mailBefore.drafts, 'Back keeps a pending buffer, not a completed draft');
      await page.click(`${contacts} [data-action="contacts.contact.email.open"]`);
      await page.waitForSelector(`${mail} [data-mailto-recipient="person@example.invalid"]`, { visible: true });
      assert.equal(await page.$eval(`${mail} [data-action="mail.mailto.body.input"]`, node => node.value), 'Saved locally only');
      await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture === 'folded' ? 'unfolded' : 'folded'), posture);
      await tick(page);
      assert.equal(await page.$eval(`${mail} [data-action="mail.mailto.body.input"]`, node => node.value), 'Saved locally only');
      const ownerTask = await page.evaluate(() => window.__OS__.getState().activeTaskId);
      await page.$eval(`${mail} [data-action="mail.mailto.save.submit"]`, node => { window.__retainedMailtoSave = node; });
      await open(page, 'clock', '/alarm');
      await page.evaluate(() => window.__retainedMailtoSave.click());
      await tick(page);
      assert.deepEqual((await state(page, 'mail')).drafts, mailBefore.drafts, 'A background retained Save must not create a draft');
      await page.evaluate(taskId => window.__OS__.launchTaskById(taskId), ownerTask);
      await page.waitForSelector(`${mail} [data-mailto-recipient="person@example.invalid"]`, { visible: true });
      await page.click(`${mail} [data-action="mail.mailto.save.submit"]`);
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'contacts');
      assert.equal((await state(page, 'mail')).drafts.some(draft => draft.to === 'person@example.invalid' && draft.subject === 'Contact follow-up' && draft.body === 'Saved locally only'), true);
      const mailAfter = await state(page, 'mail');
      assert.equal(mailAfter.drafts.length, mailBefore.drafts.length + 1);
      assert.equal(mailAfter.send_count, 0);
      assert.deepEqual(mailAfter.draft_input, mailBefore.draft_input);
      assert.deepEqual(await state(page, 'contacts'), contactBefore);
      assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('contacts').path), `/contact/${encodeURIComponent(contactId)}`);

      await open(page, 'mail', '/');
      await page.waitForSelector(`${mail} [data-benchmark-field="mail-body"]`, { visible: true });
      assert.equal(await page.$eval(`${mail} [data-benchmark-field="mail-body"]`, node => node.value), ordinaryBefore);
      assert.equal(await page.$eval(`${mail} [data-benchmark-field="mail-to"]`, node => node.value), 'ordinary@example.invalid');
      assert.equal((await state(page, 'contacts')).contacts.some(contact => contact.id === contactId), true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__);
      await open(page, 'contacts', `/contact/${encodeURIComponent(contactId)}`);
      await page.click(`${contacts} [data-action="contacts.contact.email.open"]`);
      await page.waitForSelector(`${mail} [data-mailto-recipient="person@example.invalid"]`, { visible: true });
      assert.equal(await page.$eval(`${mail} [data-action="mail.mailto.body.input"]`, node => node.value), 'Saved locally only');
      assert.equal((await state(page, 'mail')).drafts.length, mailBefore.drafts.length + 1);
      assert.deepEqual(errors, []);
      checks.push({ locale, posture, ordinaryDraftPreserved: true, localMailtoSaved: true, returnedToContact: true, unsavedBack: true, backgroundGuard: true, postureChange: true, persisted: true });
      console.log('PASS', locale, posture, 'mailto intent, isolated draft, local save and return');
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const result = { passed: !errors.length && !writes.length && checks.length === (baseline ? 1 : 4), baseline, checks, errors, writes, blockedApiReads };
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;

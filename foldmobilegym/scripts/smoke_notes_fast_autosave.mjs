import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__));
  await page.evaluate(() => window.__OS__.openApp('notes'));
  await page.waitForSelector('[data-app-id="notes"]', { visible: true });
  const snapshot = () => page.evaluate(() => window.__SIM__.getState().apps.notes);
  const seed = await snapshot();
  const original = seed.notes.find(note => !note.trashedAt && !note.locked && note.title);
  assert.ok(original, 'Diagnostic needs an editable existing note');
  const title = '[data-app-id="notes"] [data-benchmark-field="notes-title"]';
  await page.evaluate(id => window.__OS__.openApp('notes', `/note/${id}`), original.id);
  await page.waitForSelector(title, { visible: true });
  assert.equal(await page.$eval(title, node => node.value), original.title);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
  assert.deepEqual(await snapshot(), seed, 'Opening a note without editing must not change persistent data');
  await page.evaluate(() => window.__OS__.openApp('notes', '/'));
  const rows = [];
  for (const posture of ['unfolded', 'folded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
    const before = await snapshot();
    const current = before.notes.find(note => note.id === original.id);
    const start = await page.evaluate(() => performance.now());
    await page.evaluate(id => window.__OS__.openApp('notes', `/note/${id}`), original.id);
    await page.waitForFunction(({ title, text }) => document.querySelector(title)?.value === text,
      {}, { title, text: current.title });
    await page.click(title);
    await page.keyboard.press('End');
    await page.keyboard.type('X');
    const elapsed = await page.evaluate(start => performance.now() - start, start);
    assert.ok(elapsed < 200, `Fast-edit diagnostic did not reach the initialization window: ${elapsed}ms`);
    assert.equal(await page.$eval(title, node => node.value), `${current.title}X`);
    // No Back/Done/close or further edit: prove the autosave itself runs.
    await page.waitForFunction(({ id, expected }) => window.__SIM__.getState().apps.notes.notes
      .find(note => note.id === id)?.title === expected, { timeout: 4000 },
    { id: original.id, expected: `${current.title}X` });
    const after = await snapshot();
    assert.equal(after.createdCount, before.createdCount);
    assert.equal(after.notes.length, before.notes.length);
    assert.deepEqual(after.notes.filter(note => note.id !== original.id), before.notes.filter(note => note.id !== original.id));
    rows.push({ posture, editElapsedMs: elapsed, autosavedWithoutExit: true, noNewNote: true });
    // Close before the debounce fires: the synchronous exit draft must win.
    await page.click(title);
    await page.keyboard.press('End');
    await page.keyboard.type('E');
    await page.evaluate(() => window.__OS__.closeApp('notes'));
    await page.waitForFunction(({ id, expected }) => window.__SIM__.getState().apps.notes.notes
      .find(note => note.id === id)?.title === expected, { timeout: 4000 },
    { id: original.id, expected: `${current.title}XE` });
    await page.evaluate(id => window.__OS__.openApp('notes', `/note/${id}`), original.id);
    await page.waitForFunction(({ title, expected }) => document.querySelector(title)?.value === expected,
      {}, { title, expected: `${current.title}XE` });
    const recreated = await snapshot();
    assert.equal(recreated.createdCount, before.createdCount);
    assert.equal(recreated.notes.find(note => note.id === original.id).content, current.content);
    assert.deepEqual(recreated.notes.filter(note => note.id !== original.id), before.notes.filter(note => note.id !== original.id));
    rows.at(-1).quickCloseRetained = true;
    await page.evaluate(() => window.__OS__.openApp('notes', '/'));
    const beforeNew = await snapshot();
    await page.evaluate(() => window.__OS__.openApp('notes', '/note/new'));
    await page.waitForFunction(title => window.__OS__.getAppRoute('notes')?.path === '/note/new'
      && document.querySelector(title)?.value === '', {}, title);
    const newTitle = `Public autosave ${posture}`;
    const newContent = 'Public draft persistence regression';
    await page.type(title, newTitle);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-benchmark-field')), 'notes-title',
      'Default delayed autofocus must respect the selected title field');
    await page.type('[data-app-id="notes"] [data-benchmark-field="notes-content"]', newContent);
    assert.equal(await page.$eval(title, node => node.value), newTitle, 'Delayed autofocus must not steal title input');
    assert.equal(await page.$eval('[data-app-id="notes"] [data-benchmark-field="notes-content"]', node => node.value), newContent);
    await page.waitForFunction(({ title, content }) => window.__SIM__.getState().apps.notes.notes
      .some(note => note.title === title && note.content === content), { timeout: 4000 },
    { title: newTitle, content: newContent });
    await page.waitForFunction(() => window.__OS__.getAppRoute('notes')?.path !== '/note/new');
    await page.evaluate(() => window.__OS__.closeApp('notes'));
    await page.evaluate(() => window.__OS__.openApp('notes'));
    await page.waitForSelector('[data-app-id="notes"]', { visible: true });
    const afterNew = await snapshot();
    assert.equal(afterNew.createdCount, beforeNew.createdCount + 1);
    assert.equal(afterNew.notes.length, beforeNew.notes.length + 1);
    assert.equal(afterNew.notes.filter(note => note.title === newTitle && note.content === newContent).length, 1);
    assert.deepEqual(afterNew.notes.filter(note => beforeNew.notes.some(old => old.id === note.id)), beforeNew.notes);
    rows.at(-1).newNoteCreatedOnce = true;
    await page.evaluate(() => window.__OS__.openApp('notes', '/'));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, rows, pageErrors: errors,
    scope: 'Existing-note fast autosave UI regression, not CW21 or recovery qualification' }));
} finally { await browser.close(); }

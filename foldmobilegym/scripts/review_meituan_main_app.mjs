import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';
import {attachReadOnlyBuildPage} from './lib/readOnlyBuildPage.mjs';

const site = process.argv.find(arg => arg.startsWith('--site='))?.slice(7) || 'http://127.0.0.1:3191/';
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (output) fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: resolveBrowserExecutable(), args: ['--no-sandbox'] });
const page = await browser.newPage();
const app = '[data-app-id="meituan_waimai"]';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let transport={mode:'not-initialized',delivered:[],blocked:[]};
try {
  transport=await attachReadOnlyBuildPage(page,{directory:process.env.FOLDAGENT_REVIEW_BUILD,workspace:path.resolve(import.meta.dirname,'../..'),baseURL:site});
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__ && window.__FOLDAGENT__));
  await page.evaluate(() => window.__SIM__.resetState());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__ && window.__FOLDAGENT__));

  const launcher = await page.$eval('[data-launcher-app="meituan_waimai"]', node => ({
    label: node.querySelector(':scope > span')?.textContent.trim(), aria: node.getAttribute('aria-label'),
    mainIcon: Boolean(node.querySelector('[data-meituan-main-icon="true"]')),
  }));
  assert.match(launcher.label, /^美团$/);
  assert.equal(launcher.label.includes('美团外卖'), false);
  assert.equal(launcher.mainIcon, true);

  await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/'));
  await page.waitForSelector(`${app} [data-meituan-main-home="true"]`, { visible: true });
  assert.equal(await page.$$eval(`${app} [data-meituan-service]`, nodes => nodes.length), 15);
  assert.deepEqual(await page.$$eval(`${app} .mt-super-tabbar button`, nodes => nodes.map(node => node.textContent.trim())),
    ['首页', '视频', '小团', '购物车', '我的']);

  const layouts = {};
  for (const posture of ['folded', 'unfolded']) {
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture);
    await new Promise(resolve => setTimeout(resolve, 450));
    layouts[posture] = await page.$eval(app, node => {
      const home = node.querySelector('.mt-super-home-pane').getBoundingClientRect();
      const device = node.getBoundingClientRect();
      return { appWidth: Math.round(device.width), homeWidth: Math.round(home.width), serviceColumns: getComputedStyle(node.querySelector('.mt-super-services')).gridTemplateColumns.split(' ').length };
    });
    assert.equal(layouts[posture].serviceColumns, 5);
    if (output) await (await page.$(app)).screenshot({ path: path.join(output, `${posture}-main.png`) });
  }

  await page.click(`${app} [data-trigger="meituan.search.open"]`);
  await page.waitForSelector(`${app} [data-meituan-search-results="true"]`, { visible: true });
  assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('meituan_waimai').path), '/?search=open');
  const unfoldedSearch = await page.$eval(`${app} .mt-super-layout`, node => ({
    panes: [...node.children].map(child => Math.round(child.getBoundingClientRect().width)),
    visibleHome: node.querySelector('.mt-super-home-pane').checkVisibility(),
    visibleResults: node.querySelector('.mt-super-results-pane').checkVisibility(),
  }));
  assert.equal(unfoldedSearch.visibleHome, true);
  assert.equal(unfoldedSearch.visibleResults, true);
  assert.equal(unfoldedSearch.panes.length, 2);
  if (output) await (await page.$(app)).screenshot({ path: path.join(output, 'unfolded-search.png') });

  await page.evaluate(() => window.__FOLDAGENT__.setPosture('folded'));
  await new Promise(resolve => setTimeout(resolve, 450));
  const foldedSearch = await page.$eval(`${app} .mt-super-layout`, node => ({
    visibleHome: node.querySelector('.mt-super-home-pane').checkVisibility(),
    visibleResults: node.querySelector('.mt-super-results-pane').checkVisibility(),
  }));
  assert.equal(foldedSearch.visibleHome, false);
  assert.equal(foldedSearch.visibleResults, true);
  await page.evaluate(() => window.__OS__.handleBack());
  await page.waitForFunction(() => window.__OS__.getAppRoute('meituan_waimai').path === '/');

  await page.evaluate(() => document.querySelector('[data-app-id="meituan_waimai"] [data-meituan-service="delivery"]').click());
  await page.waitForFunction(() => window.__OS__.getAppRoute('meituan_waimai').path.includes('channel=waimai'));
  assert.ok(await page.$(`${app} .mt-hero`));
  assert.equal(await page.$eval(`${app} .mt-header b`, node => node.textContent.trim()), '美团 · 外卖频道');
  assert.ok(await page.$(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`));
  await page.evaluate(() => window.__OS__.handleBack());
  await page.waitForSelector(`${app} [data-meituan-main-home="true"]`, { visible: true });

  await page.click(`${app} [data-meituan-service="travel"]`);
  await page.waitForSelector(`${app} .mt-main-service-scope`, { visible: true });
  assert.equal((await page.$eval(`${app} .mt-main-service-scope`, node => node.textContent)).includes('真实预订'), true);
  assert.equal(await page.$$eval(`${app} .mt-main-service-scope button`, nodes => nodes.length), 1);
  await page.click(`${app} .mt-main-service-scope button`);
  await page.waitForSelector(`${app} [data-meituan-main-home="true"]`, { visible: true });
  await page.click(`${app} [data-meituan-service="delivery"]`);
  // The home and delivery screens both contain a rice card. Waiting only for
  // that selector can click the departing home's stale card before React commits.
  await page.waitForFunction(app => window.__OS__.getAppRoute('meituan_waimai').path.includes('channel=waimai')
    && document.querySelector(`${app} .mt-header b`)?.textContent.trim() === '美团 · 外卖频道', {}, app);
  await page.waitForSelector(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`, { visible: true });
  await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
  await page.waitForSelector(`${app} [data-action="meituan.cart.item.add"]`, { visible: true });
  await page.$eval(`${app} [data-action="meituan.cart.item.add"]`, node => node.click());
  await page.$eval(`${app} [data-trigger="meituan.cart.open"]`, node => node.click());
  await page.waitForSelector(`${app} .mt-cart-row`, { visible: true });
  const taskCompatibility = await page.evaluate(() => {
    const state = window.__SIM__.getState().apps.meituan_waimai;
    return { cart: state.cart, orders: state.user.orderIds.length, route: window.__OS__.getAppRoute('meituan_waimai').path };
  });
  assert.equal(taskCompatibility.cart.shopId, 'rice');
  assert.equal(taskCompatibility.cart.quantities.chicken, 1);
  assert.equal(taskCompatibility.orders, 0);
  assert.equal(taskCompatibility.route, '/cart');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, transportMode: transport.mode, launcher, services: 15, tabs: 5, layouts, unfoldedSearch, foldedSearch,
    deliveryChannel: true, unsupportedServicesAreExplicit: true, taskCompatibility,
    scope: 'Meituan main-App correction; not full native-service parity' }, null, 2));
} finally {
  if(output) fs.writeFileSync(path.join(output,'transport.json'),JSON.stringify(transport,null,2)); await browser.close();
}

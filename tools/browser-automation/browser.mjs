import fs from 'node:fs';
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

export function resolveBrowserExecutable({ configured = process.env.FOLDAGENT_BROWSER_PATH,
  candidates = EDGE_CANDIDATES } = {}) {
  if (configured) {
    if (!fs.existsSync(configured) || !fs.statSync(configured).isFile()) {
      throw new Error('FOLDAGENT_BROWSER_PATH must point to a Chromium executable file; no fallback from an explicit invalid path');
    }
    return configured;
  }
  const browser = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!browser) throw new Error('No Edge/Chrome executable found; set FOLDAGENT_BROWSER_PATH to a Chromium executable');
  return browser;
}


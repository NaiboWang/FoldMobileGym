import fs from 'node:fs';
import path from 'node:path';

// Diagnostic-only snapshot access. Enumerate actual launcher placements rather
// than leftover source directories that the runtime deliberately excludes.
export async function visibleAppIds(page) {
  await page.waitForFunction(() => Boolean(window.__SIM__?.getState().os.launcher?.screens?.length));
  return page.evaluate(() => {
    const os = window.__SIM__.getState().os;
    const installed = new Set(os.installedApps.map(app => app.id));
    const hidden = new Set(os.launcher.hiddenApps || []);
    const placements = [...os.launcher.screens.flatMap(screen => screen.items), ...os.launcher.hotseat];
    const placedFolders = new Set(placements.filter(item => item.kind === 'folder').map(item => item.folderId));
    const ids = [...placements.filter(item => item.kind === 'app').map(item => item.appId),
      ...os.launcher.folders.filter(folder => placedFolders.has(folder.id)).flatMap(folder => folder.items)];
    // Launcher.tsx deliberately suppresses workspace_docs independently of
    // layout.hiddenApps, so its legacy placement is not a visible icon.
    return [...new Set(ids)].filter(id => installed.has(id) && !hidden.has(id) && id !== 'workspace_docs').sort();
  });
}

export function reportAudit(result) {
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result, null, 2));
}

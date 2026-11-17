import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const frontend = process.cwd();
describe('foldmobilegym runtime identity without upstream attribution loss', () => {
  it('uses the formal release name in the actual simulator document', () => {
    const html = fs.readFileSync(path.join(frontend, 'index.html'), 'utf8');
    expect(html.match(/<title>([^<]+)<\/title>/)?.[1]).toBe('foldmobilegym');
    expect(html).toContain('<meta name="application-name" content="foldmobilegym"');
  });
  it('does not relabel the upstream research page or claim its paper results as ours', () => {
    const upstream = fs.readFileSync(path.join(frontend, 'web/index.html'), 'utf8');
    expect(upstream.match(/<title>([^<]+)<\/title>/)?.[1]).toContain('MobileGym');
    expect(upstream).toContain('<link rel="canonical" href="https://mobilegym.dev/paper/"');
  });
  it('keeps the published integration event namespace intact', () => {
    const input = fs.readFileSync(path.join(frontend, 'os/hooks/useTriggerGestures.ts'), 'utf8');
    expect(input).toContain("'mobilegym:agent-action'");
  });
});

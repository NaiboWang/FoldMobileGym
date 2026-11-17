import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const page=readFileSync(new URL('../system/FileManager/pages/SearchPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../system/FileManager/file-manager-adaptive.css',import.meta.url),'utf8');
describe('FileManager search source-path presentation contract',()=>{
  it('retains full source paths separately from date/size metadata',()=>{
    expect(page).toContain('<small className="fm-search-path" data-file-search-path>{file.path}</small>');
    expect(page).toContain('<small className="fm-search-metadata">{TimeService.fromTimestamp(file.modifiedAt)');
    expect(page).toContain('key={file.id}');
    expect(page).toContain('path: target.path');
  });
  it('overrides the compact metadata ellipsis only for the identity line',()=>{
    const rule=css.match(/\.fm-search-copy \.fm-search-path\s*\{([^}]+)\}/)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toContain('white-space: normal');
    expect(rule).toContain('overflow-wrap: anywhere');
    expect(rule).toContain('overflow: visible');
    expect(rule).toContain('text-overflow: clip');
  });
});

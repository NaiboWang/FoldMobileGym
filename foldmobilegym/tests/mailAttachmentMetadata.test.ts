import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MailAttachmentMetadata } from '../apps/Mail/components/MailAttachmentMetadata';
import type { FSNode } from '../os/types';

const reference = { id: 'source-a', path: '/sdcard/Documents/版本  A/%2F 文档.txt', createdAt: 42 };
const node: FSNode = { ...reference, name: '%2F 文档.txt', type: 'file', parentId: 'docs', modifiedAt: 50, size: 534, mimeType: 'text/plain', storage: 'indexeddb' };
const render = (source: FSNode | null) => renderToStaticMarkup(React.createElement(MailAttachmentMetadata, { reference, node: source, unavailable: 'Unavailable' }));
describe('Mail attachment visible source identity', () => {
  it('shows the exact literal path, MIME and actual size without URL decoding', () => {
    const html = render(node);
    expect(html).toContain(reference.path);
    expect(html).toContain('text/plain · 534 B');
    expect(html).toContain('dir="ltr"');
    expect(html).not.toContain('Unavailable');
  });
  it.each([null, { ...node, id: 'replacement', size: 999, mimeType: 'application/pdf' }, { ...node, createdAt: 43 }])('does not borrow replacement or missing metadata: %j', source => {
    const html = render(source);
    expect(html).toContain(reference.path);
    expect(html).toContain('Unavailable');
    expect(html).not.toContain(' B');
    expect(html).not.toContain('application/pdf');
  });
  it('does not invent a MIME when the source has none', () => {
    const html = render({ ...node, mimeType: undefined });
    expect(html).toContain('534 B');
    expect(html).not.toContain('application/octet-stream');
    expect(html).not.toContain('text/plain');
  });
});

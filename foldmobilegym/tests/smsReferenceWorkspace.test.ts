import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../system/Sms/SmsApp.tsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../system/Sms/components/ConversationListPage.tsx', import.meta.url), 'utf8');
const item = readFileSync(new URL('../system/Sms/components/ConversationItem.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../system/Sms/workspace.css', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../system/Sms/navigation.declaration.ts', import.meta.url), 'utf8');

describe('SMS reference master/detail workspace', () => {
  it('keeps one persistent conversation master beside compose and detail routes', () => {
    expect(app).toContain('data-sms-master-pane');
    expect(app).toContain('data-sms-detail-pane');
    expect(app).toContain('<ConversationListPage />');
    expect(app).toContain('<SmsRouteContent />');
    expect(app).toContain("search.get('panel') === 'contacts'");
  });

  it('uses the recorded 40/60 unfolded split and folded foreground continuation', () => {
    expect(css).toContain('container-name: sms-workspace');
    expect(css).toContain('grid-template-columns: minmax(0, 40%) minmax(0, 60%)');
    expect(css).toContain('.sms-pane-back { display: none !important; }');
    expect(css).toContain('.sms-workspace-grid.is-root .sms-workspace-detail { display: none; }');
  });

  it('declares master scroll ownership and master-list navigation from visible right routes', () => {
    expect(navigation).toContain("{ name: 'master', direction: 'vertical'");
    expect(navigation).toContain("{ path: '/new', search: { panel: null, dialog: null } }");
    expect(navigation).toContain("'/conversation/:conversationId'");
    expect(list).toContain('data-scroll-container="master"');
    expect(item).toContain('data-selected={selected || undefined}');
  });
});


import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../os/components/KeyboardOverlay.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

describe('code-native reference keyboard theme', () => {
  it('declares a local theme and stable visual hooks without image URLs', () => {
    expect(component).toContain('data-keyboard-theme="sogou-inspired"');
    expect(component).toContain('data-keyboard-toolbar');
    expect(component).toContain('data-keyboard-body');
    expect(component).toContain('data-keyboard-letter={main}');
    expect(css).toContain('.keyboard-reference-theme::before');
    expect(css).toContain('repeating-radial-gradient');
    expect(css).not.toMatch(/keyboard-reference[\s\S]*url\(/);
  });

  it('preserves the existing input handlers and pages', () => {
    for (const token of ['handleLetter(k.main)', 'handleBackspace', 'handleSpace', 'handleEnter', "setPage('num')", "setPage('sym')", 'KeyboardService.toggleMode()']) {
      expect(component).toContain(token);
    }
  });
});


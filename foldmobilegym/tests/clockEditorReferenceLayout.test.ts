import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {strings} from '../system/Clock/res/strings';
import {stringsEn} from '../system/Clock/res/strings.en';

// Narrow source-order regression for the existing editor; browser layout and
// interactions still require the production review in both screen postures.
describe('Clock alarm editor reference-informed settings', () => {
  const source = readFileSync(new URL('../system/Clock/pages/AlarmEditorSheet.tsx', import.meta.url), 'utf8');
  it('places repeat before the sound and editable alarm name', () => {
    const repeat = source.indexOf("bindTap('alarm.repeat.open'");
    const sound = source.indexOf('{s.alarm_ringtone}');
    const note = source.indexOf('{s.alarm_note}');
    expect(repeat).toBeGreaterThan(0);
    expect(sound).toBeGreaterThan(repeat);
    expect(note).toBeGreaterThan(sound);
  });
  it('opens a selectable generated browser tone and discloses its limits', () => {
    expect(source).toContain("bindTap('alarm.ringtone.open'");
    expect(source).toContain('formatAlarmToneLabel(alarm.tone, s)');
    expect(strings.alarm_tone_classic).toBe('经典');
    expect(strings.alarm_tone_scope).toContain('合成浏览器提示音');
    expect(stringsEn.alarm_tone_classic).toBe('Classic');
    expect(stringsEn.alarm_tone_scope).toContain('Synthesized browser tones');
    expect(strings.alarm_note).toBe('闹钟名');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const component = readFileSync(new URL('../apps/Weather/components/DailyForecastShort.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../apps/Weather/pages/weather-home-reference.css', import.meta.url), 'utf8');
describe('compact recorded forecast chart', () => {
  it('keeps low temperatures below the lower line and no extra night row in the compact chart', () => {
    expect(component).not.toContain('className="is-night"');
    expect(component).not.toContain('className="is-night-text"');
    expect(component).toContain('model.lowPoints[index].y + 8');
    expect(styles).toContain('height: 242px');
  });
});

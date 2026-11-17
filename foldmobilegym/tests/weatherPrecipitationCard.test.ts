import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PrecipitationCard } from '../apps/Weather/components/PrecipitationCard';
import { strings } from '../apps/Weather/res/strings';
import { stringsEn } from '../apps/Weather/res/strings.en';

const en = { ...strings, ...stringsEn };
describe('precipitation card', () => {
  it.each([[strings, '降水预报暂不可用'], [en, 'Precipitation forecast unavailable']])('does not invent dry weather for missing data', (s, unavailable) => {
    const html = renderToStaticMarkup(React.createElement(PrecipitationCard, { summary: '', strings: s }));
    expect(html).toContain(unavailable);
    expect(html).not.toContain(s.no_precipitation_short);
    expect(html).not.toContain(s.safe_to_go_out);
  });
  it.each([[strings, '未来两小时有大雨'], [en, 'Heavy rain expected soon']])('shows the supplied forecast without an unconditional safety claim', (s, summary) => {
    const html = renderToStaticMarkup(React.createElement(PrecipitationCard, { summary, strings: s }));
    expect(html).toContain(summary);
    expect(html).not.toContain(s.safe_to_go_out);
  });
});
